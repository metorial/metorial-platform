import { generateCode } from '@lowerdeck/id';
import { slugify } from '@lowerdeck/slugify';
import { createShuttleClient } from '@metorial-platform-systems/shuttle-client';
import { withTimeout } from '@metorial-subspace/connection-utils/src/withTimeout';
import {
  getId,
  snowflake,
  type Backend,
  type Environment,
  type PrismaClient,
  type Provider,
  type ProviderConfig,
  type ProviderDeployment,
  type ProviderSpecification,
  type ProviderVariant,
  type ProviderVersion,
  type ShuttleServer,
  type ShuttleServerVersion,
  type Solution,
  type Tenant
} from '@metorial-subspace/db';
import { providerDeploymentService } from '@metorial-subspace/module-deployment';
import {
  providerDeploymentConfigPairInternalService,
  providerInternalService,
  providerSpecificationInternalService,
  providerVersionInternalService,
  publisherInternalService
} from '@metorial-subspace/module-provider-internal';
import { getBackend } from '@metorial-subspace/provider';
import { withShuttleRetry } from '@metorial-subspace/provider-shuttle/src/shuttleRetry';
import { retryUntilTimeout } from '@metorial-subspace/retry-utils';
import { createHash } from 'node:crypto';
import { EnvironmentFixtures } from './environmentFixtures';
import { SolutionFixtures } from './solutionFixtures';
import { TenantFixtures } from './tenantFixtures';

type RemoteMcpProviderResult = {
  solution: Solution;
  tenant: Tenant;
  environment: Environment;
  backend: Backend;
  shuttleServer: ShuttleServer;
  shuttleServerVersion: ShuttleServerVersion;
  provider: Provider;
  providerVersion: ProviderVersion;
  specification: ProviderSpecification | null;
  providerDeployment: ProviderDeployment;
  providerConfig: ProviderConfig;
};

type RemoteMcpProviderOptions = {
  remoteUrl: string;
  protocol?: 'sse' | 'streamable_http';
  solution?: Solution;
  tenant?: Tenant;
  environment?: Environment;
  requireAtLeastOneTool?: boolean;
  allowDiscoveryFailure?: boolean;
};

const DISCOVERY_TIMEOUT_MS = 30000;
const DISCOVERY_CALL_TIMEOUT_MS = 10000;
const REMOTE_SERVER_NAME_EXACT = process.env.TEST_MCP_REMOTE_SERVER_NAME;
const REMOTE_SERVER_NAME_PREFIX =
  process.env.TEST_MCP_REMOTE_SERVER_NAME_PREFIX ?? 'Subspace Test Remote MCP';
const REMOTE_SERVER_RUN_ID =
  process.env.TEST_MCP_REMOTE_SERVER_RUN_ID ?? generateCode(16).toLowerCase();

const resolveRemoteServerName = (opts: {
  remoteUrl: string;
  protocol: 'sse' | 'streamable_http';
}) => {
  if (REMOTE_SERVER_NAME_EXACT) return REMOTE_SERVER_NAME_EXACT;

  let baseName =
    slugify(`${REMOTE_SERVER_NAME_PREFIX}-${REMOTE_SERVER_RUN_ID}`) || 'subspace-remote-mcp';
  let scopedHash = createHash('sha1')
    .update(`${opts.remoteUrl}|${opts.protocol}`)
    .digest('hex')
    .slice(0, 10);
  return `${baseName.slice(0, 80)}-${scopedHash}`;
};

const mcpRemoteType = {
  name: 'MCP',
  attributes: {
    provider: 'metorial-shuttle',
    backend: 'mcp.remote',
    triggers: { status: 'disabled' },
    auth: { status: 'disabled' },
    config: { status: 'disabled' }
  }
} as const;

const getShuttleClient = () => {
  let endpoint = process.env.SHUTTLE_URL;
  if (!endpoint) {
    throw new Error('SHUTTLE_URL is required to create a remote MCP provider');
  }
  return createShuttleClient({ endpoint });
};

const ensureBackend = async (db: PrismaClient): Promise<Backend> => {
  let ids = getId('backend');
  return db.backend.upsert({
    where: { type: 'shuttle' },
    create: {
      ...ids,
      type: 'shuttle',
      identifier: 'shuttle',
      name: 'Shuttle'
    },
    update: {}
  });
};

