import { forbiddenError, ServiceError } from '@lowerdeck/error';
import type { Instance, Organization, Project } from '@metorial/db';
import type { AuthInfo, Scope } from '@metorial/module-access';
import { type BooleanFlagKey, flagService, isFlagEnabled } from '@metorial/module-flags';
import { hasAccess } from './checkAccess';

let integrationsFlag: BooleanFlagKey = 'paid-integrations';

let skillsFlag: BooleanFlagKey = 'skills-enabled';

let toolCallReadScope: Scope = 'instance.provider.session:read';

let providerReadScope: Scope = 'instance.provider:read';

let skillReadScope: Scope = 'instance.skill:read';

type IntegrationsAccessContext = {
  auth: AuthInfo;
  organization: Organization;
  project: Project;
  instance: Instance;
};

export type IntegrationsAccess = {
  toolCalls: () => Promise<boolean>;
  providers: () => Promise<boolean>;
  skills: () => Promise<boolean>;
};

let once = <T>(load: () => Promise<T>) => {
  let loaded: Promise<T> | undefined;

  return () => (loaded ??= load());
};

export let createIntegrationsAccess = (ctx: IntegrationsAccessContext): IntegrationsAccess => {
  let flags = once(() =>
    flagService.getFlags({ organization: ctx.organization, project: ctx.project })
  );

  let canRead = (flag: BooleanFlagKey, scope: Scope) =>
    once(
      async () =>
        isFlagEnabled((await flags())[flag]) &&
        (await hasAccess(ctx, { possibleScopes: [scope] }))
    );

  return {
    toolCalls: canRead(integrationsFlag, toolCallReadScope),
    providers: canRead(integrationsFlag, providerReadScope),
    skills: canRead(skillsFlag, skillReadScope)
  };
};

export let withIntegrationsAccess = () => async (ctx: IntegrationsAccessContext) => ({
  integrationsAccess: createIntegrationsAccess(ctx)
});

export let requireToolCallReadAccess =
  () => async (ctx: { integrationsAccess: IntegrationsAccess }) => {
    if (await ctx.integrationsAccess.toolCalls()) return;

    throw new ServiceError(
      forbiddenError({
        message: `You don't have the required permissions to perform this action`
      })
    );
  };
