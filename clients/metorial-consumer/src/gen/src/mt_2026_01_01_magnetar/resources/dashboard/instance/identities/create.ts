import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceIdentitiesCreateOutput = {
  object: 'identity';
  id: string;
  status: 'active' | 'archived' | 'deleted';
  name: string | null;
  description: string | null;
  metadata: Record<string, any> | null;
  owner: {
    type: 'actor';
    actor: {
      object: 'identity.actor';
      id: string;
      type: 'person' | 'agent';
      status: 'active' | 'archived' | 'deleted';
      name: string;
      description: string | null;
      metadata: Record<string, any> | null;
      agentId: string | null;
      createdAt: Date;
      updatedAt: Date;
    };
  };
  credentials: {
    object: 'identity.credential';
    id: string;
    status: 'active' | 'archived' | 'deleted';
    identityId: string;
    providerId: string;
    deploymentId: string | null;
    configId: string | null;
    authConfigId: string | null;
    delegationConfigId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  delegationConfigId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstanceIdentitiesCreateOutput =
  mtMap.object<DashboardInstanceIdentitiesCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    owner: mtMap.objectField(
      'owner',
      mtMap.object({
        type: mtMap.objectField('type', mtMap.passthrough()),
        actor: mtMap.objectField(
          'actor',
          mtMap.object({
            object: mtMap.objectField('object', mtMap.passthrough()),
            id: mtMap.objectField('id', mtMap.passthrough()),
            type: mtMap.objectField('type', mtMap.passthrough()),
            status: mtMap.objectField('status', mtMap.passthrough()),
            name: mtMap.objectField('name', mtMap.passthrough()),
            description: mtMap.objectField('description', mtMap.passthrough()),
            metadata: mtMap.objectField('metadata', mtMap.passthrough()),
            agentId: mtMap.objectField('agent_id', mtMap.passthrough()),
            createdAt: mtMap.objectField('created_at', mtMap.date()),
            updatedAt: mtMap.objectField('updated_at', mtMap.date())
          })
        )
      })
    ),
    credentials: mtMap.objectField(
      'credentials',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          identityId: mtMap.objectField('identity_id', mtMap.passthrough()),
          providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
          deploymentId: mtMap.objectField('deployment_id', mtMap.passthrough()),
          configId: mtMap.objectField('config_id', mtMap.passthrough()),
          authConfigId: mtMap.objectField(
            'auth_config_id',
            mtMap.passthrough()
          ),
          delegationConfigId: mtMap.objectField(
            'delegation_config_id',
            mtMap.passthrough()
          ),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          updatedAt: mtMap.objectField('updated_at', mtMap.date())
        })
      )
    ),
    delegationConfigId: mtMap.objectField(
      'delegation_config_id',
      mtMap.passthrough()
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type DashboardInstanceIdentitiesCreateBody = {
  actorId: string;
  name?: string | undefined;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
  credentials?:
    | {
        deploymentId?: string | undefined;
        configId?: string | undefined;
        authConfigId?: string | undefined;
        delegationConfigId?: string | undefined;
      }[]
    | undefined;
};

export let mapDashboardInstanceIdentitiesCreateBody =
  mtMap.object<DashboardInstanceIdentitiesCreateBody>({
    actorId: mtMap.objectField('actor_id', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    credentials: mtMap.objectField(
      'credentials',
      mtMap.array(
        mtMap.object({
          deploymentId: mtMap.objectField('deployment_id', mtMap.passthrough()),
          configId: mtMap.objectField('config_id', mtMap.passthrough()),
          authConfigId: mtMap.objectField(
            'auth_config_id',
            mtMap.passthrough()
          ),
          delegationConfigId: mtMap.objectField(
            'delegation_config_id',
            mtMap.passthrough()
          )
        })
      )
    )
  });

