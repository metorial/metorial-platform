import { mtMap } from '@metorial/util-resource-mapper';

export type PortalsAuthSsoTenantsCreateOutput = {
  object: 'portal.auth.sso_tenant';
  id: string;
  name: string;
  status: 'pending' | 'completed';
  clientId: string;
  counts: { connections: number };
  createdAt: Date;
  updatedAt: Date;
};

export let mapPortalsAuthSsoTenantsCreateOutput =
  mtMap.object<PortalsAuthSsoTenantsCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    clientId: mtMap.objectField('client_id', mtMap.passthrough()),
    counts: mtMap.objectField(
      'counts',
      mtMap.object({
        connections: mtMap.objectField('connections', mtMap.passthrough())
      })
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type PortalsAuthSsoTenantsCreateBody = { name: string };

export let mapPortalsAuthSsoTenantsCreateBody =
  mtMap.object<PortalsAuthSsoTenantsCreateBody>({
    name: mtMap.objectField('name', mtMap.passthrough())
  });

