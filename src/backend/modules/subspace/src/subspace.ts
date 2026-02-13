import { createSubspaceControllerClient } from '@metorial-services/subspace-client';
import { db, OrganizationActor, type Instance, type Organization } from '@metorial/db';
import { env } from './env';

type SubspaceClient = ReturnType<typeof createSubspaceControllerClient>;

export let subspace: SubspaceClient = createSubspaceControllerClient({
  headers: {
    'Subspace-Solution-Id': env.subspace.SUBSPACE_SOLUTION
  },
  endpoint: env.subspace.SUBSPACE_URL
});

subspace.solution
  .upsert({
    name: 'Metorial Platform',
    identifier: env.subspace.SUBSPACE_SOLUTION
  })
  .catch((err: unknown) => {
    console.error('Failed to upsert subspace solution:', err);
    process.exit(1);
  });

let isSubspaceTenantOrEnvironmentMissing = (error: unknown) => {
  type ErrorWithStatus = {
    data?: { status?: unknown };
    response?: { status?: unknown };
  };

  let status =
    (error as ErrorWithStatus | undefined)?.data?.status ??
    (error as ErrorWithStatus | undefined)?.response?.status;

  if (status === 404) return true;

  let message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : String(error);
  let normalized = message.toLowerCase();

  return (
    normalized.includes('requested tenant could not be found') ||
    normalized.includes('requested environment could not be found')
  );
};

let ensureSubspaceTenantAndEnvironment = async (
  organization: Organization,
  instance: Instance
) => {
  let orgInstances = await db.instance.findMany({
    where: { organizationOid: organization.oid }
  });

  let subspaceTenant = await subspace.tenant.upsert({
    identifier: `mteo-${organization.id}`,
    name: organization.name,
    environments: orgInstances.map(i => ({
      identifier: `mtei-${i.id}`,
      name: i.name,
      type: i.type
    }))
  });

  let subspaceEnvironment = await subspace.environment.upsert({
    tenantId: subspaceTenant.id,
    identifier: `mtei-${instance.id}`,
    name: instance.name,
    type: instance.type
  });

  let updatedInstance = await db.instance.update({
    where: { oid: instance.oid },
    data: {
      subspaceTenantId: subspaceTenant.id,
      subspaceTenantIdentifier: subspaceTenant.identifier,

      subspaceEnvironmentId: subspaceEnvironment.id,
      subspaceEnvironmentIdentifier: subspaceEnvironment.identifier
    }
  });

  await db.organization.update({
    where: { oid: organization.oid },
    data: {
      subspaceTenantId: subspaceTenant.id,
      subspaceTenantIdentifier: subspaceTenant.identifier
    }
  });

  return updatedInstance;
};

let hasStoredSubspaceIds = (instance: Instance) =>
  !!instance.subspaceTenantId && !!instance.subspaceEnvironmentId;

let hasValidStoredSubspaceLink = async (instance: Instance) => {
  if (!hasStoredSubspaceIds(instance)) return false;

  try {
    await subspace.environment.get({
      tenantId: instance.subspaceTenantId!,
      environmentId: instance.subspaceEnvironmentId!
    });

    return true;
  } catch (error) {
    if (isSubspaceTenantOrEnvironmentMissing(error)) return false;

    throw error;
  }
};

export let getTenantForSubspace = async (organization: Organization, instance: Instance) => {
  let hasValidLink = await hasValidStoredSubspaceLink(instance);

  if (!hasValidLink) {
    instance = await ensureSubspaceTenantAndEnvironment(organization, instance);
  }

  return {
    tenant: {
      id: instance.subspaceTenantId!,
      identifier: instance.subspaceTenantIdentifier!
    },
    environment: {
      id: instance.subspaceEnvironmentId!,
      identifier: instance.subspaceEnvironmentIdentifier!
    }
  };
};

export let getActorForSubspace = async (
  tenant: Awaited<ReturnType<typeof getTenantForSubspace>>['tenant'],
  organizationActor: OrganizationActor
) => {
  return await subspace.actor.upsert({
    tenantId: tenant.id,
    identifier: `mtea-${organizationActor.id}`,
    name: organizationActor.name,
    organizationActorId: organizationActor.id,
    type: 'external'
  });
};

export let getSubspaceSolutionIdentifier = () => env.subspace.SUBSPACE_SOLUTION;

export let getSubspaceConnectionUrl = () => {
  if (env.subspace.SUBSPACE_URL_CONNECTION) {
    return env.subspace.SUBSPACE_URL_CONNECTION;
  }

  let controllerUrl = new URL(env.subspace.SUBSPACE_URL);
  let path = controllerUrl.pathname.replace(/\/+$/, '');

  if (path.startsWith('/subspace-controller')) {
    throw new Error(
      'SUBSPACE_URL_CONNECTION is required when SUBSPACE_URL points to /subspace-controller'
    );
  }

  return controllerUrl.toString();
};
