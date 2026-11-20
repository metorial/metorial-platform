import {
  badRequestError,
  notFoundError,
  preconditionFailedError,
  ServiceError
} from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  getId,
  type Instance,
  type Organization,
  Prisma,
  type Provider,
  type ProviderConnection,
  type ProviderConnectionStatus
} from '@mtsrc/ai-gateway-db';
import { Events, type ConnectionChange } from '@mtsrc/ai-gateway-events';
import {
  getProviderDefinition,
  parseProviderFeatures,
  parseProviderInput,
  type ProviderDefinition
} from '@mtsrc/ai-gateway-providers';
import {
  metorialProviderSlug,
  type ConnectionCheckResult,
  type ConnectionPricingOverride,
  type ProviderConnectionConfig
} from '@mtsrc/ai-gateway-spec';
import {
  checkStateUpdate,
  loadConnectionCredentials,
  recheckConnection,
  recordCheck,
  runProviderCheck
} from '../lib/check';
import {
  connectionInclude,
  secretOwnerOf,
  type ConnectionWithRelations
} from '../lib/connection';
import {
  createConnectionSecret,
  disableConnectionSecret,
  updateConnectionSecret
} from '../lib/nebula';
import { forgetCachedCredentials } from '../lib/secretCache';
import { connectionCheckSingleQueue } from '../queues/connectionCheck';

export { connectionInclude };

export type ConnectionScope = { organization: Organization; instance: Instance };

let rejectedCredentialsError = (
  definition: ProviderDefinition,
  result: ConnectionCheckResult
) =>
  new ServiceError(
    badRequestError({
      code: 'invalid_provider_credentials',
      message: `${definition.name} rejected the credentials${result.message ? `: ${result.message}` : '.'}`
    })
  );

let scopeWhere = (scope: ConnectionScope): Prisma.ProviderConnectionWhereInput => ({
  organizationOid: scope.organization.oid,
  instanceOid: scope.instance.oid
});

class ProviderConnectionServiceImpl {
  async createConnection(d: {
    scope: ConnectionScope;
    input: {
      providerSlug: string;
      name: string;
      description?: string | null;
      priority?: number;
      credentials: unknown;
      config?: unknown;
      features?: unknown;
      pricingOverride?: ConnectionPricingOverride | null;
    };
  }) {
    let parsed = parseProviderInput({
      providerSlug: d.input.providerSlug,
      credentials: d.input.credentials,
      config: d.input.config
    });
    let credentials = parsed.credentials!;

    let provider = await this.getProviderRow(d.input.providerSlug);
    let options = await this.parseOptions({
      provider,
      features: d.input.features,
      pricingOverride: d.input.pricingOverride
    });

    let check = await runProviderCheck({
      providerSlug: provider.slug,
      credentials,
      config: parsed.config
    });
    if (check.result.outcome == 'invalid') {
      throw rejectedCredentialsError(parsed.definition, check.result);
    }

    let ids = getId('providerConnection');

    let nebulaSecretId = await createConnectionSecret({
      owner: { organization: d.scope.organization },
      connectionId: ids.id,
      credentials
    });

    let connection = await db.providerConnection.create({
      data: {
        ...ids,

        name: d.input.name,
        description: d.input.description,
        priority: d.input.priority,
        config: parsed.config,
        ...options,

        nebulaSecretId,
        credentialHint: parsed.definition.credentialHint(credentials),

        ...checkStateUpdate({
          current: { status: 'pending', consecutiveFailures: 0 },
          result: check.result,
          checkedAt: check.checkedAt
        }),

        providerOid: provider.oid,
        organizationOid: d.scope.organization.oid,
        instanceOid: d.scope.instance.oid
      },
      include: connectionInclude
    });

    await recordCheck({ connection, trigger: 'created', ...check });
    await this.fireChanged(connection, 'upserted');

    return connection;
  }

  async getConnectionById(d: {
    scope: ConnectionScope;
    connectionId: string;
    includeArchived?: boolean;
  }) {
    let connection = await db.providerConnection.findFirst({
      where: {
        ...scopeWhere(d.scope),
        id: d.connectionId,
        archivedAt: d.includeArchived ? undefined : null
      },
      include: connectionInclude
    });
    if (!connection) throw new ServiceError(notFoundError('provider_connection'));

    return connection;
  }

