import {
  cargo as internalCargo,
  ensureInternalActor,
  ensureInternalScope,
  type InternalScope,
  type InternalScopeOwner
} from '@metorial/internal-clients';
import { db, type Instance, type Organization, type User } from '@metorial/db';
import {
  uploadFile as uploadCargoHttpFile
} from '../../../../systems/_clients/cargo/src';
import type { CargoAccessActor, CargoStorePermission } from './services/access';
import { purposes, purposeSlugs } from './definitions';
import { env } from './env';

export let cargo = internalCargo;

let getCargoUploadEndpoint = () => {
  let url = new URL(env.service.CARGO_API_URL);

  if (url.pathname.endsWith('/metorial-cargo')) {
    url.pathname = url.pathname.slice(0, -'/metorial-cargo'.length) || '/';
  }

  return url.toString().replace(/\/$/, '');
};

export type CargoScope = InternalScope;

type CargoScopeDescriptor = InternalScopeOwner;

type CargoScopeOwner =
  | {
      type: 'user';
      user: Pick<User, 'id'> & Partial<User>;
    }
  | {
      type: 'organization';
      organization: Pick<Organization, 'id'> & Partial<Organization>;
    }
  | {
      type: 'instance';
      organization?: Pick<Organization, 'id'> & Partial<Organization>;
      instance: Pick<Instance, 'id'> & Partial<Instance>;
    };

export type CargoFile = Awaited<ReturnType<typeof cargo.file.create>>;
export type CargoFileList = Awaited<ReturnType<typeof cargo.file.list>>;
export type CargoFileLink = Awaited<ReturnType<typeof cargo.fileLink.create>>;
export type CargoFileLinkList = Awaited<ReturnType<typeof cargo.fileLink.list>>;
export type CargoFileLinkByKeyResult = Awaited<ReturnType<typeof cargo.fileLink.getByKey>>;
export type CargoFileReference = Awaited<ReturnType<typeof cargo.fileReference.create>>;
export type CargoFileReferenceList = Awaited<ReturnType<typeof cargo.fileReference.list>>;
export type CargoActor = Awaited<ReturnType<typeof cargo.actor.upsert>>;
export type CargoDocument = Awaited<ReturnType<typeof cargo.document.create>>;
export type CargoDocumentList = Awaited<ReturnType<typeof cargo.document.list>>;
export type CargoDocumentVersion = Awaited<ReturnType<typeof cargo.documentVersion.get>>;
export type CargoDocumentVersionList = Awaited<ReturnType<typeof cargo.documentVersion.list>>;
export type CargoDocumentParticipant = Awaited<
  ReturnType<typeof cargo.documentParticipant.get>
>;
export type CargoDocumentParticipantList = Awaited<
  ReturnType<typeof cargo.documentParticipant.list>
>;
export type CargoStore = Awaited<ReturnType<typeof cargo.store.create>>;
export type CargoStoreList = Awaited<ReturnType<typeof cargo.store.list>>;
export type CargoStoreItemType = 'file' | 'document' | 'directory';
export type CargoStoreItem = Awaited<ReturnType<typeof cargo.storeItem.get>>;
export type CargoStoreItemList = Awaited<ReturnType<typeof cargo.storeItem.list>>;
export type CargoStoreParticipant = Awaited<ReturnType<typeof cargo.storeParticipant.get>>;
export type CargoStoreParticipantList = Awaited<
  ReturnType<typeof cargo.storeParticipant.list>
>;

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
    type: 'organization',
    organization
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
    type: 'user',
    user
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

  return {
    type: 'instance',
    instance
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

export let ensureCargoScope = async (scope: CargoScopeDescriptor): Promise<CargoScope> =>
  await ensureInternalScope({
    service: 'cargo',
    owner: scope
  });

let resolveCargoUploadActorId = async (d: {
  scope: CargoScope;
  accessActor?: CargoAccessActor;
}) => {
  if (!d.accessActor) return undefined;

  if (d.accessActor.organizationActorId) {
    return (
      await ensureInternalActor({
        service: 'cargo',
        tenantId: d.scope.tenantId,
        actor: {
          type: 'organizationActor',
          organizationActor: {
            id: d.accessActor.organizationActorId
          }
        }
      })
    ).id;
  }

  if (d.accessActor.consumerId) {
    return (
      await ensureInternalActor({
        service: 'cargo',
        tenantId: d.scope.tenantId,
        actor: {
          type: 'consumer',
          consumer: {
            id: d.accessActor.consumerId
          }
        }
      })
    ).id;
  }

  let actor = await cargo.actor.upsert({
    tenantId: d.scope.tenantId,
    identifier: d.accessActor.identifier ?? d.accessActor.name,
    name: d.accessActor.name,
    type: 'external'
  });

  return actor.id;
};

export let uploadCargoFile = async (d: {
  owner: CargoScopeOwner;
  purpose: string;
  file: Blob;
  fileName: string;
  storeId?: string;
  title?: string;
  fileId?: string;
  accessActor?: CargoAccessActor;
  defaultPermissions?: CargoStorePermission[];
  overridePermissions?: boolean;
  store?: {
    id: string;
    path: string;
  };
}) => {
  let descriptor = await resolveCargoScopeDescriptorForOwner(d.owner);
  if (!descriptor) {
    throw new Error(`Unable to resolve cargo scope for owner: ${d.owner.type}`);
  }

  let scope = await ensureCargoScope(descriptor);
  let actorId = await resolveCargoUploadActorId({
    scope,
    accessActor: d.accessActor
  });

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
      actorId,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions,
      storeId: d.storeId,
      store: d.store,
      title: d.title,
      fileId: d.fileId
    } as any
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