const ensureShuttleTenant = async (db: PrismaClient, tenant: Tenant) => {
  if (tenant.shuttleTenantId && tenant.shuttleTenantIdentifier) {
    return {
      id: tenant.shuttleTenantId,
      identifier: tenant.shuttleTenantIdentifier
    };
  }

  let shuttleClient = getShuttleClient();
  let shuttleTenant = await withShuttleRetry(
    () =>
      shuttleClient.tenant.upsert({
        identifier: tenant.identifier,
        name: tenant.name
      }),
    { endpoint: process.env.SHUTTLE_URL }
  );

  let updatedTenant = await db.tenant.update({
    where: { oid: tenant.oid },
    data: {
      shuttleTenantId: shuttleTenant.id,
      shuttleTenantIdentifier: shuttleTenant.identifier
    }
  });

  return {
    id: updatedTenant.shuttleTenantId!,
    identifier: updatedTenant.shuttleTenantIdentifier!
  };
};

const waitForDeploymentVersion = async (opts: {
  tenantId: string;
  deploymentId: string;
  timeoutMs?: number;
}) => {
  let timeoutMs = opts.timeoutMs ?? 30000;
  let shuttleClient = getShuttleClient();

  return retryUntilTimeout({
    timeoutMs,
    intervalMs: 500,
    label: 'Timed out waiting for shuttle server version',
    fn: async () => {
      let deployment = await shuttleClient.serverDeployment.get({
        tenantId: opts.tenantId,
        serverDeploymentId: opts.deploymentId
      });

      if (deployment.status === 'failed') {
        throw new Error('Shuttle deployment failed while creating remote MCP server');
      }

      if (deployment.status === 'succeeded' && deployment.serverVersionId) {
        return deployment.serverVersionId;
      }

      return null;
    }
  });
};

// Syncs Shuttle server/version records into the local Subspace DB
// so domain services can reference them via foreign keys
const ensureShuttleServerRecords = async (
  db: PrismaClient,
  d: {
    serverId: string;
    serverType: 'container' | 'function' | 'remote';
    tenantId?: string | null;
    versionId: string;
  }
) => {
  let shuttleServer = await db.shuttleServer.upsert({
    where: { id: d.serverId },
    create: {
      oid: snowflake.nextId(),
      id: d.serverId,
      identifier: d.serverId,
      shuttleTenantId: d.tenantId ?? null,
      type: d.serverType
    },
    update: {}
  });

  let shuttleServerVersion = await db.shuttleServerVersion.upsert({
    where: { id: d.versionId },
    create: {
      oid: snowflake.nextId(),
      id: d.versionId,
      version: d.versionId,
      identifier: `${d.serverId}::${d.versionId}`,
      serverOid: shuttleServer.oid
    },
    update: {}
  });

  return { shuttleServer, shuttleServerVersion };
};

const findRemoteServerByName = async (opts: {
  shuttleClient: ReturnType<typeof createShuttleClient>;
  tenantId: string;
  serverName: string;
}) => {
  let cursor: string | undefined;

  for (let i = 0; i < 20; i++) {
    let page = await opts.shuttleClient.server.list({
      tenantId: opts.tenantId,
      limit: 100,
      cursor
    });

    let match = page.items.find(
      item => item.type === 'remote' && item.name === opts.serverName
    );
    if (match) return match;

    if (!page.pagination.has_more_after) {
      return null;
    }

    cursor = page.items[page.items.length - 1]?.id;
    if (!cursor) {
      return null;
    }
  }

  return null;
};

// Creates or reuses a remote MCP server in Shuttle, deploying a new version
// if the URL or protocol changed.
const ensureRemoteServerVersion = async (opts: {
  shuttleClient: ReturnType<typeof createShuttleClient>;
  tenantId: string;
  serverName: string;
  remoteUrl: string;
  protocol: 'sse' | 'streamable_http';
}) => {
  let resolveVersionId = async (deployment: { serverVersionId?: string | null; id: string }) =>
    deployment.serverVersionId ??
    (await waitForDeploymentVersion({ tenantId: opts.tenantId, deploymentId: deployment.id }));

  let existing = await findRemoteServerByName({
    shuttleClient: opts.shuttleClient,
    tenantId: opts.tenantId,
    serverName: opts.serverName
  });

  if (!existing) {
    let { server, deployment } = await opts.shuttleClient.server.create({
      tenantId: opts.tenantId,
      name: opts.serverName,
      description: 'Fixture remote MCP server',
      from: {
        type: 'remote',
        remoteUrl: opts.remoteUrl,
        protocol: opts.protocol,
        config: {}
      }
    });

    let serverVersionId = await resolveVersionId(deployment);
    return { server, serverVersionId };
  }

  let server = await opts.shuttleClient.server.get({
    tenantId: opts.tenantId,
    serverId: existing.id
  });

  let needsNewVersion =
    !server.currentVersionId ||
    server.draft.remoteUrl !== opts.remoteUrl ||
    server.draft.remoteProtocol !== opts.protocol;

  if (needsNewVersion) {
    let deployment = await opts.shuttleClient.server.createVersion({
      tenantId: opts.tenantId,
      serverId: existing.id,
      from: {
        type: 'remote',
        remoteUrl: opts.remoteUrl,
        protocol: opts.protocol
      }
    });

    let serverVersionId = await resolveVersionId(deployment);

    server = await opts.shuttleClient.server.get({
      tenantId: opts.tenantId,
      serverId: existing.id
    });

    return { server, serverVersionId };
  }

  return { server, serverVersionId: server.currentVersionId! };
};

