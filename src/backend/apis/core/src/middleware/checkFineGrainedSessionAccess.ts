import { forbiddenError, ServiceError } from '@lowerdeck/error';
import { AuthInfo, Scope } from '@metorial/module-access';
import { subspaceEnclaveService } from '@metorial/module-subspace';
import { apiGroup } from './apiGroup';

type FineGrainedSessionCtx = {
  auth: AuthInfo;
  params: Record<string, any>;
  query: Record<string, any>;
  body: Record<string, any>;
  context: { ip: string };
  url: string;
} & Record<string, any>;

let getAllowedSessionIds = (
  ctx: FineGrainedSessionCtx,
  requiredRoles?: Scope[]
): undefined | string[] => {
  if (ctx.auth.type != 'fine_grained' || ctx.auth.restrictions.type != 'instance')
    return undefined;

  let grants = ctx.auth.restrictions.accessTagGrants.filter(
    (grant: { resourceType: string; resourceId: string; roles: Scope[] }) =>
      grant.resourceType == 'subspace.session' &&
      (!requiredRoles || grant.roles.some(role => requiredRoles.includes(role)))
  );

  return Array.from(new Set(grants.map((grant: { resourceId: string }) => grant.resourceId)));
};

export let getFineGrainedAllowedSessionIds = (
  ctx: FineGrainedSessionCtx,
  requiredRoles?: Scope[]
) => getAllowedSessionIds(ctx, requiredRoles);

let getFineGrainedInstance = (ctx: FineGrainedSessionCtx) => {
  if (ctx.auth.type != 'fine_grained' || ctx.auth.restrictions.type != 'instance') {
    return undefined;
  }

  return {
    ...ctx.auth.restrictions.instance,
    organization: ctx.auth.restrictions.organization
  } as any;
};

let getRequestHost = (ctx: FineGrainedSessionCtx) => {
  try {
    let url = new URL(ctx.url);
    return {
      hostname: url.hostname,
      port: url.port
        ? Number(url.port)
        : url.protocol === 'https:'
          ? 443
          : url.protocol === 'http:'
            ? 80
            : 0
    };
  } catch {
    return { hostname: 'api', port: 0 };
  }
};

let filterIngressAllowedSessionIds = async (d: {
  ctx: FineGrainedSessionCtx;
  sessionIds: string[];
  recordLog?: boolean;
}) => {
  let instance = getFineGrainedInstance(d.ctx);
  if (!instance || d.sessionIds.length === 0) return d.sessionIds;

  let host = getRequestHost(d.ctx);
  let check = await subspaceEnclaveService.checkIngressAccess({
    instance,
    sessionIds: d.sessionIds,
    sourceIp: d.ctx.context.ip,
    hostname: host.hostname,
    port: host.port,
    recordLog: d.recordLog
  });

  return check.results
    .filter((result: any) => result.allowed)
    .map((result: any) => result.sessionId);
};

let ensureSessionAllowed = async (d: {
  ctx: FineGrainedSessionCtx;
  sessionId: string | undefined;
  requiredRoles?: Scope[];
  message?: string;
}) => {
  let allowedSessionIds = getAllowedSessionIds(d.ctx, d.requiredRoles);
  if (!allowedSessionIds) return;

  if (!d.sessionId || !allowedSessionIds.includes(d.sessionId)) {
    throw new ServiceError(
      forbiddenError({
        message: d.message ?? 'Fine grained token is not authorized for this session'
      })
    );
  }

  let ingressAllowedSessionIds = await filterIngressAllowedSessionIds({
    ctx: d.ctx,
    sessionIds: [d.sessionId],
    recordLog: true
  });

  if (!ingressAllowedSessionIds.includes(d.sessionId)) {
    throw new ServiceError(
      forbiddenError({
        message: 'Ingress network policy blocked access to this session'
      })
    );
  }
};

export let requireFineGrainedSessionAccess = (d: {
  resolveSessionId: (ctx: FineGrainedSessionCtx) => string | undefined;
  requiredRoles?: Scope[];
  message?: string;
}) =>
  apiGroup.createMiddleware(async ctx => {
    await ensureSessionAllowed({
      ctx,
      sessionId: d.resolveSessionId(ctx),
      requiredRoles: d.requiredRoles,
      message: d.message
    });
  });

export let requireFineGrainedSessionParam = (
  param: string = 'sessionId',
  opts?: { requiredRoles?: Scope[]; message?: string }
) =>
  requireFineGrainedSessionAccess({
    resolveSessionId: ctx => ctx.params[param],
    requiredRoles: opts?.requiredRoles,
    message: opts?.message
  });

export let requireFineGrainedSessionFromResource = (
  resolveSessionId: (ctx: FineGrainedSessionCtx) => string | undefined,
  opts?: { requiredRoles?: Scope[]; message?: string }
) =>
  requireFineGrainedSessionAccess({
    resolveSessionId,
    requiredRoles: opts?.requiredRoles,
    message: opts?.message
  });

export let constrainFineGrainedSessionQuery = (
  queryKey: string,
  opts?: { denyWhenMissing?: boolean; requiredRoles?: Scope[] }
) =>
  apiGroup.createMiddleware(async ctx => {
    let query = ctx.query as Record<string, any>;
    let allowedSessionIds = getAllowedSessionIds(ctx, opts?.requiredRoles);
    if (!allowedSessionIds) return;
    if (allowedSessionIds.length == 0) {
      throw new ServiceError(
        forbiddenError({
          message: 'Fine grained token is not authorized for any sessions'
        })
      );
    }

    let currentValue = query[queryKey];
    if (
      opts?.denyWhenMissing &&
      (currentValue === undefined || currentValue === null || currentValue === '')
    ) {
      throw new ServiceError(
        forbiddenError({
          message: 'This endpoint requires explicit session filters for fine grained tokens'
        })
      );
    }

    if (currentValue === undefined || currentValue === null || currentValue === '') {
      query[queryKey] = await filterIngressAllowedSessionIds({
        ctx,
        sessionIds: allowedSessionIds
      });
      return;
    }

    let current = Array.isArray(currentValue) ? currentValue : [currentValue];
    let intersection = current.filter(v => allowedSessionIds.includes(v));
    intersection = await filterIngressAllowedSessionIds({
      ctx,
      sessionIds: intersection
    });
    if (intersection.length == 0) {
      throw new ServiceError(
        forbiddenError({
          message: 'Fine grained token is not authorized for the requested sessions'
        })
      );
    }

    query[queryKey] = intersection;
  });

export let requireFineGrainedSessionBody = (
  bodyField: string = 'session_id',
  opts?: { requiredRoles?: Scope[]; message?: string }
) =>
  requireFineGrainedSessionAccess({
    resolveSessionId: ctx => ctx.body?.[bodyField],
    requiredRoles: opts?.requiredRoles,
    message: opts?.message
  });
