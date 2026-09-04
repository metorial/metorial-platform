import { createQueue } from '@lowerdeck/queue';
import type { SlatesTriggerRoutingMatcher } from '@slates/proto';
import { db } from '../../db';
import { env } from '../../env';
import { getId, snowflake } from '../../id';
import { getActiveSlateVersion } from '../../lib/slateVersion';
import { secretService } from '../../services/secret';
import { slateInvocationService } from '../../services/slateInvocation';
import { TRIGGER_POLL_MIN_INTERVAL_SECONDS } from './_config';
import { createTriggerRegistrationInstanceError } from './_instanceError';
import { triggerWebhookTargetSearchQueue } from './webhookTargetSearch';

export let triggerRegistrationInstanceSetupQueue = createQueue<{
  triggerRegistrationInstanceId: string;
}>({
  name: 'shub/trg/inst/setup',
  redisUrl: env.service.REDIS_URL
});

export let triggerRegistrationInstanceSetupQueueProcessor =
  triggerRegistrationInstanceSetupQueue.process(async data => {
    let instance = await db.triggerRegistrationInstance.findUnique({
      where: { id: data.triggerRegistrationInstanceId },
      include: {
        triggerGroup: true,
        triggerRegistration: {
          include: {
            tenant: true,
            slate: true,
            instance: true,
            instanceConfig: true,
            authConfig: { include: { authMethod: true } }
          }
        },
        schedule: true
      }
    });
    if (!instance || instance.schedule) return;

    let invocation = instance.triggerGroup.spec.invocation;

    if (invocation.type === 'polling') {
      let intervalSeconds = Math.max(
        invocation.intervalSeconds,
        TRIGGER_POLL_MIN_INTERVAL_SECONDS
      );

      await db.triggerRegistrationSchedule.create({
        data: {
          ...getId('triggerRegistrationSchedule'),
          triggerRegistrationInstanceOid: instance.oid,
          intervalSeconds,
          firstRunAt: null,
          lastRunAt: null,
          nextRunAt: new Date()
        }
      });

      return;
    }

    if (invocation.registration.mode === 'auto') {
      await triggerWebhookTargetSearchQueue.add(
        { triggerRegistrationInstanceId: instance.id, pageToken: null },
        { id: `${instance.id}:first` }
      );
    } else {
      let registration = instance.triggerRegistration;
      let authConfig = registration.authConfig;

      let nonEmpty = (value: unknown) =>
        Array.isArray(value) && value.length > 0
          ? (value as SlatesTriggerRoutingMatcher[])
          : null;

      let routingMatchers = nonEmpty(instance.routingMatchers);

      if (!routingMatchers) {
        routingMatchers = nonEmpty(authConfig?.routingMatchers);

        if (routingMatchers) {
          await db.triggerRegistrationInstance.update({
            where: { oid: instance.oid },
            data: { routingMatchers }
          });
        } else {
          let auth: { authenticationMethodId: string; data: Record<string, any> } | null =
            null;
          if (authConfig) {
            let decrypted = await secretService.DANGEROUSLY_decryptSecret({
              secretOid: authConfig.secretOid,
              purpose: 'slate_authentication_configuration',
              tenant: registration.tenant,
              note: `trigger-routing-matchers:${instance.id}`
            });
            auth = {
              authenticationMethodId: authConfig.authMethod.key,
              data: decrypted.output ?? decrypted.input ?? {}
            };
          }

          let version = await getActiveSlateVersion({
            slate: registration.slate,
            instance: registration.instance
          });
          let stack = await slateInvocationService.createInvocationWithState({
            participants: [],
            slateVersion: version,
            tenant: registration.tenant,
            session: { id: instance.id, state: {} },
            config: registration.instanceConfig.value ?? {},
            auth
          });

          let matchersResult = await slateInvocationService.getRoutingMatchers({
            stack,
            triggerGroupId: instance.triggerGroup.key
          });

          if (matchersResult.status === 'error') {
            await createTriggerRegistrationInstanceError({
              triggerRegistrationInstanceOid: instance.oid,
              code: 'routing_matchers_fetch_failed',
              message: `We couldn't fetch routing matchers: ${matchersResult.error.message}`
            });
          } else {
            routingMatchers = matchersResult.data.matchers;
            await db.triggerRegistrationInstance.update({
              where: { oid: instance.oid },
              data: { routingMatchers }
            });
          }
        }
      }

      let candidates = await db.slateWebhookRegistration.findMany({
        where: {
          triggerGroupOid: instance.triggerGroup.oid,
          status: 'active',
          OR: [{ owner: 'tenant', tenantOid: registration.tenantOid }, { owner: 'global' }]
        },
        include: { authMethods: true, oauthCredentials: true }
      });

      let findMatch = (pool: typeof candidates) => {
        let byCredential = () =>
          authConfig?.oauthCredentialsOid
            ? pool.find(
                c =>
                  c.authRouting === 'restricted_credential' &&
                  c.oauthCredentials.some(
                    oc => oc.oauthCredentialsOid === authConfig.oauthCredentialsOid
                  )
              )
            : undefined;
        let byMethod = () =>
          authConfig
            ? pool.find(
                c =>
                  c.authRouting === 'restricted_method' &&
                  c.authMethods.some(am => am.authMethodOid === authConfig.authMethodOid)
              )
            : undefined;
        let byAny = () => pool.find(c => c.authRouting === 'any');
        return byCredential() || byMethod() || byAny() || null;
      };

      let match =
        findMatch(candidates.filter(c => c.owner === 'tenant')) ||
        findMatch(candidates.filter(c => c.owner === 'global'));

      if (!match) {
        await createTriggerRegistrationInstanceError({
          triggerRegistrationInstanceOid: instance.oid,
          code: 'no_matching_webhook_registration',
          message:
            'No existing webhook registration matches this provider instance yet - ask an admin to set one up.'
        });
        return;
      }

      try {
        await db.triggerRegistrationWebhook.create({
          data: {
            oid: snowflake.nextId(),
            triggerRegistrationInstanceOid: instance.oid,
            webhookRegistrationOid: match.oid
          }
        });
      } catch (err: any) {
        if (err.code !== 'P2002') throw err;
      }
    }
  });