const waitForPairVersionDiscovery = async (
  db: PrismaClient,
  pairVersionOid: bigint,
  timeoutMs: number = DISCOVERY_TIMEOUT_MS
) => {
  let lastPairVersion: Awaited<
    ReturnType<typeof db.providerDeploymentConfigPairProviderVersion.findFirstOrThrow>
  > | null = null;

  return retryUntilTimeout({
    timeoutMs,
    intervalMs: 1000,
    label: 'Timed out waiting for provider deployment pair discovery',
    fn: async () => {
      let pairVersion = await db.providerDeploymentConfigPairProviderVersion.findFirstOrThrow({
        where: { oid: pairVersionOid }
      });

      lastPairVersion = pairVersion;
      if (pairVersion.specificationDiscoveryStatus !== 'discovering') {
        return pairVersion;
      }

      return null;
    },
    onTimeout: async ctx => {
      let pairVersion =
        lastPairVersion ??
        (await db.providerDeploymentConfigPairProviderVersion.findFirstOrThrow({
          where: { oid: pairVersionOid }
        }));

      console.warn(
        `Timed out waiting for pair discovery for ${pairVersionOid.toString()} after ${
          ctx.timeoutMs
        }ms; using status "${pairVersion.specificationDiscoveryStatus}".`
      );
      return pairVersion;
    }
  });
};

const ensureSpecificationHasTools = async (opts: {
  db: PrismaClient;
  specification: ProviderSpecification;
  providerVersion: {
    oid: bigint;
    specificationOid: bigint | null;
    specificationDiscoveryStatus: string;
  };
  pairVersion: {
    oid: bigint;
    specificationOid: bigint | null;
    specificationDiscoveryStatus: string;
  };
  remoteUrl: string;
  protocol: 'sse' | 'streamable_http';
}) => {
  let toolCount = await opts.db.providerTool.count({
    where: { specificationOid: opts.specification.oid }
  });
  if (toolCount > 0) return;

  let details = {
    protocol: opts.protocol,
    remoteUrl: opts.remoteUrl,
    specificationOid: opts.specification.oid.toString(),
    specificationType: opts.specification.type,
    providerVersionOid: opts.providerVersion.oid.toString(),
    providerVersionSpecificationOid: opts.providerVersion.specificationOid?.toString() ?? null,
    providerVersionDiscoveryStatus: opts.providerVersion.specificationDiscoveryStatus,
    pairVersionOid: opts.pairVersion.oid.toString(),
    pairVersionSpecificationOid: opts.pairVersion.specificationOid?.toString() ?? null,
    pairVersionDiscoveryStatus: opts.pairVersion.specificationDiscoveryStatus
  };

  throw new Error(
    `MCP specification discovery produced zero tools. Details: ${JSON.stringify(details)}`
  );
};

