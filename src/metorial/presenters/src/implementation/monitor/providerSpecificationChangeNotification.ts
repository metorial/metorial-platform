import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { providerSpecificationChangeNotificationType } from '../../types';

let specificationPreviewSchema = v.nullable(
  v.object({
    object: v.literal('provider.capabilities.specification#preview'),
    id: v.string(),
    name: v.string(),
    description: v.nullable(v.string()),
    created_at: v.date(),
    updated_at: v.date()
  })
);

let versionPreviewSchema = v.nullable(
  v.object({
    object: v.literal('provider.version#preview'),
    id: v.string(),
    version: v.string(),
    name: v.string(),
    description: v.nullable(v.string()),
    created_at: v.date(),
    updated_at: v.date()
  })
);

let presentSpecificationPreview = (specification: any) =>
  specification
    ? {
        object: 'provider.capabilities.specification#preview' as const,
        id: specification.id,
        name: specification.name,
        description: specification.description,
        created_at: specification.createdAt,
        updated_at: specification.updatedAt
      }
    : null;

let presentVersionPreview = (version: any) =>
  version
    ? {
        object: 'provider.version#preview' as const,
        id: version.id,
        version: version.identifier ?? version.version ?? version.name,
        name: version.name,
        description: version.description,
        created_at: version.createdAt,
        updated_at: version.updatedAt
      }
    : null;

export let v1ProviderSpecificationChangeNotificationPresenter = Presenter.create(
  providerSpecificationChangeNotificationType
)
  .presenter(async ({ notification }) => {
    let change = notification.versionSpecificationChange
      ? {
          fromSpecification: notification.versionSpecificationChange.fromSpecification,
          toSpecification: notification.versionSpecificationChange.toSpecification,
          fromVersion: notification.versionSpecificationChange.fromVersion,
          toVersion: notification.versionSpecificationChange.toVersion
        }
      : notification.pairSpecificationChange
        ? {
            fromSpecification: notification.pairSpecificationChange.fromSpecification,
            toSpecification: notification.pairSpecificationChange.toSpecification,
            fromVersion: notification.pairSpecificationChange.fromPairVersion.version,
            toVersion: notification.pairSpecificationChange.toPairVersion.version
          }
        : null;

    return {
      object: 'provider.specification_change_notification' as const,
      id: notification.id,
      provider_id: notification.version.provider.id,
      provider_version_id: notification.version.id,
      from_specification: presentSpecificationPreview(change?.fromSpecification),
      to_specification: presentSpecificationPreview(change?.toSpecification),
      from_provider_version: presentVersionPreview(change?.fromVersion),
      to_provider_version: presentVersionPreview(change?.toVersion),
      created_at: notification.createdAt
    };
  })
  .schema(
    v.object({
      object: v.literal('provider.specification_change_notification'),
      id: v.string(),
      provider_id: v.string(),
      provider_version_id: v.string(),
      from_specification: specificationPreviewSchema,
      to_specification: specificationPreviewSchema,
      from_provider_version: versionPreviewSchema,
      to_provider_version: versionPreviewSchema,
      created_at: v.date()
    })
  )
  .build();
