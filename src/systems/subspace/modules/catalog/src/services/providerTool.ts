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
  resolveGrantedScopes
} from '@metorial-subspace/module-provider-internal';
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
    ? { providerTools: { some: { specificationOid: ctx.version.specificationOid } } }
    : { currentInstance: { isNot: null } })
});

let buildToolsInclude = (ctx: ListToolsContext) => ({
  provider: true,
  currentInstance: ctx.version
    ? false
    : { include: { specification: { omit: { value: true } } } },
  providerTools: ctx.version?.specificationOid
    ? {
        where: { specificationOid: ctx.version.specificationOid },
        include: { specification: { omit: { value: true } } }
      }
    : false
});

let patchGlobalCursor = async (
  ctx: ListToolsContext,
  cursor?: { id: string }
) => {
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

class providerToolServiceImpl {
  async listProviderTools(d: {
    solution: Solution;
    tenant?: Tenant;
    environment?: Environment;

    providerVersion: ProviderVersion;

    providerAuthConfig?: (ProviderAuthConfig & { authMethod?: ProviderAuthMethod | null }) | null;
    providerAuthCredentials?: ProviderAuthCredentials | null;
  }) {
    let version = d.providerVersion?.oid
      ? await db.providerVersion.findFirstOrThrow({
          where: { oid: d.providerVersion.oid }
        })
      : null;

    let ctx: ListToolsContext = {
      solution: d.solution,
      tenant: d.tenant,
      environment: d.environment,
      providerVersion: d.providerVersion,
      version
    };

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

    if (grantedScopes === null && !d.providerAuthConfig) {
      return Paginator.create(({ prisma }) => prisma(opts => queryTools(ctx, opts)));
    }

    return Paginator.create(() => async input => {
      let allTools = await queryTools(ctx);
      let filtered = allTools.filter(tool => {
        if (
          d.providerAuthConfig &&
          !checkToolAuthMethodSatisfied(tool, authMethod).allowed
        ) {
          return false;
        }

        return grantedScopes === null
          ? true
          : checkToolScopesSatisfied(tool, grantedScopes).allowed;
      });
      return paginateInMemory(filtered, input);
    });
  }

  async getProviderToolById(d: {
    solution: Solution;
    tenant?: Tenant;
    environment?: Environment;
    providerToolId: string;
  }) {
    let providerTool = await db.providerTool.findFirst({
      where: {
        provider: getProviderTenantFilter({
          ...d,
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
