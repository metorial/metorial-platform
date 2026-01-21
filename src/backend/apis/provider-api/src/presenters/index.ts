import {
  Presenter,
  PresentableType,
  GetTypeOfPresentable,
  PresenterContext,
  PresenterResult
} from '@metorial/presenter';

let declareProviderPresenter = <Type extends PresentableType<any, any>>(
  type: Type,
  presenter: Presenter<Type, any>
) => ({
  type,
  present:
    (input: GetTypeOfPresentable<Type>) =>
    (context: PresenterContext): PresenterResult =>
      presenter.present(input, context),
  introspect: ({ apiVersion }: { apiVersion: string }) => presenter.introspect()
});

import { v1PublisherPresenter } from './implementation/publisher';
import { v1VersionPresenter } from './implementation/version';
import { v1ProviderPresenter } from './implementation/provider';
import { v1CategoryPresenter } from './implementation/category';
import { v1CollectionPresenter } from './implementation/collection';
import { v1GroupPresenter } from './implementation/group';
import { v1ProviderListingPresenter } from './implementation/providerListing';
import { v1ToolPresenter } from './implementation/tool';
import { v1AuthMethodPresenter } from './implementation/authMethod';
import { v1SpecificationPresenter } from './implementation/specification';
import {
  v1DeploymentPresenter,
  v1DeploymentPreviewPresenter
} from './implementation/deployment';
import { v1ConfigPresenter, v1ConfigPreviewPresenter } from './implementation/config';
import { v1ConfigVaultPresenter } from './implementation/configVault';
import { v1AuthConfigPresenter } from './implementation/authConfig';
import { v1AuthCredentialsPresenter } from './implementation/authCredentials';
import { v1SetupSessionPresenter } from './implementation/setupSession';
import { v1AuthImportPresenter } from './implementation/authImport';
import {
  v1AuthExportPresenter,
  v1AuthExportWithValuePresenter
} from './implementation/authExport';
import { v1DeleteResponsePresenter } from './implementation/deleteResponse';

// Import types
import {
  publisherType,
  versionType,
  providerType,
  categoryType,
  collectionType,
  groupType,
  providerListingType,
  toolType,
  authMethodType,
  specificationType,
  deploymentType,
  deploymentPreviewType,
  configType,
  configPreviewType,
  configVaultType,
  authConfigType,
  authCredentialsType,
  setupSessionType,
  authImportType,
  authExportType,
  deleteResponseType
} from './types';

// Re-export types
export * from './types';

export let publisherPresenter = declareProviderPresenter(publisherType, v1PublisherPresenter);
export let versionPresenter = declareProviderPresenter(versionType, v1VersionPresenter);
export let providerPresenter = declareProviderPresenter(providerType, v1ProviderPresenter);
export let categoryPresenter = declareProviderPresenter(categoryType, v1CategoryPresenter);
export let collectionPresenter = declareProviderPresenter(
  collectionType,
  v1CollectionPresenter
);
export let groupPresenter = declareProviderPresenter(groupType, v1GroupPresenter);
export let providerListingPresenter = declareProviderPresenter(
  providerListingType,
  v1ProviderListingPresenter
);
export let toolPresenter = declareProviderPresenter(toolType, v1ToolPresenter);
export let authMethodPresenter = declareProviderPresenter(
  authMethodType,
  v1AuthMethodPresenter
);
export let specificationPresenter = declareProviderPresenter(
  specificationType,
  v1SpecificationPresenter
);
export let deploymentPresenter = declareProviderPresenter(
  deploymentType,
  v1DeploymentPresenter
);
export let deploymentPreviewPresenter = declareProviderPresenter(
  deploymentPreviewType,
  v1DeploymentPreviewPresenter
);
export let configPresenter = declareProviderPresenter(configType, v1ConfigPresenter);
export let configPreviewPresenter = declareProviderPresenter(
  configPreviewType,
  v1ConfigPreviewPresenter
);
export let configVaultPresenter = declareProviderPresenter(
  configVaultType,
  v1ConfigVaultPresenter
);
export let authConfigPresenter = declareProviderPresenter(
  authConfigType,
  v1AuthConfigPresenter
);
export let authCredentialsPresenter = declareProviderPresenter(
  authCredentialsType,
  v1AuthCredentialsPresenter
);
export let setupSessionPresenter = declareProviderPresenter(
  setupSessionType,
  v1SetupSessionPresenter
);
export let authImportPresenter = declareProviderPresenter(
  authImportType,
  v1AuthImportPresenter
);
export let authExportPresenter = declareProviderPresenter(
  authExportType,
  v1AuthExportPresenter
);
export let authExportWithValuePresenter = declareProviderPresenter(
  authExportType,
  v1AuthExportWithValuePresenter
);
export let deleteResponsePresenter = declareProviderPresenter(
  deleteResponseType,
  v1DeleteResponsePresenter
);
