import { mtMap } from '@metorial/util-resource-mapper';

export type ProvidersVersionsGetOutput = {
  object: 'provider.version';
  id: string;
  version: string;
  providerId: string;
  isCurrent: boolean;
  name: string;
  description: string | null;
  metadata: Record<string, any> | null;
  specificationId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapProvidersVersionsGetOutput =
  mtMap.object<ProvidersVersionsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    version: mtMap.objectField('version', mtMap.passthrough()),
    providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
    isCurrent: mtMap.objectField('is_current', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    specificationId: mtMap.objectField('specification_id', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

