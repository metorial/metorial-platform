import { mtMap } from '@metorial/util-resource-mapper';

export type ProviderTemplatesCreateOutput = {
  object: 'provider.template';
  id: string;
  status: 'active' | 'archived' | 'deleted';
  name: string;
  description: string | null;
  metadata: Record<string, any>;
  providerDeploymentId: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapProviderTemplatesCreateOutput =
  mtMap.object<ProviderTemplatesCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    providerDeploymentId: mtMap.objectField(
      'provider_deployment_id',
      mtMap.passthrough()
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type ProviderTemplatesCreateBody = {
  name: string;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
} & (
  | { providerDeploymentId: string }
  | {
      providerDeployment: {
        providerId: string;
        name?: string | undefined;
        description?: string | undefined;
        metadata?: Record<string, any> | undefined;
        lockedProviderVersionId?: string | undefined;
      };
    }
);

export let mapProviderTemplatesCreateBody = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      name: mtMap.objectField('name', mtMap.passthrough()),
      description: mtMap.objectField('description', mtMap.passthrough()),
      metadata: mtMap.objectField('metadata', mtMap.passthrough()),
      providerDeploymentId: mtMap.objectField(
        'provider_deployment_id',
        mtMap.passthrough()
      ),
      providerDeployment: mtMap.objectField(
        'provider_deployment',
        mtMap.object({
          providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          description: mtMap.objectField('description', mtMap.passthrough()),
          metadata: mtMap.objectField('metadata', mtMap.passthrough()),
          lockedProviderVersionId: mtMap.objectField(
            'locked_provider_version_id',
            mtMap.passthrough()
          )
        })
      )
    })
  )
]);

