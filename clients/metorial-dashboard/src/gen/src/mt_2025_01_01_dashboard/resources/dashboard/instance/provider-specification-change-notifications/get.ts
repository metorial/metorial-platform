import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceProviderSpecificationChangeNotificationsGetOutput =
  {
    object: 'provider.specification_change_notification';
    id: string;
    providerId: string;
    providerVersionId: string;
    fromSpecification: {
      object: 'provider.capabilities.specification#preview';
      id: string;
      name: string;
      description: string | null;
      createdAt: Date;
      updatedAt: Date;
    } | null;
    toSpecification: {
      object: 'provider.capabilities.specification#preview';
      id: string;
      name: string;
      description: string | null;
      createdAt: Date;
      updatedAt: Date;
    } | null;
    fromProviderVersion: {
      object: 'provider.version#preview';
      id: string;
      version: string;
      name: string;
      description: string | null;
      createdAt: Date;
      updatedAt: Date;
    } | null;
    toProviderVersion: {
      object: 'provider.version#preview';
      id: string;
      version: string;
      name: string;
      description: string | null;
      createdAt: Date;
      updatedAt: Date;
    } | null;
    createdAt: Date;
  };

export let mapDashboardInstanceProviderSpecificationChangeNotificationsGetOutput =
  mtMap.object<DashboardInstanceProviderSpecificationChangeNotificationsGetOutput>(
    {
      object: mtMap.objectField('object', mtMap.passthrough()),
      id: mtMap.objectField('id', mtMap.passthrough()),
      providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
      providerVersionId: mtMap.objectField(
        'provider_version_id',
        mtMap.passthrough()
      ),
      fromSpecification: mtMap.objectField(
        'from_specification',
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          description: mtMap.objectField('description', mtMap.passthrough()),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          updatedAt: mtMap.objectField('updated_at', mtMap.date())
        })
      ),
      toSpecification: mtMap.objectField(
        'to_specification',
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          description: mtMap.objectField('description', mtMap.passthrough()),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          updatedAt: mtMap.objectField('updated_at', mtMap.date())
        })
      ),
      fromProviderVersion: mtMap.objectField(
        'from_provider_version',
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          version: mtMap.objectField('version', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          description: mtMap.objectField('description', mtMap.passthrough()),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          updatedAt: mtMap.objectField('updated_at', mtMap.date())
        })
      ),
      toProviderVersion: mtMap.objectField(
        'to_provider_version',
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          version: mtMap.objectField('version', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          description: mtMap.objectField('description', mtMap.passthrough()),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          updatedAt: mtMap.objectField('updated_at', mtMap.date())
        })
      ),
      createdAt: mtMap.objectField('created_at', mtMap.date())
    }
  );

