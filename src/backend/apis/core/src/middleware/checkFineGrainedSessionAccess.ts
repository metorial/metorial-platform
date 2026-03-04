import { forbiddenError, ServiceError } from '@lowerdeck/error';
import { AuthInfo, Scope } from '@metorial/module-access';
import { apiGroup } from './apiGroup';

type FineGrainedSessionCtx = {
  auth: AuthInfo;
  params: Record<string, any>;
  query: Record<string, any>;
  body: Record<string, any>;
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

let ensureSessionAllowed = (d: {
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
};

export let requireFineGrainedSessionAccess = (d: {
  resolveSessionId: (ctx: FineGrainedSessionCtx) => string | undefined;
  requiredRoles?: Scope[];
  message?: string;
}) =>
  apiGroup.createMiddleware(async ctx => {
    ensureSessionAllowed({
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
      query[queryKey] = allowedSessionIds;
      return;
    }

    let current = Array.isArray(currentValue) ? currentValue : [currentValue];
    let intersection = current.filter(v => allowedSessionIds.includes(v));
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
