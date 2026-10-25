import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { db, getId, type Prisma, type ProviderSetupSession } from '@metorial-subspace/db';
import {
  checkTenant,
  metorialDb,
  type MetorialFacing,
  resolveMetorialFacing,
  resolveMetorialFacingWithOptionalActor,
  toProviderEventBase
} from '@metorial-subspace/module-tenant';
import { Fabric, type AuditSubspaceProviderSetupSession } from '@metorial/fabric';
import { type AdminSetupLinkEmailData, adminSetupLinkEmail } from '../email/adminSetupLink';
import {
  adminSetupEmailConflictError,
  adminSetupEmailLimitReachedError,
  adminSetupEmailMemberNotFoundError,
  adminSetupEmailNotSupportedError,
  adminSetupEmailRecipientsRequiredError,
  adminSetupEmailSessionInactiveError,
  adminSetupEmailTooManyRecipientsError,
  adminSetupInstanceEmailLimitReachedError
} from '../lib/adminSetupErrors';
import {
  SETUP_SESSION_EMAIL_MAX_RECIPIENTS,
  SETUP_SESSION_EMAIL_MAX_RECIPIENTS_PER_DAY,
  SETUP_SESSION_EMAIL_MAX_RECIPIENTS_PER_INSTANCE_PER_DAY,
  SETUP_SESSION_EMAIL_THROTTLE_WINDOW_MINUTES
} from '../lib/setupSessionEmailLimits';
import { isAdminSetupSession } from '../lib/setupSessionType';
import { getProviderSetupSessionUrl } from '../lib/setupSessionUrl';

let throttleWindowMs = SETUP_SESSION_EMAIL_THROTTLE_WINDOW_MINUTES * 60 * 1000;
let recipientCapWindowMs = 24 * 60 * 60 * 1000;
let maxClaimAttempts = 3;

export let providerSetupSessionEmailInclude = {
  setupSession: { select: { id: true } },
  senderActor: true
} satisfies Prisma.ProviderSetupSessionEmailInclude;

type ProviderSetupSessionEmailRecord = Prisma.ProviderSetupSessionEmailGetPayload<{
  include: typeof providerSetupSessionEmailInclude;
}>;

type Recipient = {
  email: string;
  organizationMemberId: string | null;
};

type ThrottleSlot = {
  setupSession: ProviderSetupSession;
  recipient: Recipient;
  throttleBucket: number;
  senderActorOid: bigint | null;
};

let normalizeEmail = (email: string) => email.trim().toLowerCase();

let isUniqueConstraintError = (error: any) => error?.code === 'P2002';

class ProviderSetupSessionEmailServiceImpl {
  async createProviderSetupSessionEmails(
    d: MetorialFacing<{
      providerSetupSession: AuditSubspaceProviderSetupSession;
      input: {
        emails?: string[];
        organizationMemberIds?: string[];
      };
    }>
  ) {
    let scope = await resolveMetorialFacingWithOptionalActor(d);
    let setupSession = d.providerSetupSession;

    checkTenant(scope, setupSession);
    this.assertSessionCanBeEmailed(setupSession);

    let recipients = await this.resolveRecipients(d);
    await this.assertRecipientCapsNotReached({ scope, setupSession, recipients });

    let organization = await metorialDb.organization.findUniqueOrThrow({
      where: { oid: d.instance.organizationOid }
    });

    let emailData: AdminSetupLinkEmailData = {
      senderName: d.organizationActor?.type === 'member' ? d.organizationActor.name : null,
      providerName: setupSession.provider?.name ?? 'an integration',
      organizationName: organization.name,
      setupUrl: getProviderSetupSessionUrl(setupSession),
      expiresAt: setupSession.expiresAt
    };

    let eventBase = toProviderEventBase(d);
    let throttleBucket = Math.floor(Date.now() / throttleWindowMs);
    let senderActorOid = scope.actor?.oid ?? null;

    let results: {
      setupSessionEmail: ProviderSetupSessionEmailRecord;
      deduplicated: boolean;
    }[] = [];

    for (let recipient of recipients) {
      let claimed = await this.claimThrottleSlot({
        setupSession,
        recipient,
        throttleBucket,
        senderActorOid
      });

      if (claimed.deduplicated) {
        results.push(claimed);
        continue;
      }

      try {
        await Fabric.fire('provider.setup_session.email.created:before', {
          ...eventBase,
          setupSession,
          recipient
        });

        await this.sendEmail({
          setupSessionEmail: claimed.setupSessionEmail,
          data: emailData
        });
      } catch (error) {
        await this.markEmailFailed(claimed.setupSessionEmail);
        throw error;
      }

      await Fabric.fire('provider.setup_session.email.created:after', {
        ...eventBase,
        setupSession,
        setupSessionEmail: claimed.setupSessionEmail
      });

      results.push(claimed);
    }

    return results;
  }

