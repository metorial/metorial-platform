import { createLock } from '@lowerdeck/lock';
import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { getSentry } from '@lowerdeck/sentry';
import {
  computeSlateConfigSchemaV2Hash,
  type SlateAuthenticationMethod,
  type SlatesAction
} from '@slates/proto';
import { differenceInMinutes } from 'date-fns';
import semver from 'semver';
import { db } from '../../db';
import { env } from '../../env';
import { getId, snowflake } from '../../id';
import { getStackError, getStackResultsOrThrow } from '../../lib/invocation/error';
import type { InvocationError } from '../../lib/invocation/types';
import {
  buildDiscoveredSpecificationHashes,
  dedupeDiscoveredItems
} from '../../lib/specificationHash';
import { slateInvocationService } from '../../services';

let Sentry = getSentry();

let deepFreezeJson = <Value>(value: Value): Value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value as Record<string, unknown>).forEach(deepFreezeJson);
    Object.freeze(value);
  }
  return value;
};

let normalizeDiscoveredDocs = (docs: unknown): PrismaJson.SlateDocReferences => {
  if (!Array.isArray(docs)) return [];

  return docs
    .filter(
      (doc): doc is { name: string; url: string; type?: string } =>
        !!doc &&
        typeof doc === 'object' &&
        typeof (doc as any).name === 'string' &&
        typeof (doc as any).url === 'string'
    )
    .map(doc => ({
      ...(typeof doc.type === 'string' ? { type: doc.type } : {}),
      name: doc.name,
      url: doc.url
    }));
};

let syncSpecificationActions = async (d: {
  specificationOid: bigint;
  actions: Array<{ oid: bigint }>;
}) => {
  let actionOids = d.actions.map(action => action.oid);

  await db.slateSpecificationAction.deleteMany({
    where: {
      specificationOid: d.specificationOid,
      actionOid: actionOids.length > 0 ? { notIn: actionOids } : undefined
    }
  });

  if (actionOids.length === 0) return;

  await db.slateSpecificationAction.createMany({
    skipDuplicates: true,
    data: actionOids.map(actionOid => ({
      oid: snowflake.nextId(),
      actionOid,
      specificationOid: d.specificationOid
    }))
  });
};

let syncSpecificationAuthMethods = async (d: {
  specificationOid: bigint;
  authMethods: Array<{ oid: bigint }>;
}) => {
  let authMethodOids = d.authMethods.map(authMethod => authMethod.oid);

  await db.slateSpecificationAuthMethod.deleteMany({
    where: {
      specificationOid: d.specificationOid,
      authMethodOid: authMethodOids.length > 0 ? { notIn: authMethodOids } : undefined
    }
  });

  if (authMethodOids.length === 0) return;

  await db.slateSpecificationAuthMethod.createMany({
    skipDuplicates: true,
    data: authMethodOids.map(authMethodOid => ({
      oid: snowflake.nextId(),
      authMethodOid,
      specificationOid: d.specificationOid
    }))
  });
};

let syncSpecificationConfigSchema = async (d: {
  specificationOid: bigint;
  configSchemaOid: bigint;
}) => {
  await db.slateSpecificationConfigSchema.deleteMany({
    where: {
      specificationOid: d.specificationOid,
      configSchemaOid: { not: d.configSchemaOid }
    }
  });

  await db.slateSpecificationConfigSchema.upsert({
    where: {
      specificationOid_configSchemaOid: {
        specificationOid: d.specificationOid,
        configSchemaOid: d.configSchemaOid
      }
    },
    create: {
      oid: snowflake.nextId(),
      specificationOid: d.specificationOid,
      configSchemaOid: d.configSchemaOid
    },
    update: {}
  });
};

