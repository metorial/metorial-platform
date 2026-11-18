import {
  check,
  describeError,
  type CheckDefinition,
  type ResolutionInput
} from '@lowerdeck/doctor';
import {
  baselineChecks,
  bunRedis,
  postgresChecks,
  prismaQuery,
  queueChecks,
  redisChecks
} from '@metorial/doctor';
import type { RedisClient } from 'bun';
import { db } from './db';
import { emailSettings } from './env';
import {
  emailTransportType,
  getSesSendQuota,
  getSesVerificationStatuses,
  verifyEmailTransport
} from './lib/send';

let transportMissing = () => {
  if (!emailSettings.sesRegion && !emailSettings.smtpHost) {
    return 'Email is not configured, set EMAIL_HOST for SMTP or EMAIL_SES_REGION for SES.';
  }

  if (!emailSettings.sesRegion && emailSettings.smtpUser && !emailSettings.smtpPassword) {
    return 'EMAIL_USER is set without EMAIL_PASSWORD.';
  }

  if (emailSettings.sesAccessKeyId && !emailSettings.sesSecretAccessKey) {
    return 'EMAIL_SES_ACCESS_KEY_ID is set without EMAIL_SES_SECRET_ACCESS_KEY.';
  }

  return null;
};

let transportResolutions: Record<'smtp' | 'ses', Record<string, ResolutionInput>> = {
  smtp: {
    authentication: {
      summary: 'The SMTP server rejected the username or password.',
      steps: ['Check email.user and email.password in your Helm values.']
    },
    default: {
      summary: 'The SMTP server cannot be reached or refused the connection.',
      steps: [
        'Check email.host, email.port and email.secure.',
        'Check that egress from the email pods to the SMTP server is allowed.'
      ]
    }
  },
  ses: {
    authentication: {
      summary: 'AWS rejected the SES credentials.',
      steps: ['Check the access key, or the IRSA role annotation on the email ServiceAccount.']
    },
    permission: {
      summary: 'The credentials are valid but cannot use SES.',
      steps: ['Grant ses:SendEmail, ses:SendRawEmail and ses:GetSendQuota to the email role.']
    },
    default: {
      summary: 'SES cannot be reached in the configured region.',
      steps: ['Check email.sesRegion and that egress to the SES endpoint is allowed.']
    }
  }
};

let transportConfiguredCheck = (): CheckDefinition =>
  check({
    id: 'email.transport.configured',
    title: 'Email transport is configured',
    category: 'configuration',
    severity: 'critical',
    run: ctx => {
      let missing = transportMissing();
      if (missing) {
        return ctx.fail({
          message: missing,
          resolution: {
            summary: 'Configure SMTP or SES in the email section of your Helm values.',
            docs: 'datacenter/configuration/email'
          }
        });
      }

      return ctx.pass(`Email is sent through ${emailTransportType.toUpperCase()}.`, {
        transport: emailTransportType
      });
    }
  });

let sandboxQuotaLimit = 200;
let failureWindowMs = 60 * 60 * 1000;
let failureMinimumSends = 5;
let failureWarnRatio = 0.5;

let sesBase = {
  category: 'external' as const,
  dependsOn: ['email.ses.access'],
  minIntervalMs: 5 * 60_000,
  timeoutMs: 10_000,
  target: `ses/${emailSettings.sesRegion}`
};

let sesSandboxCheck = (): CheckDefinition =>
  check({
    ...sesBase,
    id: 'email.ses.sandbox',
    title: 'The SES account can send to any recipient',
    severity: 'warning',
    run: async ctx => {
      let quota = await getSesSendQuota();
      let details = { max24HourSend: quota.max24HourSend };

      if (quota.max24HourSend <= sandboxQuotaLimit) {
        return ctx.warn({
          message: `The SES account looks like it is still in the sandbox (${quota.max24HourSend} emails per day), so it can only send to verified recipients.`,
          resolution: {
            summary: 'Request production access for SES in the AWS console.',
            docs: 'datacenter/operations/doctor#email'
          },
          details
        });
      }

      return ctx.pass(`The account may send ${quota.max24HourSend} emails per day.`, details);
    }
  });

let senderDomain = (address: string) => address.split('@')[1] ?? address;

