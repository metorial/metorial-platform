import { db, Instance, Organization, User } from '@metorial/db';
import { getTenantForSubspace } from '@metorial/module-subspace';
import {
  createCargoClient,
  uploadFile as uploadCargoHttpFile
} from '../../../../systems/_clients/cargo/src';
import { purposes, purposeSlugs } from './definitions';
import { env } from './env';

export let cargo = createCargoClient({
  endpoint: env.service.CARGO_API_URL
});

let getCargoUploadEndpoint = () => {
  let url = new URL(env.service.CARGO_API_URL);

  if (url.pathname.endsWith('/metorial-cargo')) {
    url.pathname = url.pathname.slice(0, -'/metorial-cargo'.length) || '/';
  }

  return url.toString().replace(/\/$/, '');
};

export type CargoScope = {
  tenantId: string;
  environmentId: string;
  tenantIdentifier: string;
  environmentIdentifier: string;
  tenantName: string;
  environmentName: string;
  environmentType: 'development' | 'production';
};

type CargoScopeDescriptor = Omit<CargoScope, 'tenantId' | 'environmentId'>;

type CargoScopeOwner =
  | {
      type: 'user';
      user: Pick<User, 'id'>;
    }
  | {
      type: 'organization';
      organization: Pick<Organization, 'id' | 'name'>;
    }
  | {
      type: 'instance';
      organization: Pick<Organization, 'id' | 'name'>;
      instance: Pick<Instance, 'id' | 'name' | 'type'>;
    };

export type CargoFile = Awaited<ReturnType<typeof cargo.file.create>>;
export type CargoFileList = Awaited<ReturnType<typeof cargo.file.list>>;
export type CargoFileLink = Awaited<ReturnType<typeof cargo.fileLink.create>>;
export type CargoFileLinkList = Awaited<ReturnType<typeof cargo.fileLink.list>>;
export type CargoFileLinkByKeyResult = Awaited<ReturnType<typeof cargo.fileLink.getByKey>>;
export type CargoFileReference = Awaited<ReturnType<typeof cargo.fileReference.create>>;
export type CargoFileReferenceList = Awaited<ReturnType<typeof cargo.fileReference.list>>;

let defaultEnvironmentIdentifier = 'default';
let getOrganizationTenantIdentifier = (organization: { oid: bigint }) =>
  `mte-org-${organization.oid}`;
let getUserTenantIdentifier = (user: { oid: bigint }) => `mte-usr-${user.oid}`;

let pickPreferredInstance = <
  T extends {
    id: string;
    name: string;
    type: 'development' | 'production';
    project: { id: string; name: string };
  }
>(
  instances: T[]
) =>
  instances.sort((a, b) => {
    if (a.type === b.type) return 0;
    return a.type === 'production' ? -1 : 1;
  })[0];

export let resolveCargoScopeDescriptorForProject = async (
  projectId: string
): Promise<CargoScopeDescriptor | null> => {
  let project = await db.project.findUnique({
    where: {
      id: projectId
    },
    include: {
      instances: {
        where: {
          status: 'active'
        },
        orderBy: {
          createdAt: 'asc'
        }
      }
    }
  });
  if (!project) return null;

  let instance = pickPreferredInstance(
    project.instances.map(instance => ({
      id: instance.id,
      name: instance.name,
      type: instance.type,
      project: {
        id: project.id,
        name: project.name
      }
    }))
  );
  if (!instance) return null;

  return await getScopeDescriptorFromInstance(instance.id);
};

let getScopeDescriptorFromOrganization = async (
  organizationId: string
): Promise<CargoScopeDescriptor | null> => {
  let organization = await db.organization.findUnique({
    where: {
      id: organizationId
    }
  });
  if (!organization) return null;

  return {
    tenantIdentifier: getOrganizationTenantIdentifier(organization),
    environmentIdentifier: defaultEnvironmentIdentifier,
    tenantName: organization.name,
    environmentName: 'Default',
    environmentType: 'production'
  };
};

let getScopeDescriptorFromUser = async (
  userId: string
): Promise<CargoScopeDescriptor | null> => {
  let user = await db.user.findUnique({
    where: {
      id: userId
    }
  });
  if (!user) return null;

  return {
    tenantIdentifier: getUserTenantIdentifier(user),
    environmentIdentifier: defaultEnvironmentIdentifier,
    tenantName: user.name,
    environmentName: 'Default',
    environmentType: 'production'
  };
};

