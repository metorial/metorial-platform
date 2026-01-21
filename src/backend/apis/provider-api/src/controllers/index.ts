import { Controller } from '@metorial/rest';

// Instance controllers
import {
  providerController,
  providerListingController,
  providerCategoryController,
  providerCollectionController,
  providerGroupController,
  providerPublisherController,
  providerVersionController,
  providerSpecificationController,
  providerToolController,
  providerAuthMethodController,
  providerDeploymentController,
  providerConfigController,
  providerConfigVaultController,
  providerAuthConfigController,
  providerAuthCredentialsController,
  providerSetupSessionController,
  providerAuthImportController,
  providerAuthExportController
} from './instance';

export let providerApiController = Controller.create(
  {
    name: 'Provider API',
    description: 'API for managing MCP provider integrations.'
  },
  {
    // Catalog controllers
    providerController,
    providerListingController,
    providerCategoryController,
    providerCollectionController,
    providerGroupController,
    providerPublisherController,
    providerVersionController,
    providerSpecificationController,
    providerToolController,
    providerAuthMethodController,

    // Instance CRUD controllers
    providerDeploymentController,
    providerConfigController,
    providerConfigVaultController,
    providerAuthConfigController,
    providerAuthCredentialsController,
    providerSetupSessionController,
    providerAuthImportController,
    providerAuthExportController
  }
);