  async listProviderSetupSessionEmails(
    d: MetorialFacing<{ providerSetupSession: ProviderSetupSession }>
  ) {
    let scope = await resolveMetorialFacing(d);

    checkTenant(scope, d.providerSetupSession);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.providerSetupSessionEmail.findMany({
            ...opts,
            where: { setupSessionOid: d.providerSetupSession.oid, failedAt: null },
            include: providerSetupSessionEmailInclude
          })
      )
    );
  }

  private assertSessionCanBeEmailed(setupSession: ProviderSetupSession) {
    if (!isAdminSetupSession(setupSession)) {
      throw adminSetupEmailNotSupportedError();
    }

    if (setupSession.status !== 'pending') {
      throw adminSetupEmailSessionInactiveError(setupSession.status);
    }

    if (setupSession.expiresAt <= new Date()) {
      throw adminSetupEmailSessionInactiveError('expired');
    }
  }

  private async resolveRecipients(d: {
    instance: { organizationOid: bigint };
    input: { emails?: string[]; organizationMemberIds?: string[] };
  }) {
    let memberIds = [...new Set(d.input.organizationMemberIds ?? [])];
    let emails = [...new Set((d.input.emails ?? []).map(normalizeEmail).filter(Boolean))];

    if (!memberIds.length && !emails.length) {
      throw adminSetupEmailRecipientsRequiredError();
    }

    if (memberIds.length + emails.length > SETUP_SESSION_EMAIL_MAX_RECIPIENTS) {
      throw adminSetupEmailTooManyRecipientsError(SETUP_SESSION_EMAIL_MAX_RECIPIENTS);
    }

    let recipients = new Map<string, Recipient>();

    if (memberIds.length) {
      let members = await metorialDb.organizationMember.findMany({
        where: {
          id: { in: memberIds },
          organizationOid: d.instance.organizationOid,
          status: 'active'
        },
        include: { user: true, actor: true }
      });

      for (let memberId of memberIds) {
        let member = members.find(m => m.id === memberId);
        let email = normalizeEmail(member?.actor.email || member?.user.email || '');

        if (!member || !email) throw adminSetupEmailMemberNotFoundError(memberId);

        recipients.set(email, { email, organizationMemberId: member.id });
      }
    }

    for (let email of emails) {
      if (recipients.has(email)) continue;

      recipients.set(email, { email, organizationMemberId: null });
    }

    return [...recipients.values()];
  }

  private async assertRecipientCapsNotReached(d: {
    scope: { tenant: { oid: bigint }; environment: { oid: bigint } };
    setupSession: ProviderSetupSession;
    recipients: Recipient[];
  }) {
    let since = new Date(Date.now() - recipientCapWindowMs);

    let sessionRecipients = await this.findRecentRecipients({
      since,
      where: { setupSessionOid: d.setupSession.oid }
    });

    if (
      this.exceedsRecipientCap({
        recentRecipients: sessionRecipients,
        recipients: d.recipients,
        cap: SETUP_SESSION_EMAIL_MAX_RECIPIENTS_PER_DAY
      })
    ) {
      throw adminSetupEmailLimitReachedError(SETUP_SESSION_EMAIL_MAX_RECIPIENTS_PER_DAY);
    }

    let instanceRecipients = await this.findRecentRecipients({
      since,
      where: {
        setupSession: {
          tenantOid: d.scope.tenant.oid,
          environmentOid: d.scope.environment.oid
        }
      }
    });

    if (
      this.exceedsRecipientCap({
        recentRecipients: instanceRecipients,
        recipients: d.recipients,
        cap: SETUP_SESSION_EMAIL_MAX_RECIPIENTS_PER_INSTANCE_PER_DAY
      })
    ) {
      throw adminSetupInstanceEmailLimitReachedError(
        SETUP_SESSION_EMAIL_MAX_RECIPIENTS_PER_INSTANCE_PER_DAY
      );
    }
  }

  private async findRecentRecipients(d: {
    since: Date;
    where: Prisma.ProviderSetupSessionEmailWhereInput;
  }) {
    let rows = await db.providerSetupSessionEmail.findMany({
      where: { ...d.where, failedAt: null, createdAt: { gte: d.since } },
      distinct: ['recipientEmail'],
      select: { recipientEmail: true }
    });

    return new Set(rows.map(row => row.recipientEmail));
  }

  private exceedsRecipientCap(d: {
    recentRecipients: Set<string>;
    recipients: Recipient[];
    cap: number;
  }) {
    let newRecipients = d.recipients.filter(
      recipient => !d.recentRecipients.has(recipient.email)
    );

    return newRecipients.length > 0 && d.recentRecipients.size + newRecipients.length > d.cap;
  }

  // A failed row keeps its slot so its id, and with it the relay idempotency key, survives
  // a retry: the relay may have accepted a send that timed out on our side.
  private async claimThrottleSlot(d: ThrottleSlot) {
    for (let attempt = 0; attempt < maxClaimAttempts; attempt++) {
      let existing = await this.findEmailInBucket(d);

      if (!existing) {
        let created = await this.insertEmailRecord(d);
        if (created) return { setupSessionEmail: created, deduplicated: false };

        continue;
      }

      if (!existing.failedAt) return { setupSessionEmail: existing, deduplicated: true };

      let reclaimed = await this.reclaimFailedEmailRecord({
        ...d,
        setupSessionEmail: existing
      });
      if (reclaimed) return { setupSessionEmail: reclaimed, deduplicated: false };
    }

    throw adminSetupEmailConflictError(d.recipient.email);
  }

  private async insertEmailRecord(d: ThrottleSlot) {
    try {
      return await db.providerSetupSessionEmail.create({
        data: {
          ...getId('providerSetupSessionEmail'),

          recipientEmail: d.recipient.email,
          organizationMemberId: d.recipient.organizationMemberId,
          throttleBucket: d.throttleBucket,

          setupSessionOid: d.setupSession.oid,
          senderActorOid: d.senderActorOid
        },
        include: providerSetupSessionEmailInclude
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) return null;
      throw error;
    }
  }

  private async findEmailInBucket(d: ThrottleSlot) {
    return await db.providerSetupSessionEmail.findUnique({
      where: {
        setupSessionOid_recipientEmail_throttleBucket: {
          setupSessionOid: d.setupSession.oid,
          recipientEmail: d.recipient.email,
          throttleBucket: d.throttleBucket
        }
      },
      include: providerSetupSessionEmailInclude
    });
  }

  private async reclaimFailedEmailRecord(
    d: ThrottleSlot & { setupSessionEmail: ProviderSetupSessionEmailRecord }
  ) {
    let reclaimed = await db.providerSetupSessionEmail.updateMany({
      where: { oid: d.setupSessionEmail.oid, failedAt: { not: null } },
      data: {
        failedAt: null,
        organizationMemberId: d.recipient.organizationMemberId,
        senderActorOid: d.senderActorOid
      }
    });

    if (!reclaimed.count) return null;

    return await db.providerSetupSessionEmail.findUniqueOrThrow({
      where: { oid: d.setupSessionEmail.oid },
      include: providerSetupSessionEmailInclude
    });
  }

  private async sendEmail(d: {
    setupSessionEmail: ProviderSetupSessionEmailRecord;
    data: AdminSetupLinkEmailData;
  }) {
    await adminSetupLinkEmail.send({
      data: d.data,
      to: [d.setupSessionEmail.recipientEmail],
      idempotencyKey: d.setupSessionEmail.id
    });
  }

  private async markEmailFailed(setupSessionEmail: ProviderSetupSessionEmailRecord) {
    try {
      await db.providerSetupSessionEmail.update({
        where: { oid: setupSessionEmail.oid },
        data: { failedAt: new Date() }
      });
    } catch (error) {
      console.error('Failed to mark setup session email as failed', error);
    }
  }
}

export let providerSetupSessionEmailService = Service.create(
  'providerSetupSessionEmail',
  () => new ProviderSetupSessionEmailServiceImpl()
).build();
