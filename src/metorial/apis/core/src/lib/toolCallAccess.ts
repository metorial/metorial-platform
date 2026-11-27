import { isServiceError } from '@lowerdeck/error';
import type { Instance, Organization, Project } from '@metorial/db';
import type { AuthInfo } from '@metorial/module-access';
import { flagService, isFlagEnabled } from '@metorial/module-flags';
import { assertAccess } from '../middleware/checkAccess';

let toolCallReadScope = 'instance.provider.session:read' as const;

let providerReadScope = 'instance.provider:read' as const;

let integrationsFlag = 'paid-integrations' as const;

type IntegrationsAccessContext = {
  auth: AuthInfo;
  organization: Organization;
  project: Project;
  instance: Instance;
};

let canReadIntegrations = async (
  ctx: IntegrationsAccessContext,
  scope: typeof toolCallReadScope | typeof providerReadScope
) => {
  let flags = await flagService.getFlags({
    organization: ctx.organization,
    project: ctx.project
  });
  if (!isFlagEnabled(flags[integrationsFlag])) return false;

  try {
    await assertAccess(ctx, { possibleScopes: [scope] });
    return true;
  } catch (error) {
    if (isServiceError(error) && error.data.status == 403) return false;
    throw error;
  }
};

export let canReadToolCalls = (ctx: IntegrationsAccessContext) =>
  canReadIntegrations(ctx, toolCallReadScope);

export let canReadProviders = (ctx: IntegrationsAccessContext) =>
  canReadIntegrations(ctx, providerReadScope);
