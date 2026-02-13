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

  let updatedOrganization = await db.organization.update({
    where: { oid: organization.oid },
    data: {
      subspaceTenantId: subspaceTenant.id,
      subspaceTenantIdentifier: subspaceTenant.identifier
    }
  });

  return {
    organization: updatedOrganization,
    instance: updatedInstance
  };
};

export let getTenantForSubspace = async (organization: Organization, instance: Instance) => {
  let hasSubspaceIds = !!instance.subspaceTenantId && !!instance.subspaceEnvironmentId;

  if (!hasSubspaceIds) {
    let synced = await ensureSubspaceTenantAndEnvironment(organization, instance);
    organization = synced.organization;
    instance = synced.instance;
  } else {
    try {
      await subspace.environment.get({
        tenantId: instance.subspaceTenantId!,
        environmentId: instance.subspaceEnvironmentId!
      });
    } catch (error) {
      if (!isSubspaceTenantOrEnvironmentMissing(error)) {
        throw error;
      }

      let synced = await ensureSubspaceTenantAndEnvironment(organization, instance);
      organization = synced.organization;
      instance = synced.instance;
    }
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

  // SUBSPACE_URL can point to the RPC controller base path (for example "/subspace-controller").
  // The MCP connection endpoint lives at the root on a dedicated connection server.
  let url = new URL(env.subspace.SUBSPACE_URL);

  if (url.pathname !== '/' && url.pathname !== '') {
    if (url.pathname.startsWith('/subspace-controller') && url.port === '52070') {
      url.port = '52072';
    }

    url.pathname = '/';
    url.search = '';
    url.hash = '';
  }

  return url.toString();
};