// Discovers a provider's specification (tools, auth methods, features) by calling
// the Shuttle backend capabilities API with retries, then persists the result locally
const discoverSpecification = async (d: {
  provider: Provider;
  providerVersion: ProviderVersion;
  providerVariant: ProviderVariant;
  getCapabilities: (backend: Awaited<ReturnType<typeof getBackend>>) => Promise<any>;
  label: string;
  allowFailure?: boolean;
}): Promise<ProviderSpecification | null> => {
  let backend = await getBackend({ entity: d.providerVariant });

  return retryUntilTimeout({
    timeoutMs: d.allowFailure ? DISCOVERY_CALL_TIMEOUT_MS : DISCOVERY_TIMEOUT_MS,
    intervalMs: 1000,
    label: d.label,
    onTimeout: d.allowFailure ? () => null : undefined,
    fn: async () => {
      let capabilities = await withTimeout(
        d.getCapabilities(backend),
        DISCOVERY_CALL_TIMEOUT_MS,
        d.label
      ).catch(err => {
        if (!d.allowFailure) throw err;
        return null;
      });
      if (!capabilities || capabilities.status !== 'success') return null;
      return providerSpecificationInternalService.ensureProviderSpecification({
        provider: d.provider,
        providerVersion: d.providerVersion,
        type: capabilities.type,
        specification: capabilities.specification,
        authMethods: capabilities.authMethods,
        features: capabilities.features,
        tools: capabilities.tools,
        triggers: capabilities.triggers
      });
    }
  });
};

