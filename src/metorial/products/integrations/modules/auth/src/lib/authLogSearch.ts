import type { Environment, Prisma, Solution, Tenant } from '@metorial-subspace/db';
import { getProviderTenantFilter } from '@metorial-subspace/module-catalog';
import { searchRelatedEntities, whenRelatedMatched } from '@metorial-subspace/module-search';

type AuthLogRowWhere = Prisma.ProviderAuthConfigEventWhereInput &
  Prisma.ProviderAuthConfigErrorWhereInput;

export let searchAuthLogRelatedEntities = async (d: {
  tenant: Tenant;
  environment: Environment;
  solution: Solution;
  search: string;
}) => {
  let related = await searchRelatedEntities({
    tenant: d.tenant,
    query: d.search,
    kinds: ['providerOids', 'authConfigOids', 'authCredentialsOids', 'authMethodGlobalOids'],
    providerFilter: getProviderTenantFilter({
      tenant: d.tenant,
      environment: d.environment,
      solution: d.solution,
      includeDeprecated: true
    })
  });

  let authRowClauses: AuthLogRowWhere[] = [
    ...whenRelatedMatched(related.authConfigOids, oids => ({ authConfigOid: oids })),
    ...whenRelatedMatched(related.authCredentialsOids, oids => ({ authCredentialsOid: oids })),
    ...whenRelatedMatched(related.authMethodGlobalOids, oids => ({
      authConfig: { authMethod: { globalOid: oids } }
    }))
  ];

  let providerClauses = whenRelatedMatched(related.providerOids, oids => ({
    providerOid: oids
  }));

  return { providerClauses, authRowClauses };
};
