import { db, type Prisma, type Tenant } from '@metorial-subspace/db';
import { voyager, voyagerIndex, voyagerSource } from './voyager';

let MIN_RELATED_SEARCH_QUERY_LENGTH = 2;

export type RelatedEntityMatches = {
  providerOids: bigint[];
  toolGlobalOids: bigint[];
  authMethodGlobalOids: bigint[];
  agentOids: bigint[];
  actorOids: bigint[];
  identityOids: bigint[];
  deploymentOids: bigint[];
  configOids: bigint[];
  authConfigOids: bigint[];
  authCredentialsOids: bigint[];
};

export type RelatedEntityKind = keyof RelatedEntityMatches;

type ResolveOidsInput = {
  ids: string[];
  tenant: Pick<Tenant, 'oid'>;
  providerFilter?: Prisma.ProviderWhereInput;
};

let relatedEntitySources: Record<
  RelatedEntityKind,
  {
    getIndexId: () => string;
    resolveOids: (d: ResolveOidsInput) => Promise<bigint[]>;
  }
> = {
  providerOids: {
    getIndexId: () => voyagerIndex.providerListing.id,
    resolveOids: async d => {
      let listings = await db.providerListing.findMany({
        where: { id: { in: d.ids }, provider: d.providerFilter },
        select: { providerOid: true }
      });

      return listings.map(listing => listing.providerOid);
    }
  },

  toolGlobalOids: {
    getIndexId: () => voyagerIndex.providerTool.id,
    resolveOids: async d => {
      let globals = await db.providerToolGlobal.findMany({
        where: { id: { in: d.ids }, provider: d.providerFilter },
        select: { oid: true }
      });

      return globals.map(global => global.oid);
    }
  },

  authMethodGlobalOids: {
    getIndexId: () => voyagerIndex.providerAuthMethod.id,
    resolveOids: async d => {
      let globals = await db.providerAuthMethodGlobal.findMany({
        where: { id: { in: d.ids }, provider: d.providerFilter },
        select: { oid: true }
      });

      return globals.map(global => global.oid);
    }
  },

  agentOids: {
    getIndexId: () => voyagerIndex.agent.id,
    resolveOids: async d => {
      let agents = await db.agent.findMany({
        where: { id: { in: d.ids }, tenantOid: d.tenant.oid },
        select: { oid: true }
      });

      return agents.map(agent => agent.oid);
    }
  },

  actorOids: {
    getIndexId: () => voyagerIndex.identityActor.id,
    resolveOids: async d => {
      let actors = await db.identityActor.findMany({
        where: { id: { in: d.ids }, tenantOid: d.tenant.oid },
        select: { oid: true }
      });

      return actors.map(actor => actor.oid);
    }
  },

  identityOids: {
    getIndexId: () => voyagerIndex.identity.id,
    resolveOids: async d => {
      let identities = await db.identity.findMany({
        where: { id: { in: d.ids }, tenantOid: d.tenant.oid },
        select: { oid: true }
      });

      return identities.map(identity => identity.oid);
    }
  },

  deploymentOids: {
    getIndexId: () => voyagerIndex.providerDeployment.id,
    resolveOids: async d => {
      let deployments = await db.providerDeployment.findMany({
        where: { id: { in: d.ids }, tenantOid: d.tenant.oid },
        select: { oid: true }
      });

      return deployments.map(deployment => deployment.oid);
    }
  },

  configOids: {
    getIndexId: () => voyagerIndex.providerConfig.id,
    resolveOids: async d => {
      let configs = await db.providerConfig.findMany({
        where: { id: { in: d.ids }, tenantOid: d.tenant.oid },
        select: { oid: true }
      });

      return configs.map(config => config.oid);
    }
  },

  authConfigOids: {
    getIndexId: () => voyagerIndex.providerAuthConfig.id,
    resolveOids: async d => {
      let authConfigs = await db.providerAuthConfig.findMany({
        where: { id: { in: d.ids }, tenantOid: d.tenant.oid },
        select: { oid: true }
      });

      return authConfigs.map(authConfig => authConfig.oid);
    }
  },

  authCredentialsOids: {
    getIndexId: () => voyagerIndex.providerAuthCredentials.id,
    resolveOids: async d => {
      let credentials = await db.providerAuthCredentials.findMany({
        where: { id: { in: d.ids }, tenantOid: d.tenant.oid },
        select: { oid: true }
      });

      return credentials.map(credential => credential.oid);
    }
  }
};

let searchRelatedKind = async (d: {
  kind: RelatedEntityKind;
  tenant: Pick<Tenant, 'id' | 'oid'>;
  query: string;
  providerFilter?: Prisma.ProviderWhereInput;
}) => {
  let source = relatedEntitySources[d.kind];

  try {
    let records = await voyager.record.search({
      tenantId: d.tenant.id,
      sourceId: (await voyagerSource).id,
      indexId: source.getIndexId(),
      query: d.query
    });

    let ids = records
      .map(record => record.documentId)
      .filter((documentId): documentId is string => !!documentId);
    if (!ids.length) return [];

    return await source.resolveOids({
      ids,
      tenant: d.tenant,
      providerFilter: d.providerFilter
    });
  } catch (error) {
    console.error(`[module-search] Related entity search failed for ${d.kind}`, error);
    return [];
  }
};

export let searchRelatedEntities = async <K extends RelatedEntityKind>(d: {
  tenant: Pick<Tenant, 'id' | 'oid'>;
  query: string;
  kinds: K[];
  providerFilter?: Prisma.ProviderWhereInput;
}): Promise<Pick<RelatedEntityMatches, K>> => {
  let query = d.query.trim();
  let shouldSearch = query.length >= MIN_RELATED_SEARCH_QUERY_LENGTH;

  let results = await Promise.all(
    d.kinds.map(async kind => {
      let oids = shouldSearch
        ? await searchRelatedKind({
            kind,
            tenant: d.tenant,
            query,
            providerFilter: d.providerFilter
          })
        : [];

      return [kind, oids] as const;
    })
  );

  return Object.fromEntries(results) as Pick<RelatedEntityMatches, K>;
};

export let whenRelatedMatched = <W>(
  oids: bigint[] | undefined,
  build: (filter: { in: bigint[] }) => W
): W[] => (oids?.length ? [build({ in: oids })] : []);
