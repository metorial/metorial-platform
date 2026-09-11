import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  type Environment,
  type ProviderAuthConfig,
  type ProviderAuthCredentials,
  type ProviderAuthMethod,
  type ProviderSpecification,
  type ProviderVersion,
  type Solution,
  type Tenant
} from '@metorial-subspace/db';
import {
  checkToolAuthMethodSatisfied,
  checkToolScopesSatisfied,
  checkToolScopesSatisfiedByAuthMethods,
  resolveGrantedScopes
} from '@metorial-subspace/module-provider-internal';
import {
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';
import { getProviderTenantFilter } from './provider';

type ListToolsContext = {
  solution: Solution;
  tenant?: Tenant;
  environment?: Environment;
  providerVersion: ProviderVersion;
  version: ProviderVersion | null;
};

let hasVersionWithoutSpecification = (ctx: ListToolsContext) =>
  !!ctx.version && !ctx.version.specificationOid;

let buildToolsWhere = (ctx: ListToolsContext) => ({
  AND: [
    {
      provider: getProviderTenantFilter({
        ...ctx,
        includeDeprecated: true
      })
    }
  ],
  providerOid: ctx.providerVersion.providerOid,
  ...(ctx.version?.specificationOid
    ? {
        providerTools: {
          some: { specificationOid: ctx.version.specificationOid, adapterOid: null }
        }
      }
    : { currentInstance: { is: { adapterOid: null } } })
});

let buildToolsInclude = (ctx: ListToolsContext) => ({
  provider: true,
  currentInstance: ctx.version
    ? false
    : { include: { specification: { omit: { value: true } } } },
  providerTools: ctx.version?.specificationOid
    ? {
        where: { specificationOid: ctx.version.specificationOid, adapterOid: null },
        include: { specification: { omit: { value: true } } }
      }
    : false
});

let patchGlobalCursor = async (ctx: ListToolsContext, cursor?: { id: string }) => {
  if (!cursor?.id) return cursor;

  let tool = await db.providerTool.findFirst({
    where: {
      provider: getProviderTenantFilter({
        ...ctx,
        includeDeprecated: true
      }),
      OR: [{ id: cursor.id }, { global: { id: cursor.id } }]
    },
    include: {
      global: true
    }
  });

  if (tool?.global) {
    return { id: tool.global.id };
  }

  return cursor;
};

let queryTools = async (
  ctx: ListToolsContext,
  opts?: {
    skip: number;
    take: number;
    cursor?: { id: string };
    orderBy: [{ id: 'asc' | 'desc' }];
  }
) => {
  if (hasVersionWithoutSpecification(ctx)) {
    return [];
  }

  let patchedOpts = opts
    ? {
        ...opts,
        cursor: await patchGlobalCursor(ctx, opts.cursor)
      }
    : undefined;

  let globals = await db.providerToolGlobal.findMany({
    ...patchedOpts,
    where: buildToolsWhere(ctx),
    include: buildToolsInclude(ctx)
  });

  return globals
    .filter(g => g.currentInstance || g.providerTools.length)
    .map(global => {
      let inner = global.providerTools?.[0] ?? global.currentInstance!;

      return {
        ...inner,
        global,
        provider: global.provider,
        specification: (inner as any).specification as ProviderSpecification
      };
    });
};

let paginateInMemory = <T extends { id: string }>(
  items: T[],
  input: { limit: number; after?: string; before?: string; order: 'asc' | 'desc' }
) => {
  let { limit, after, before, order } = input;

  if (after && before) {
    throw new ServiceError(
      badRequestError({ message: 'Cannot use both after and before cursors' })
    );
  }

  let sorted = [...items].sort((a, b) =>
    order === 'asc' ? a.id.localeCompare(b.id) : b.id.localeCompare(a.id)
  );

  let cursorId = after ?? before;
  let cursorItem = cursorId ? sorted.find(item => item.id === cursorId) : undefined;
  let cursorType: 'after' | 'before' | 'none' = after ? 'after' : before ? 'before' : 'none';

  let startIdx = 0;
  let endIdx = sorted.length;

  if (cursorItem) {
    let cursorIdx = sorted.indexOf(cursorItem);
    if (cursorType === 'after') startIdx = cursorIdx + 1;
    else if (cursorType === 'before') endIdx = cursorIdx;
  }

  let available = sorted.slice(startIdx, endIdx);

  if (cursorType === 'before') {
    return {
      items: available.slice(-limit),
      pagination: {
        hasNextPage: !!cursorItem,
        hasPreviousPage: available.length > limit
      }
    };
  }

  return {
    items: available.slice(0, limit),
    pagination: {
      hasNextPage: available.length > limit,
      hasPreviousPage: cursorType === 'after' && !!cursorItem
    }
  };
};

type AuthMethodScopeRecord = {
  id: string;
  key: string;
  global: { id: string };
  value: { scopes?: { id: string }[] | null };
};

type ResolvedAuthMethodToolFilter = {
  authMethods: AuthMethodScopeRecord[];
  scopeSets: string[][];
};

let mapAuthMethodToolFilter = (
  ids: string[],
  authMethods: AuthMethodScopeRecord[]
): ResolvedAuthMethodToolFilter => {
  let foundIds = new Set<string>();
  for (let authMethod of authMethods) {
    foundIds.add(authMethod.id);
    foundIds.add(authMethod.global.id);
  }

  let missingId = ids.find(id => !foundIds.has(id));
  if (missingId) {
    throw new ServiceError(notFoundError('provider_auth_method', missingId));
  }

  return {
    authMethods,
    scopeSets: authMethods.map(
      authMethod => authMethod.value.scopes?.map(scope => scope.id) ?? []
    )
  };
};

let resolveProviderAuthMethodsForToolFilter = async (
  ctx: ListToolsContext,
  providerAuthMethodIds?: string[]
) => {
  let ids = [...new Set(providerAuthMethodIds?.filter(Boolean) ?? [])];
  if (!ids.length) return null;

  if (ctx.version?.specificationOid) {
    let authMethods = await db.providerAuthMethod.findMany({
      where: {
        provider: getProviderTenantFilter({
          ...ctx,
          includeDeprecated: true
        }),
        providerOid: ctx.providerVersion.providerOid,
        specificationOid: ctx.version.specificationOid,
        OR: [{ id: { in: ids } }, { global: { id: { in: ids } } }]
      },
      include: { global: true }
    });

    return mapAuthMethodToolFilter(ids, authMethods);
  } else if (!hasVersionWithoutSpecification(ctx)) {
    let globals = await db.providerAuthMethodGlobal.findMany({
      where: {
        provider: getProviderTenantFilter({
          ...ctx,
          includeDeprecated: true
        }),
        providerOid: ctx.providerVersion.providerOid,
        currentInstance: { isNot: null },
        OR: [{ id: { in: ids } }, { providerAuthMethods: { some: { id: { in: ids } } } }]
      },
      include: {
        currentInstance: {
          include: { global: true }
        }
      }
    });

    let authMethods = globals.flatMap(global =>
      global.currentInstance ? [global.currentInstance] : []
    );

    return mapAuthMethodToolFilter(ids, authMethods);
  }

  throw new ServiceError(notFoundError('provider_auth_method', ids[0]));
};

type ListProviderToolsParams = {
  providerVersion: ProviderVersion;

  providerAuthConfig?:
    | (ProviderAuthConfig & { authMethod?: ProviderAuthMethod | null })
    | null;
  providerAuthCredentials?: ProviderAuthCredentials | null;
  providerAuthMethodIds?: string[];
};

type GetProviderToolByIdParams = {
  providerToolId: string;
};

class providerToolServiceImpl {
  async listProviderTools(d: MetorialFacing<ListProviderToolsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.listProviderToolsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listProviderToolsInternal(
    d: {
      tenant?: Tenant;
      environment?: Environment;
    } & ListProviderToolsParams
  ) {
    let solution = await getMetorialSolution();

    let version = d.providerVersion?.oid
      ? await db.providerVersion.findFirstOrThrow({
          where: { oid: d.providerVersion.oid }
        })
      : null;

    let ctx: ListToolsContext = {
      solution,
      tenant: d.tenant,
      environment: d.environment,
      providerVersion: d.providerVersion,
      version
    };

    let authMethodScopes = await resolveProviderAuthMethodsForToolFilter(
      ctx,
      d.providerAuthMethodIds
    );

    if (hasVersionWithoutSpecification(ctx)) {
      return Paginator.create(() => async input => paginateInMemory([], input));
    }

    let grantedScopes = resolveGrantedScopes({
      authConfig: d.providerAuthConfig,
      authCredentials: d.providerAuthCredentials
    });
    let authMethod = d.providerAuthConfig
      ? ((d.providerAuthConfig as any).authMethod ??
        (await db.providerAuthMethod.findUnique({
          where: { oid: d.providerAuthConfig.authMethodOid }
        })))
      : null;

    if (grantedScopes === null && authMethodScopes === null && !d.providerAuthConfig) {
      return Paginator.create(({ prisma }) => prisma(opts => queryTools(ctx, opts)));
    }

    return Paginator.create(() => async input => {
      let allTools = await queryTools(ctx);
      let filtered = allTools.filter(tool => {
        if (d.providerAuthConfig && !checkToolAuthMethodSatisfied(tool, authMethod).allowed) {
          return false;
        }

        if (
          authMethodScopes !== null &&
          !authMethodScopes.authMethods.every(
            authMethod => checkToolAuthMethodSatisfied(tool, authMethod).allowed
          )
        ) {
          return false;
        }

        if (grantedScopes !== null && !checkToolScopesSatisfied(tool, grantedScopes).allowed) {
          return false;
        }

        if (
          authMethodScopes !== null &&
          !checkToolScopesSatisfiedByAuthMethods(tool, authMethodScopes.scopeSets).allowed
        ) {
          return false;
        }

        return true;
      });
      return paginateInMemory(filtered, input);
    });
  }

  async getProviderToolById(d: MetorialFacing<GetProviderToolByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getProviderToolByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getProviderToolByIdInternal(
    d: {
      tenant?: Tenant;
      environment?: Environment;
    } & GetProviderToolByIdParams
  ) {
    let solution = await getMetorialSolution();

    let providerTool = await db.providerTool.findFirst({
      where: {
        provider: getProviderTenantFilter({
          ...d,
          solution,
          includeDeprecated: true
        }),

        id: d.providerToolId
      },
      include: {
        global: true,
        provider: true,
        specification: { omit: { value: true } }
      }
    });
    if (!providerTool) {
      throw new ServiceError(notFoundError('provider_tool', d.providerToolId));
    }

    return providerTool;
  }
}

export let providerToolService = Service.create(
  'providerToolService',
  () => new providerToolServiceImpl()
).build();
