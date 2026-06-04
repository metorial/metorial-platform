import type {
  Provider,
  ProviderDeploymentConfigPair,
  ProviderDeploymentConfigPairProviderVersion,
  ProviderDeploymentConfigPairSpecificationChange,
  ProviderSpecification,
  ProviderSpecificationChangeNotification,
  ProviderSpecificationChangeNotificationTarget,
  ProviderVersion,
  ProviderVersionSpecificationChange
} from '@metorial-subspace/db';

let specificationPreviewPresenter = (specification: ProviderSpecification) => ({
  object: 'provider.capabilities.specification.preview',
  id: specification.id,
  type: specification.type,
  key: specification.key,
  name: specification.name,
  description: specification.description,
  createdAt: specification.createdAt,
  updatedAt: specification.updatedAt
});

let versionPreviewPresenter = (version: ProviderVersion) => ({
  object: 'provider.version.preview',
  id: version.id,
  identifier: version.identifier,
  name: version.name,
  description: version.description,
  createdAt: version.createdAt,
  updatedAt: version.updatedAt
});

export type ProviderSpecificationChangeNotificationPresenterProps =
  ProviderSpecificationChangeNotification & {
    version: ProviderVersion & { provider: Provider };
    deploymentConfigPair: Pick<ProviderDeploymentConfigPair, 'id'> | null;
    versionSpecificationChange:
      | (ProviderVersionSpecificationChange & {
          fromSpecification: ProviderSpecification;
          toSpecification: ProviderSpecification;
          fromVersion: ProviderVersion;
          toVersion: ProviderVersion;
        })
      | null;
    pairSpecificationChange:
      | (ProviderDeploymentConfigPairSpecificationChange & {
          fromSpecification: ProviderSpecification;
          toSpecification: ProviderSpecification;
          fromPairVersion: ProviderDeploymentConfigPairProviderVersion & {
            version: ProviderVersion;
          };
          toPairVersion: ProviderDeploymentConfigPairProviderVersion & {
            version: ProviderVersion;
          };
        })
      | null;
  };

let getChange = (notification: ProviderSpecificationChangeNotificationPresenterProps) => {
  if (notification.versionSpecificationChange) {
    return {
      fromSpecification: notification.versionSpecificationChange.fromSpecification,
      toSpecification: notification.versionSpecificationChange.toSpecification,
      fromVersion: notification.versionSpecificationChange.fromVersion,
      toVersion: notification.versionSpecificationChange.toVersion
    };
  }

  if (notification.pairSpecificationChange) {
    return {
      fromSpecification: notification.pairSpecificationChange.fromSpecification,
      toSpecification: notification.pairSpecificationChange.toSpecification,
      fromVersion: notification.pairSpecificationChange.fromPairVersion.version,
      toVersion: notification.pairSpecificationChange.toPairVersion.version
    };
  }

  return null;
};

export let providerSpecificationChangeNotificationPresenter = (
  notification: ProviderSpecificationChangeNotificationPresenterProps
) => {
  let change = getChange(notification);

  return {
    object: 'provider.specification_change_notification',
    id: notification.id,
    target: notification.target as ProviderSpecificationChangeNotificationTarget,
    providerId: notification.version.provider.id,
    providerVersionId: notification.version.id,
    fromSpecification: change ? specificationPreviewPresenter(change.fromSpecification) : null,
    toSpecification: change ? specificationPreviewPresenter(change.toSpecification) : null,
    fromProviderVersion: change ? versionPreviewPresenter(change.fromVersion) : null,
    toProviderVersion: change ? versionPreviewPresenter(change.toVersion) : null,
    createdAt: notification.createdAt
  };
};
