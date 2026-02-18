import { mtMap } from '@metorial/util-resource-mapper';

export type CustomProvidersDeploymentsGetOutput = {
  object: 'custom_provider.deployment';
  id: string;
  status: string | null;
  trigger: string | null;
  customProviderId: string;
  providerId: string | null;
  customProviderVersionId: string | null;
  commit: {
    id: string;
    type: string | null;
    message: string | null;
    createdAt: Date;
  } | null;
  actor: {
    id: string;
    name: string | null;
    type: string | null;
    organizationActorId: string | null;
  } | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapCustomProvidersDeploymentsGetOutput =
  mtMap.object<CustomProvidersDeploymentsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    trigger: mtMap.objectField('trigger', mtMap.passthrough()),
    customProviderId: mtMap.objectField(
      'custom_provider_id',
      mtMap.passthrough()
    ),
    providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
    customProviderVersionId: mtMap.objectField(
      'custom_provider_version_id',
      mtMap.passthrough()
    ),
    commit: mtMap.objectField(
      'commit',
      mtMap.object({
        id: mtMap.objectField('id', mtMap.passthrough()),
        type: mtMap.objectField('type', mtMap.passthrough()),
        message: mtMap.objectField('message', mtMap.passthrough()),
        createdAt: mtMap.objectField('created_at', mtMap.date())
      })
    ),
    actor: mtMap.objectField(
      'actor',
      mtMap.object({
        id: mtMap.objectField('id', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        type: mtMap.objectField('type', mtMap.passthrough()),
        organizationActorId: mtMap.objectField(
          'organization_actor_id',
          mtMap.passthrough()
        )
      })
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