export const RemoteMcpProviderFixtures = (db: PrismaClient) => {
  // Orchestrates a complete remote MCP provider setup:
  // 1. Resolve/create tenant, solution, environment, backend
  // 2. Register tenant with Shuttle and create/reuse a remote MCP server
  // 3. Sync Shuttle records to local DB, create publisher + provider + version
  // 4. Discover specification (tools, auth) via Shuttle capabilities API
  // 5. Create deployment + config pair, wait for pair discovery
  // 6. Optionally attempt full pair-level specification discovery (best-effort)
  const complete = async (
    opts: RemoteMcpProviderOptions
  ): Promise<RemoteMcpProviderResult> => {
    let shuttleClient = getShuttleClient();

    let solutionFixtures = SolutionFixtures(db);
    let tenantFixtures = TenantFixtures(db);
    let environmentFixtures = EnvironmentFixtures(db);

    let solution = opts.solution ?? (await solutionFixtures.default());
    let tenant = opts.tenant ?? (await tenantFixtures.default());
    let environment = opts.environment ?? (await environmentFixtures.default({ tenant }));

    let backend = await ensureBackend(db);

    let shuttleTenant = await ensureShuttleTenant(db, tenant);

    let protocol = opts.protocol ?? 'streamable_http';
    let remoteServerName = resolveRemoteServerName({ remoteUrl: opts.remoteUrl, protocol });
    let { server, serverVersionId } = await ensureRemoteServerVersion({
      shuttleClient,
      tenantId: shuttleTenant.id,
      serverName: remoteServerName,
      remoteUrl: opts.remoteUrl,
      protocol
    });

    let version = await shuttleClient.serverVersion.get({
      tenantId: shuttleTenant.id,
      serverVersionId
    });

    let { shuttleServer, shuttleServerVersion } = await ensureShuttleServerRecords(db, {
      serverId: server.id,
      serverType: server.type,
      tenantId: server.tenantId,
      versionId: version.id
    });

    let publisher = await publisherInternalService.upsertPublisherForExternal({
      identifier: `shuttle::remote::${opts.remoteUrl}`,
      name: `MCP Remote (${opts.remoteUrl})`
    });

    let provider = await providerInternalService.upsertProvider({
      publisher,
      owner: { tenant, solution },
      source: {
        type: 'shuttle',
        shuttleServer,
        backend
      },
      info: {
        name: server.name,
        description: server.description ?? undefined,
        slug: slugify(`${server.name}-${generateCode(5)}`),
        globalIdentifier: null
      },
      type: mcpRemoteType
    });

    let providerWithVariant = await db.provider.findFirstOrThrow({
      where: { oid: provider.oid },
      include: { defaultVariant: true }
    });

    let defaultVariant = providerWithVariant.defaultVariant;
    if (!defaultVariant) {
      throw new Error('Provider default variant missing');
    }

    let providerVersion = await providerVersionInternalService.upsertVersion({
      variant: defaultVariant,
      isCurrent: true,
      source: {
        type: 'shuttle',
        shuttleServer,
        shuttleServerVersion,
        backend
      },
      info: {
        name: version.id
      },
      type: mcpRemoteType
    });

    let preliminarySpecification = await discoverSpecification({
      provider: providerWithVariant,
      providerVersion,
      providerVariant: defaultVariant,
      label: 'Shuttle version specification discovery',
      allowFailure: opts.allowDiscoveryFailure,
      getCapabilities: backend =>
        backend.capabilities.getSpecificationForProviderVersion({
          tenant,
          provider: providerWithVariant,
          providerVariant: defaultVariant,
          providerVersion
        })
    });

    if (preliminarySpecification) {
      providerVersion = await db.providerVersion.update({
        where: { oid: providerVersion.oid },
        data: {
          specificationOid: preliminarySpecification.oid,
          specificationDiscoveryStatus: 'discovered'
        }
      });
    }

    let providerDeployment = await providerDeploymentService.createProviderDeployment({
      tenant,
      solution,
      environment,
      provider: providerWithVariant,
      lockedVersion: providerVersion,
      input: {
        name: `Deployment ${generateCode(4)}`,
        description: 'Fixture deployment',
        config: {
          type: 'inline',
          data: {}
        }
      }
    });

    let providerConfig = await db.providerConfig.findFirstOrThrow({
      where: { oid: providerDeployment.defaultConfigOid! },
      include: { currentVersion: true }
    });

    // @vnxdev have another look here!
    // mark default config as non-ephemeral so it doesn't
    // expire with 15-second TTL
    await db.providerConfig.update({
      where: { oid: providerConfig.oid },
      data: { isEphemeral: false }
    });
    providerConfig = { ...providerConfig, isEphemeral: false };

    if (!providerDeployment.currentVersion) {
      throw new Error('Provider deployment version missing');
    }
    if (!providerConfig.currentVersion) {
      throw new Error('Provider config version missing');
    }

    let pairRes = await providerDeploymentConfigPairInternalService.useDeploymentConfigPair({
      deployment: providerDeployment,
      config: providerConfig,
      authConfig: null,
      version: providerVersion
    });
    if (!pairRes.version) {
      throw new Error('Provider deployment config pair version missing');
    }

    let pairVersion = await waitForPairVersionDiscovery(db, pairRes.version.oid);

    let discoveredSpecification =
      pairVersion.specificationDiscoveryStatus === 'discovered' && pairVersion.specificationOid
        ? await db.providerSpecification.findFirstOrThrow({
            where: { oid: pairVersion.specificationOid }
          })
        : null;

    let specification: ProviderSpecification | null;
    if (discoveredSpecification?.type === 'full') {
      specification = discoveredSpecification;
    } else {
      specification = preliminarySpecification;

      // Best-effort: attempt full pair-level discovery for a more complete specification
      let fullSpecification: ProviderSpecification | null = null;
      try {
        fullSpecification = await discoverSpecification({
          provider: providerWithVariant,
          providerVersion,
          providerVariant: defaultVariant,
          label: 'Shuttle pair specification discovery',
          allowFailure: opts.allowDiscoveryFailure,
          getCapabilities: backend =>
            backend.capabilities.getSpecificationForProviderPair({
              tenant,
              provider: providerWithVariant,
              providerVariant: defaultVariant,
              providerVersion,
              deploymentVersion: providerDeployment.currentVersion!,
              configVersion: providerConfig.currentVersion!,
              authConfigVersion: null
            })
        });
      } catch (err) {
        console.warn(
          `Skipping full pair discovery for test fixture after timeout/failure: ${
            (err as Error)?.message ?? String(err)
          }`
        );
      }

      if (fullSpecification) {
        specification = fullSpecification;

        providerVersion = await db.providerVersion.update({
          where: { oid: providerVersion.oid },
          data: {
            specificationOid: specification.oid,
            specificationDiscoveryStatus: 'discovered'
          }
        });

        pairVersion = await db.providerDeploymentConfigPairProviderVersion.update({
          where: { oid: pairVersion.oid },
          data: {
            specificationDiscoveryStatus: 'discovered',
            specificationOid: specification.oid
          }
        });
      }
    }

    if (pairRes.pair.lastUsedPairVersionOid !== pairVersion.oid) {
      await db.providerDeploymentConfigPair.update({
        where: { oid: pairRes.pair.oid },
        data: { lastUsedPairVersionOid: pairVersion.oid }
      });
    }

    providerVersion = await db.providerVersion.findFirstOrThrow({
      where: { oid: providerVersion.oid }
    });

    if (opts.requireAtLeastOneTool && specification) {
      await ensureSpecificationHasTools({
        db,
        specification,
        providerVersion,
        pairVersion,
        remoteUrl: opts.remoteUrl,
        protocol
      });
    }

    return {
      solution,
      tenant,
      environment,
      backend,
      shuttleServer,
      shuttleServerVersion,
      provider: providerWithVariant,
      providerVersion,
      specification,
      providerDeployment,
      providerConfig
    };
  };

  return {
    complete
  };
};