let getScopeDescriptorFromInstance = async (
  instanceId: string
): Promise<CargoScopeDescriptor | null> => {
  let instance = await db.instance.findUnique({
    where: {
      id: instanceId
    },
    include: {
      project: true,
      organization: true
    }
  });
  if (!instance) return null;

  let { tenant, environmentIdentifier } = await getTenantForSubspace(instance);

  return {
    tenantIdentifier: instance.project.subspaceTenantIdentifier ?? tenant.identifier,
    environmentIdentifier: instance.subspaceEnvironmentIdentifier ?? environmentIdentifier,
    tenantName: instance.project.name,
    environmentName: instance.name,
    environmentType: instance.type
  };
};

export let resolveCargoScopeDescriptorForOwner = async (
  owner: CargoScopeOwner
): Promise<CargoScopeDescriptor | null> => {
  if (owner.type === 'instance') {
    return await getScopeDescriptorFromInstance(owner.instance.id);
  }

  if (owner.type === 'organization') {
    return await getScopeDescriptorFromOrganization(owner.organization.id);
  }

  return await getScopeDescriptorFromUser(owner.user.id);
};

export let resolveCargoScopeDescriptorForFile = async (
  fileId: string
): Promise<CargoScopeDescriptor | null> => {
  let file = await db.file.findUnique({
    where: {
      id: fileId
    },
    include: {
      instance: {
        include: {
          project: true
        }
      },
      organization: true,
      user: true,
      links: {
        include: {
          references: true
        }
      }
    }
  });
  if (!file) return null;

  if (file.instance) {
    return await getScopeDescriptorFromInstance(file.instance.id);
  }

  let projectReference = file.links
    .flatMap(link => link.references)
    .find(reference => reference.entityType === 'project_brand');
  if (projectReference) {
    let scope = await resolveCargoScopeDescriptorForProject(projectReference.entityId);
    if (scope) return scope;
  }

  if (file.organization) {
    let scope = await getScopeDescriptorFromOrganization(file.organization.id);
    if (scope) return scope;
  }

  if (file.user) {
    return await getScopeDescriptorFromUser(file.user.id);
  }

  return null;
};

export let ensureCargoScope = async (scope: CargoScopeDescriptor): Promise<CargoScope> => {
  let tenant = await cargo.tenant.upsert({
    identifier: scope.tenantIdentifier,
    name: scope.tenantName
  });

  let environment = await cargo.environment.upsert({
    tenantId: tenant.id,
    identifier: scope.environmentIdentifier,
    name: scope.environmentName,
    type: scope.environmentType
  });

  return {
    tenantId: tenant.id,
    environmentId: environment.id,
    tenantIdentifier: tenant.identifier,
    environmentIdentifier: environment.identifier,
    tenantName: tenant.name,
    environmentName: environment.name,
    environmentType: environment.type
  };
};

export let uploadCargoFile = async (d: {
  owner: CargoScopeOwner;
  purpose: string;
  file: Blob;
  fileName: string;
  storeId?: string;
  title?: string;
  fileId?: string;
}) => {
  let descriptor = await resolveCargoScopeDescriptorForOwner(d.owner);
  if (!descriptor) {
    throw new Error(`Unable to resolve cargo scope for owner: ${d.owner.type}`);
  }

  let scope = await ensureCargoScope(descriptor);

  return await uploadCargoHttpFile(
    {
      uploadEndpoint: getCargoUploadEndpoint(),
      contentEndpoint: getCargoUploadEndpoint()
    },
    {
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      purpose: d.purpose,
      file: d.file,
      fileName: d.fileName,
      storeId: d.storeId,
      title: d.title,
      fileId: d.fileId
    }
  );
};

export let reconcileCargoPurposes = async () => {
  let items = await Promise.all(
    purposeSlugs.map(async slug => {
      let purpose = await purposes[slug as keyof typeof purposes];

      return {
        id: purpose.id,
        slug: purpose.slug,
        name: purpose.name,
        ownerType: purpose.ownerType,
        canHaveLinks: purpose.canHaveLinks
      };
    })
  );

  return await cargo.reconcile.purposes({ items });
};