let buildActionUpsertData = async (d: {
  actions: SlatesAction[];
  slateOid: bigint;
  specificationOid: bigint;
  identifierBase: string;
  actionHashes: string[];
}) =>
  d.actions.map((action, index) => {
    let hash = d.actionHashes[index]!;
    let identifier = `${d.identifierBase}::action::${action.id}::${hash}`;

    return {
      ...getId('slateAction'),
      slateOid: d.slateOid,
      mostRecentSpecificationOid: d.specificationOid,

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
  });

let buildAuthMethodUpsertData = async (d: {
  authMethods: SlateAuthenticationMethod[];
  slateOid: bigint;
  specificationOid: bigint;
  identifierBase: string;
  authMethodHashes: string[];
}) =>
  d.authMethods.map((method, index) => {
    let hash = d.authMethodHashes[index]!;
    let identifier = `${d.identifierBase}::auth_method::${method.id}::${hash}`;

    return {
      ...getId('slateAuthMethod'),
      slateOid: d.slateOid,
      mostRecentSpecificationOid: d.specificationOid,

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
  });

export let discoverSlateQueue = createQueue<{ versionId: string; deploymentId?: string }>({
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

export let getSlateDiscoveryDeploymentTarget = (d: {
  version: {
    providerDeploymentInfo: PrismaJson.SlateDeploymentProviderDeploymentInfo;
    activeDeploymentOid: bigint | null;
  };
  stagedDeployment?: {
    providerDeploymentInfo: PrismaJson.SlateDeploymentProviderDeploymentInfo;
    oid: bigint;
  } | null;
}) => {
  let providerDeploymentInfo =
    d.stagedDeployment?.providerDeploymentInfo ?? d.version.providerDeploymentInfo;
  let activeDeploymentOid = d.stagedDeployment?.oid ?? d.version.activeDeploymentOid;

  if (!providerDeploymentInfo || !activeDeploymentOid) return null;

  return { providerDeploymentInfo, activeDeploymentOid };
};

export let shouldPreserveActiveVersionOnStagedDiscoveryFailure = (d: {
  version: {
    status: string;
    activeDeploymentOid: bigint | null;
  };
  stagedDeployment?: { oid: bigint } | null;
}) =>
  !!d.stagedDeployment &&
  d.version.status === 'active' &&
  d.version.activeDeploymentOid !== d.stagedDeployment.oid;

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
    let stagedDeployment = data.deploymentId
      ? await db.slateDeployment.findFirst({
          where: {
            id: data.deploymentId,
            slateVersionOid: version.oid
          }
        })
      : null;
    if (data.deploymentId && !stagedDeployment) throw new QueueRetryError();

    let target = getSlateDiscoveryDeploymentTarget({ version, stagedDeployment });
    if (!target) return;

    if (
      !data.deploymentId &&
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
        deploymentTarget: {
          providerDeploymentInfo: target.providerDeploymentInfo,
          activeDeploymentOid: target.activeDeploymentOid
        },
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
          deploymentId: data.deploymentId,
          invocationOid: invocation.oid,
          error
        });
        return;
      }

      let [providerInfo, configSchema, authMethods, actions] =
        getStackResultsOrThrow(stackResult);

      let discoveredAuthMethods = dedupeDiscoveredItems(authMethods.authenticationMethods, {
        entity: 'auth_methods',
        slateId: slate.id,
        versionId: version.id
      });
      let discoveredActions = dedupeDiscoveredItems(actions.actions, {
        entity: 'actions',
        slateId: slate.id,
        versionId: version.id,
        getKey: action => `${action.type}:${action.id}`
      });

      let providerDocs = normalizeDiscoveredDocs(providerInfo.docs);
      let configSchemaDocs = normalizeDiscoveredDocs(configSchema.docs);
      let configSchemaWire = deepFreezeJson(configSchema.schema);
      if (
        configSchemaWire.version === 2 &&
        configSchemaWire.hash !== computeSlateConfigSchemaV2Hash(configSchemaWire)
      ) {
        throw new Error('Provider returned a stale or fabricated config schema hash');
      }
      let providerSupportsConfigV2 = providerInfo.capabilities?.configSchemaV2 === true;
      if (configSchemaWire.version === 2 && !providerSupportsConfigV2) {
        throw new Error(
          'Provider returned config schema v2 without configSchemaV2 capability'
        );
      }
      if (configSchemaWire.version === 1 && providerSupportsConfigV2) {
        throw new Error('Provider advertised configSchemaV2 but returned config schema v1');
      }
      if (
        configSchemaWire.version === 2 &&
        Object.values(configSchemaWire.fields).some(field => field.visibility === 'secret') &&
        providerInfo.capabilities?.scopedInvocationGrantV1 !== true
      ) {
        throw new Error('Secret-bearing config schema requires scopedInvocationGrantV1');
      }
      let configJsonSchema = configSchemaWire.jsonSchema;

      let discoveryHashes = await buildDiscoveredSpecificationHashes({
        providerInfo: {
          protocol: providerInfo.protocol,
          provider: {
            ...providerInfo.provider,
            capabilities: providerInfo.capabilities
          },
          docs: providerDocs
        },
        configSchema: {
          schema: configSchemaWire,
          docs: configSchemaDocs
        },
        authMethods: discoveredAuthMethods,
        actions: discoveredActions
      });
      let identifierBase = `slate::spec::${slate.id}`;
      let specificationIdentifier = `${identifierBase}::${discoveryHashes.specificationHash}`;

      let specificationData = {
        name: providerInfo.provider.name,
        key: providerInfo.provider.id,
        protocolVersion: providerInfo.protocol,

        providerInfo: {
          ...providerInfo.provider,
          capabilities: providerInfo.capabilities
        },
        providerDocs,
        configSchema: configJsonSchema,
        configSchemaDocs,
        authMethods: discoveredAuthMethods,
        actions: discoveredActions
      };
      let specification = await db.slateSpecification.upsert({
        where: {
          identifier: specificationIdentifier
        },
        create: {
          ...getId('slateSpecification'),
          hash: discoveryHashes.specificationHash,
          identifier: specificationIdentifier,
          slateOid: slate.oid,

          mostRecentVersionOid: version.oid,

          ...specificationData
        },
        update: specificationData
      });

      let actionUpsertData = await buildActionUpsertData({
        actions: discoveredActions,
        slateOid: slate.oid,
        specificationOid: specification.oid,
        identifierBase,
        actionHashes: discoveryHashes.actionHashes
      });
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

      await syncSpecificationActions({
        specificationOid: specification.oid,
        actions: upsertedActions
      });

      let authMethodUpsertData = await buildAuthMethodUpsertData({
        authMethods: discoveredAuthMethods,
        slateOid: slate.oid,
        specificationOid: specification.oid,
        identifierBase,
        authMethodHashes: discoveryHashes.authMethodHashes
      });
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

      await syncSpecificationAuthMethods({
        specificationOid: specification.oid,
        authMethods: upsertedAuthMethods
      });

      let configIdentifier = `${identifierBase}::config::${discoveryHashes.configSchemaHash}`;

      let upsertedConfig = await db.slateConfigSchema.upsert({
        where: {
          identifier: configIdentifier
        },
        create: {
          ...getId('slateConfigSchema'),
          mostRecentSpecificationOid: specification.oid,
          slateOid: slate.oid,

          hash: discoveryHashes.configSchemaHash,
          identifier: configIdentifier,

          version: configSchemaWire.version,
          descriptorHash: configSchemaWire.version === 2 ? configSchemaWire.hash : null,
          fields: configSchemaWire.version === 2 ? configSchemaWire.fields : {},
          compatibility:
            configSchemaWire.version === 1 ? configSchemaWire.compatibility : null,
          schema: configJsonSchema,
          docs: configSchemaDocs
        },
        update: {
          version: configSchemaWire.version,
          descriptorHash: configSchemaWire.version === 2 ? configSchemaWire.hash : null,
          fields: configSchemaWire.version === 2 ? configSchemaWire.fields : {},
          compatibility:
            configSchemaWire.version === 1 ? configSchemaWire.compatibility : null,
          schema: configJsonSchema,
          docs: configSchemaDocs
        }
      });

      await syncSpecificationConfigSchema({
        specificationOid: specification.oid,
        configSchemaOid: upsertedConfig.oid
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

      let versionUpdateData = {
        status: 'active' as const,
        specificationOid: specification.oid,
        lastDiscoveredAt: new Date(),
        ...(stagedDeployment
          ? {
              providerDeploymentInfo: target.providerDeploymentInfo,
              activeDeploymentOid: target.activeDeploymentOid
            }
          : {})
      };

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
          if (
            stagedDeployment &&
            version.activeDeploymentOid &&
            version.activeDeploymentOid !== target.activeDeploymentOid
          ) {
            await db.slateDeployment.updateMany({
              where: { oid: version.activeDeploymentOid },
              data: { runtimeIdentityRevokedAt: new Date() }
            });
          }
          await db.slateVersion.updateMany({
            where: { oid: version.oid },
            data: versionUpdateData
          });

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
      } else {
        await db.$transaction(async tx => {
          if (
            stagedDeployment &&
            version.activeDeploymentOid &&
            version.activeDeploymentOid !== target.activeDeploymentOid
          ) {
            await tx.slateDeployment.updateMany({
              where: { oid: version.activeDeploymentOid },
              data: { runtimeIdentityRevokedAt: new Date() }
            });
          }
          await tx.slateVersion.updateMany({
            where: { oid: version.oid },
            data: versionUpdateData
          });
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
        deploymentId: data.deploymentId,
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
  deploymentId?: string;
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
  let stagedDeployment = data.deploymentId
    ? await db.slateDeployment.findFirst({
        where: {
          id: data.deploymentId,
          slateVersionOid: version.oid
        }
      })
    : null;
  let isFailedStagedRedeployOfActiveVersion =
    shouldPreserveActiveVersionOnStagedDiscoveryFailure({ version, stagedDeployment });

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

  if (stagedDeployment) {
    await db.slateDeployment.updateMany({
      where: { oid: stagedDeployment.oid },
      data: {
        status: 'failed',
        errorCode: data.error.code,
        errorMessage: `Discovery failed: [${data.error.code}] - ${data.error.message}`
      }
    });
  }

  if (!isFailedStagedRedeployOfActiveVersion) {
    await db.slateVersion.updateMany({
      where: { oid: version.oid },
      data: {
        status: 'discovery_failed',
        lastDiscoveredAt: new Date()
      }
    });
  }
});