let sesIdentityCheck = (): CheckDefinition =>
  check({
    ...sesBase,
    id: 'email.ses.identity',
    title: 'The sender addresses are verified in SES',
    severity: 'critical',
    run: async ctx => {
      let senders = await db.emailIdentity.findMany({ select: { fromEmail: true } });
      let addresses = [
        ...new Set(senders.map((sender: { fromEmail: string }) => sender.fromEmail))
      ];
      if (!addresses.length) return ctx.skip('No sender addresses exist yet.');

      let domains = [...new Set(addresses.map(senderDomain))];
      let statuses = await getSesVerificationStatuses([...addresses, ...domains]);
      let unverified = addresses.filter(
        address =>
          statuses[address] != 'Success' && statuses[senderDomain(address)] != 'Success'
      );

      if (unverified.length) {
        return ctx.fail({
          message: `SES has not verified ${unverified.join(', ')}, so it rejects mail from these senders.`,
          resolution: {
            summary: `Verify the sender address or its domain in SES (region ${emailSettings.sesRegion}).`,
            docs: 'datacenter/operations/doctor#email'
          },
          details: { unverified }
        });
      }

      return ctx.pass('Every sender address is verified.', { addresses });
    }
  });

let describeFailure = (result: unknown) => {
  if (typeof result != 'string') return JSON.stringify(result).slice(0, 300);

  try {
    let parsed = JSON.parse(result);
    return String(parsed?.message ?? parsed?.name ?? parsed?.Code ?? result).slice(0, 300);
  } catch {
    return result.slice(0, 300);
  }
};

let deliveryFailuresCheck = (): CheckDefinition =>
  check({
    id: 'email.deliveries.failures',
    title: 'Emails are delivered',
    category: 'external',
    severity: 'warning',
    dependsOn: ['postgres.relay.connect'],
    run: async ctx => {
      let since = new Date(Date.now() - failureWindowMs);
      let [failed, total] = await Promise.all([
        db.outgoingEmailSend.count({ where: { status: 'failed', createdAt: { gte: since } } }),
        db.outgoingEmailSend.count({ where: { createdAt: { gte: since } } })
      ]);
      let details = { failed, total };

      if (total < failureMinimumSends)
        return ctx.pass('Few emails were sent in the last hour.', details);
      if (failed / total < failureWarnRatio) {
        return ctx.pass(`${failed} of ${total} sends failed in the last hour.`, details);
      }

      let last = await db.outgoingEmailSend.findFirst({
        where: { status: 'failed' },
        orderBy: { createdAt: 'desc' },
        select: { result: true }
      });

      return ctx.warn({
        message: `${failed} of ${total} email sends failed in the last hour. Last error: ${last ? describeFailure(last.result) : 'unknown'}`,
        resolution: {
          summary:
            'Check the sender verification and the relay credentials; failed sends are retried.',
          docs: 'datacenter/operations/doctor#email'
        },
        details
      });
    }
  });

let transportReachableCheck = (): CheckDefinition =>
  check({
    id: emailTransportType == 'ses' ? 'email.ses.access' : 'email.smtp.connect',
    title: `Email can be sent through ${emailTransportType.toUpperCase()}`,
    category: 'external',
    severity: 'critical',
    dependsOn: ['email.transport.configured'],
    minIntervalMs: 5 * 60_000,
    timeoutMs: 10_000,
    target:
      emailTransportType == 'ses'
        ? `ses/${emailSettings.sesRegion}`
        : `smtp/${emailSettings.smtpHost}`,
    run: async ctx => {
      try {
        await verifyEmailTransport();
        return ctx.pass(
          emailTransportType == 'ses'
            ? `SES accepted the credentials in ${emailSettings.sesRegion}.`
            : `The SMTP server ${emailSettings.smtpHost} accepted the connection.`
        );
      } catch (error) {
        let info = describeError(error);
        let resolutions = transportResolutions[emailTransportType];

        return ctx.fail({
          message: info.message,
          resolution: resolutions[info.kind] ?? resolutions.default,
          details: { errorKind: info.kind, errorCode: info.code }
        });
      }
    }
  });

export let emailDoctorChecks = (redis: RedisClient): CheckDefinition[] => [
  ...baselineChecks(),
  ...postgresChecks({
    name: 'relay',
    query: prismaQuery(db),
    schemaProbe: () => db.emailIdentity.count()
  }),
  ...redisChecks({ client: bunRedis(redis) }),
  ...queueChecks(),
  transportConfiguredCheck(),
  transportReachableCheck(),
  deliveryFailuresCheck(),
  ...(emailTransportType == 'ses' ? [sesIdentityCheck(), sesSandboxCheck()] : [])
];
