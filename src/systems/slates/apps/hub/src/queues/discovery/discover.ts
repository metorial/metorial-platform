import { canonicalize } from '@lowerdeck/canonicalize';
import { Hash } from '@lowerdeck/hash';
import { createLock } from '@lowerdeck/lock';
import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { getSentry } from '@lowerdeck/sentry';
import { differenceInMinutes } from 'date-fns';
import semver from 'semver';
import { db } from '../../db';
import { env } from '../../env';
import { getId, snowflake } from '../../id';
import { getStackError, getStackResultsOrThrow } from '../../lib/invocation/error';
import type { InvocationError } from '../../lib/invocation/types';
import { slateInvocationService } from '../../services';

let Sentry = getSentry();

export let discoverSlateQueue = createQueue<{ versionId: string }>({
  name: 'shub/dis/sing',
  redisUrl: env.service.REDIS_URL,
  workerOpts: {
    limiter: {
      max: 5,
      duration: 10_000
    },
    concurrency: 2
  }
});

let discoverLock = createLock({
  name: 'shub/dis/lock',
  redisUrl: env.service.REDIS_URL
});

export let discoverSlateQueueProcessor = discoverSlateQueue.process(async data => {
  let outerVersion = await db.slateVersion.findFirst({
    where: { id: data.versionId }
  });
  if (!outerVersion) throw new QueueRetryError();

  return discoverLock.usingLock(String(outerVersion.slateOid), async () => {
    let version = await db.slateVersion.findFirst({
      where: { id: data.versionId },
      include: { activeDeployment: true, slate: { include: { currentVersion: true } } }
    });
    if (!version) throw new QueueRetryError();
    if (!version.providerDeploymentInfo || !version.activeDeploymentOid) return;

    if (
      version.lastDiscoveredAt &&
      Math.abs(differenceInMinutes(new Date(), version.lastDiscoveredAt)) < 10
    ) {
      console.log(
        `Skipping discovery for slate version ${version.id} (${version.version}) - recently discovered`
      );
      // Recently discovered, skip
      return;
    }

    console.log(`Discovering slate version ${version.id} (${version.version})`);

    let slate = version.slate;

    await db.slateEvent.create({
      data: {
        ...getId('slateEvent'),
        type: 'discovery_started',
        message: `Discovery started for version ${version.version}`,
        slateOid: slate.oid,
        slateVersionOid: version.oid
      }
    });

    try {
      let stack = await slateInvocationService.createInvocation({
        slateVersion: version,
        participants: [] // Only the hub
      });

      let stackResult = await Promise.all([
        slateInvocationService.getProviderInfo({ stack }),
        slateInvocationService.getConfigSchema({ stack }),
        // slateInvocationService.getDefaultConfig({ stack }),
        slateInvocationService.listAuthMethods({ stack }),
        slateInvocationService.listActions({ stack })
      ]);

      let invocation = stackResult[0].invocation;
      let error = getStackError(stackResult);

      if (error) {
        console.error('Discovery error:', error);

        await discoverSlateErrorQueue.add({
          versionId: version.id,
          invocationOid: invocation.oid,
          error
        });
        return;
      }

      let [providerInfo, configSchema, authMethods, actions] =
        getStackResultsOrThrow(stackResult);

      let hash = await Hash.sha256(
        canonicalize({
          providerInfo,
          configSchema,
          authMethods,
          actions
        })
      );
      let identifierBase = `slate::spec::${slate.id}`;
      let specificationIdentifier = `${identifierBase}::${hash}`;

      let specificationData = {
        name: providerInfo.provider.name,
        key: providerInfo.provider.id,
        protocolVersion: providerInfo.protocol,

        providerInfo: providerInfo.provider,
        configSchema: configSchema.schema,
        authMethods: authMethods.authenticationMethods,
        actions: actions.actions
      };
      let specification = await db.slateSpecification.upsert({
        where: {
          identifier: specificationIdentifier
        },
        create: {
          ...getId('slateSpecification'),
          hash,
          identifier: specificationIdentifier,
          slateOid: slate.oid,

          mostRecentVersionOid: version.oid,

          ...specificationData
        },
        update: specificationData
      });

      let actionUpsertData = await Promise.all(
        specification.actions.map(async action => {
          let hash = await Hash.sha256(
            canonicalize({
              id: action.id,
              type: action.type,
              input: action.inputSchema,
              output: action.outputSchema,
              invocationType:
                action.type === 'action.trigger' ? action.invocation.type : undefined
            })
          );
          let identifier = `${identifierBase}::action::${action.id}::${hash}`;

          return {
            ...getId('slateAction'),
            slateOid: slate.oid,
            mostRecentSpecificationOid: specification.oid,

            type: {
              'action.tool': 'tool' as const,
              'action.trigger': 'trigger' as const
            }[action.type],

            hash,
            identifier,

            spec: action,

            key: action.id,
            name: action.name
          };
        })
      );
      await db.slateAction.createManyAndReturn({
        skipDuplicates: true,
        data: actionUpsertData
      });
      let upsertedActions = await db.slateAction.findMany({
        where: {
          slateOid: slate.oid,
          identifier: {
            in: actionUpsertData.map(a => a.identifier)
          }
        }
      });

      await db.slateSpecificationAction.createMany({
        skipDuplicates: true,
        data: upsertedActions.map(action => ({
          oid: snowflake.nextId(),
          actionOid: action.oid,
          specificationOid: specification.oid
        }))
      });

      let authMethodUpsertData = await Promise.all(
        specification.authMethods.map(async method => {
          let hash = await Hash.sha256(
            canonicalize({
              id: method.id,
              type: method.type,
              scopes: method.scopes?.map(s => s.id)?.sort(),
              output: method.outputSchema
            })
          );
          let identifier = `${identifierBase}::auth_method::${method.id}::${hash}`;

          return {
            ...getId('slateAuthMethod'),
            slateOid: slate.oid,
            mostRecentSpecificationOid: specification.oid,

            type: {
              'auth.oauth': 'oauth' as const,
              'auth.token': 'token' as const,
              'auth.service_account': 'service_account' as const,
              'auth.custom': 'custom' as const
            }[method.type],

            hash,
            identifier,

            spec: method,

            key: method.id,
            name: method.name
          };
        })
      );
      await db.slateAuthMethod.createManyAndReturn({
        skipDuplicates: true,
        data: authMethodUpsertData
      });
      let upsertedAuthMethods = await db.slateAuthMethod.findMany({
        where: {
          slateOid: slate.oid,
          identifier: {
            in: authMethodUpsertData.map(a => a.identifier)
          }
        }
      });

      await db.slateSpecificationAuthMethod.createMany({
        skipDuplicates: true,
        data: upsertedAuthMethods.map(authMethod => ({
          oid: snowflake.nextId(),
          authMethodOid: authMethod.oid,
          specificationOid: specification.oid
        }))
      });

      let configHash = await Hash.sha256(canonicalize({ configSchema: configSchema.schema }));
      let configIdentifier = `${identifierBase}::config::${configHash}`;

      let upsertedConfig = await db.slateConfigSchema.upsert({
        where: {
          identifier: configIdentifier
        },
        create: {
          ...getId('slateConfigSchema'),
          mostRecentSpecificationOid: specification.oid,
          slateOid: slate.oid,

          hash: configHash,
          identifier: configIdentifier,

          schema: configSchema.schema
        },
        update: {
          schema: configSchema.schema
        }
      });
      await db.slateSpecificationConfigSchema.upsert({
        where: {
          specificationOid_configSchemaOid: {
            specificationOid: specification.oid,
            configSchemaOid: upsertedConfig.oid
          }
        },
        create: {
          oid: snowflake.nextId(),
          specificationOid: specification.oid,
          configSchemaOid: upsertedConfig.oid
        },
        update: {}
      });

      await db.slateVersionDiscovery.createMany({
        data: {
          ...getId('slateVersionDiscovery'),
          slateVersionOid: version.oid,
          specificationOid: specification.oid,
          invocationOid: invocation.oid,
          status: 'succeeded'
        }
      });

      await db.slateEvent.createMany({
        data: {
          ...getId('slateEvent'),
          type: 'discovery_succeeded',
          message: `Discovery succeeded for version ${version.version}`,
          slateOid: slate.oid,
          slateVersionOid: version.oid
        }
      });

      await db.slateVersion.updateMany({
        where: { oid: version.oid },
        data: {
          status: 'active',
          specificationOid: specification.oid,
          lastDiscoveredAt: new Date()
        }
      });

      if (version.specificationOid && version.specificationOid !== specification.oid) {
        await db.slateSpecificationChange.create({
          data: {
            ...getId('slateSpecificationChange'),
            type: 'same_version',
            slateOid: slate.oid,
            fromVersionOid: version.oid,
            toVersionOid: version.oid,
            fromSpecificationOid: version.specificationOid,
            toSpecificationOid: specification.oid
          }
        });
      }

      if (
        version.willBeCurrent &&
        (!slate.currentVersion || semver.gt(version.version, slate.currentVersion.version))
      ) {
        await db.$transaction(async db => {
          await db.slateSpecification.updateMany({
            where: { oid: specification.oid },
            data: { mostRecentVersionOid: version.oid }
          });

          await db.slateAction.updateMany({
            where: { slateSpecifications: { some: { specificationOid: specification.oid } } },
            data: { mostRecentSpecificationOid: specification.oid }
          });
          await db.slateAuthMethod.updateMany({
            where: { slateSpecifications: { some: { specificationOid: specification.oid } } },
            data: { mostRecentSpecificationOid: specification.oid }
          });
          await db.slateConfigSchema.updateMany({
            where: { slateSpecifications: { some: { specificationOid: specification.oid } } },
            data: { mostRecentSpecificationOid: specification.oid }
          });

          await db.slateVersion.updateMany({
            where: {
              slateOid: slate.oid,
              oid: { not: version.oid }
            },
            data: { isCurrent: false }
          });

          await db.slateVersion.updateMany({
            where: { oid: version.oid },
            data: { isCurrent: true }
          });

          await db.slate.update({
            where: { id: slate.id },
            data: { currentVersionOid: version.oid }
          });

          await db.slateEvent.create({
            data: {
              ...getId('slateEvent'),
              type: 'version_set_as_current',
              message: `Version ${version.version} activated as current version`,
              slateOid: slate.oid,
              slateVersionOid: version.oid
            }
          });

          if (
            slate.currentVersion?.specificationOid &&
            slate.currentVersion.specificationOid !== specification.oid
          ) {
            await db.slateSpecificationChange.create({
              data: {
                ...getId('slateSpecificationChange'),
                type: 'between_versions',
                slateOid: slate.oid,
                fromVersionOid: slate.currentVersion.oid,
                toVersionOid: version.oid,
                fromSpecificationOid: slate.currentVersion.specificationOid,
                toSpecificationOid: specification.oid
              }
            });
          }
        });
      }

      await db.changeNotification.create({
        data: {
          ...getId('changeNotification'),
          type: 'slate_version_created',

          slateOid: slate.oid,
          slateVersionOid: version.oid,

          slateId: slate.id,
          slateVersionId: version.id
        }
      });
    } catch (e) {
      console.error('Error during discovery:', e);
      Sentry.captureException(e);

      await discoverSlateErrorQueue.add({
        versionId: version.id,
        error: {
          code: 'discovery/internal_error',
          message: `Internal error during discovery: ${(e as Error).message}`
        }
      });
    }
  });
});

let discoverSlateErrorQueue = createQueue<{
  versionId: string;
  invocationOid?: bigint;
  error: InvocationError;
}>({
  name: 'shub/dis/err',
  redisUrl: env.service.REDIS_URL
});

export let discoverSlateErrorQueueProcessor = discoverSlateErrorQueue.process(async data => {
  let version = await db.slateVersion.findFirst({
    where: { id: data.versionId },
    include: { slate: true }
  });
  if (!version) throw new QueueRetryError();

  await db.slateEvent.create({
    data: {
      ...getId('slateEvent'),
      type: 'discovery_failed',
      message: `Discovery failed for version ${version.version}`,
      slateOid: version.slate.oid,
      slateVersionOid: version.oid
    }
  });

  await db.slateVersionDiscovery.create({
    data: {
      ...getId('slateVersionDiscovery'),
      slateVersionOid: version.oid,
      status: 'failed',
      invocationOid: data.invocationOid,
      errorCode: data.error.code,
      errorMessage: `Discovery failed: [${data.error.code}] - ${data.error.message}`
    }
  });

  await db.slateVersion.updateMany({
    where: { oid: version.oid },
    data: {
      status: 'discovery_failed',
      lastDiscoveredAt: new Date()
    }
  });
});