  async listConnections(d: {
    scope: ConnectionScope;
    providerSlug?: string;
    status?: ProviderConnectionStatus[];
  }) {
    let where: Prisma.ProviderConnectionWhereInput = {
      ...scopeWhere(d.scope),
      archivedAt: null,
      status: d.status ? { in: d.status } : undefined,
      provider: d.providerSlug ? { slug: d.providerSlug } : undefined
    };

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.providerConnection.findMany({ ...opts, where, include: connectionInclude })
      )
    );
  }

  async updateConnection(d: {
    connection: ConnectionWithRelations;
    input: {
      name?: string;
      description?: string | null;
      priority?: number;
      credentials?: unknown;
      config?: unknown;
      features?: unknown;
      pricingOverride?: ConnectionPricingOverride | null;
    };
  }) {
    this.assertActive(d.connection);

    let options = await this.parseOptions({
      provider: d.connection.provider,
      features: d.input.features,
      pricingOverride: d.input.pricingOverride
    });

    let changesAccess = d.input.credentials !== undefined || d.input.config !== undefined;
    if (!changesAccess) {
      let connection = await db.providerConnection.update({
        where: { oid: d.connection.oid },
        data: {
          name: d.input.name,
          description: d.input.description,
          priority: d.input.priority,
          ...options
        },
        include: connectionInclude
      });

      await this.fireChanged(connection, 'upserted');

      return connection;
    }

    let parsed = parseProviderInput({
      providerSlug: d.connection.provider.slug,
      credentials: d.input.credentials,
      config: d.input.config ?? d.connection.config
    });
    let credentials = parsed.credentials ?? (await loadConnectionCredentials(d.connection));

    let check = await runProviderCheck({
      providerSlug: d.connection.provider.slug,
      credentials,
      config: parsed.config
    });
    if (check.result.outcome == 'invalid') {
      throw rejectedCredentialsError(parsed.definition, check.result);
    }

    if (parsed.credentials) {
      await updateConnectionSecret({
        owner: secretOwnerOf(d.connection),
        connectionId: d.connection.id,
        nebulaSecretId: d.connection.nebulaSecretId,
        credentials: parsed.credentials
      });
    }

    let connection = await db.providerConnection.update({
      where: { oid: d.connection.oid },
      data: {
        name: d.input.name,
        description: d.input.description,
        priority: d.input.priority,
        config: parsed.config as ProviderConnectionConfig,
        ...options,

        credentialHint: parsed.definition.credentialHint(credentials),

        ...checkStateUpdate({
          current: { status: 'pending', consecutiveFailures: 0 },
          result: check.result,
          checkedAt: check.checkedAt
        })
      },
      include: connectionInclude
    });

    forgetCachedCredentials(connection.id);

    await recordCheck({ connection, trigger: 'updated', ...check });
    await this.fireChanged(connection, 'upserted');

    return connection;
  }

  async checkConnection(d: { connection: ConnectionWithRelations }) {
    this.assertActive(d.connection);
    if (d.connection.status == 'disabled') {
      throw new ServiceError(
        preconditionFailedError({ message: 'Enable the connection before checking it.' })
      );
    }

    return await recheckConnection({ connection: d.connection, trigger: 'manual' });
  }

  async setConnectionEnabled(d: { connection: ConnectionWithRelations; enabled: boolean }) {
    this.assertActive(d.connection);

    let isEnabled = d.connection.status != 'disabled';
    if (isEnabled == d.enabled) return d.connection;

    let connection = await db.providerConnection.update({
      where: { oid: d.connection.oid },
      data: d.enabled
        ? { status: 'pending', consecutiveFailures: 0, nextCheckAt: new Date() }
        : { status: 'disabled', nextCheckAt: null },
      include: connectionInclude
    });

    await this.fireChanged(connection, 'status_changed');

    if (d.enabled) return await recheckConnection({ connection, trigger: 'manual' });

    return connection;
  }

  // Called by the inference path when the provider answers 401/403 for a key we believe is valid.
  // The connection is re-checked out of band rather than flipped to invalid on a single response.
  async reportAuthFailure(d: { connectionId: string }) {
    await connectionCheckSingleQueue.add(
      { connectionId: d.connectionId, trigger: 'inference_auth_failure' },
      { id: `${d.connectionId}:auth-failure:${Math.floor(Date.now() / 60_000)}` }
    );
  }

  async getCredentials(d: { connection: ConnectionWithRelations }) {
    return await loadConnectionCredentials(d.connection);
  }

  // Routing already scoped and selected the connection, so inference resolves it by id alone.
  async getInferenceConnection(d: { connectionId: string }) {
    let connection = await db.providerConnection.findFirst({
      where: { id: d.connectionId, archivedAt: null },
      include: connectionInclude
    });
    if (!connection) throw new ServiceError(notFoundError('provider_connection'));

    return {
      credentials: await loadConnectionCredentials(connection),
      config: connection.config as ProviderConnectionConfig
    };
  }

  async archiveConnection(d: { connection: ConnectionWithRelations }) {
    if (d.connection.archivedAt) return d.connection;

    let connection = await db.providerConnection.update({
      where: { oid: d.connection.oid },
      data: { archivedAt: new Date(), nextCheckAt: null },
      include: connectionInclude
    });

    forgetCachedCredentials(connection.id);

    await disableConnectionSecret({
      owner: secretOwnerOf(connection),
      nebulaSecretId: connection.nebulaSecretId
    }).catch(error =>
      console.warn('[ai-gateway] Could not disable Nebula secret', connection.id, error)
    );

    await this.fireChanged(connection, 'archived');

    return connection;
  }

  // `undefined` leaves a value as it is; a `null` pricing override removes it.
  private async parseOptions(d: {
    provider: Provider;
    features: unknown;
    pricingOverride: ConnectionPricingOverride | null | undefined;
  }) {
    let features =
      d.features === undefined
        ? undefined
        : parseProviderFeatures({ providerSlug: d.provider.slug, features: d.features });

    let modelSlugs = Object.keys(d.pricingOverride?.models ?? {});
    if (modelSlugs.length) {
      let offered = await db.model.findMany({
        where: {
          slug: { in: modelSlugs },
          removedAt: null,
          offerings: { some: { providerOid: d.provider.oid, removedAt: null } }
        },
        select: { slug: true }
      });
      let offeredSlugs = new Set(offered.map(model => model.slug));

      let unknown = modelSlugs.filter(slug => !offeredSlugs.has(slug));
      if (unknown.length) {
        throw new ServiceError(
          badRequestError({
            message: `${getProviderDefinition(d.provider.slug).name} does not offer ${unknown.join(', ')}, so their prices cannot be overridden.`
          })
        );
      }
    }

    return {
      features,
      pricingOverride:
        d.pricingOverride === undefined ? undefined : (d.pricingOverride ?? Prisma.DbNull)
    };
  }

  private async getProviderRow(slug: string) {
    if (slug == metorialProviderSlug) {
      throw new ServiceError(
        badRequestError({ message: 'The metorial provider cannot be connected with a key.' })
      );
    }

    let provider = await db.provider.findFirst({ where: { slug, removedAt: null } });
    if (!provider) {
      throw new ServiceError(
        preconditionFailedError({
          message: `The provider "${slug}" is not in the model catalog yet. Try again after the catalog has synced.`
        })
      );
    }

    return provider;
  }

  private assertActive(connection: ProviderConnection) {
    if (connection.archivedAt) {
      throw new ServiceError(
        preconditionFailedError({ message: 'An archived connection cannot be changed.' })
      );
    }
  }

  private async fireChanged(connection: ConnectionWithRelations, change: ConnectionChange) {
    await Events.fire('credentials.connection.changed:after', {
      connectionId: connection.id,
      instanceId: connection.instance.id,
      change
    });
  }
}

export let providerConnectionService = Service.create(
  'providerConnectionService',
  () => new ProviderConnectionServiceImpl()
).build();
