import type {
  Consumer,
  Instance,
  Organization,
  OrganizationActor,
  Project,
  User
} from '@metorial/db';

export type InternalService = 'nebula' | 'subspace';

export type InternalScope = {
  tenantId: string;
  environmentId: string;
  tenantIdentifier: string;
  environmentIdentifier: string;
  tenantName: string;
  environmentName: string;
  environmentType: 'development' | 'production';
};

export type InternalProject = Pick<Project, 'id'> &
  Partial<Project> & {
    instances?: Instance[];
  };

export type LoadedInternalProject = Project & {
  instances?: Instance[];
};

export type InternalInstance = Pick<Instance, 'id'> &
  Partial<Instance> & {
    project?: InternalProject;
    organization?: Organization;
  };

export type LoadedInternalInstance = Instance & {
  project?: LoadedInternalProject;
  organization?: Organization;
};

export type InternalScopeOwner =
  | {
      type: 'instance';
      instance: InternalInstance;
    }
  | {
      type: 'user';
      user: User;
    };

export type InternalActorRef =
  | {
      type: 'organizationActor';
      organizationActor: Pick<OrganizationActor, 'id'> & Partial<OrganizationActor>;
    }
  | {
      type: 'consumer';
      consumer: Pick<Consumer, 'id'> & Partial<Consumer>;
    };

export type InternalActorLink = {
  id: string;
};
