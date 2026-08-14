import type { Instance, OrganizationActor, Project } from '@metorial/db';
import type { ProviderEventBase } from '@metorial/fabric';
import type { Environment, Solution, Tenant, TenantActor } from '@metorial-subspace/db';
import { subspaceScopeService } from '../services/subspaceScope';

type ScopeKeys = 'tenant' | 'solution' | 'environment' | 'actor';

export type MetorialFacing<T> = Omit<T, ScopeKeys> & {
  instance: Instance;
  organizationActor?: OrganizationActor;
  project?: Project;
};

export type MetorialFacingWithActor<T> = Omit<T, ScopeKeys> & {
  instance: Instance;
  organizationActor: OrganizationActor;
  project?: Project;
};

export type InternalScope = {
  tenant: Tenant;
  environment: Environment;
};

export type InternalScopeWithActor = InternalScope & {
  actor: TenantActor;
};

export type ResolvedMetorialScope = {
  tenant: Tenant;
  environment: Environment;
  solution: Solution;
};

export type ResolvedMetorialScopeWithActor = ResolvedMetorialScope & {
  actor: TenantActor;
};

export let toProviderEventBase = (d: {
  instance: Instance;
  organizationActor?: OrganizationActor;
  [key: string]: unknown;
}): ProviderEventBase => {
  let { instance, organizationActor, project, ...input } = d;
  return { instance, organizationActor, input };
};

export let resolveMetorialFacing = async (d: {
  instance: Instance;
  organizationActor?: OrganizationActor;
}): Promise<ResolvedMetorialScope> => {
  let { tenant, environment, solution } = await subspaceScopeService.ensureForInstance(
    d.instance
  );
  return { tenant, environment, solution };
};

export let resolveMetorialFacingWithActor = async (d: {
  instance: Instance;
  organizationActor: OrganizationActor;
}): Promise<ResolvedMetorialScopeWithActor> => {
  let scope = await resolveMetorialFacing(d);
  let actor = await subspaceScopeService.ensureForOrganizationActor({
    tenant: scope.tenant,
    organizationActor: d.organizationActor
  });
  return { ...scope, actor };
};

export let resolveMetorialFacingWithOptionalActor = async (d: {
  instance: Instance;
  organizationActor?: OrganizationActor;
}): Promise<ResolvedMetorialScope & { actor?: TenantActor }> => {
  let scope = await resolveMetorialFacing(d);

  if (d.organizationActor) {
    let actor = await subspaceScopeService.ensureForOrganizationActor({
      tenant: scope.tenant,
      organizationActor: d.organizationActor
    });
    return { ...scope, actor };
  }

  return scope;
};

export let getMetorialSolution = () => subspaceScopeService.getSolution();
