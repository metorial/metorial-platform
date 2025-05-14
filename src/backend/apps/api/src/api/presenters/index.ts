import { declarePresenter } from '@metorial/presenter';
import { dashboardApiKeyPresenter, v1ApiKeyPresenter } from './implementation/apiKey';
import { v1BootPresenter } from './implementation/boot';
import { v1FilePresenter } from './implementation/file';
import { v1FileLinkPresenter } from './implementation/fileLink';
import { v1InstancePresenter } from './implementation/instance';
import { v1MachineAccessPresenter } from './implementation/machineAccess';
import { v1OrganizationPresenter } from './implementation/organization';
import { v1OrganizationActorPresenter } from './implementation/organizationActor';
import { v1OrganizationInvitePresenter } from './implementation/organizationInvite';
import { v1OrganizationMemberPresenter } from './implementation/organizationMember';
import { v1ProjectPresenter } from './implementation/project';
import { v1SecretPresenter } from './implementation/secret';
import { v1ServerPresenter } from './implementation/server';
import { v1ServerListingCategoryPresenter } from './implementation/serverCategory';
import { v1ServerListingCollectionPresenter } from './implementation/serverCollection';
import { v1ServerDeploymentPresenter } from './implementation/serverDeployment';
import { v1ServerInstancePresenter } from './implementation/serverInstance';
import { v1ServerListingPresenter } from './implementation/serverListing';
import { v1ServerVariantPresenter } from './implementation/serverVariant';
import { v1ServerVersionPresenter } from './implementation/serverVersion';
import { v1UserPresenter } from './implementation/user';
import {
  apiKeyType,
  bootType,
  fileLinkType,
  fileType,
  instanceType,
  machineAccessType,
  organizationActorType,
  organizationInviteType,
  organizationMemberType,
  organizationType,
  projectType,
  secretType,
  serverDeploymentType,
  serverInstanceType,
  serverListingCategoryType,
  serverListingCollectionType,
  serverListingType,
  serverType,
  serverVariantType,
  serverVersionType,
  userType
} from './types';

export let apiKeyPresenter = declarePresenter(apiKeyType, {
  mt_2025_01_01_pulsar: v1ApiKeyPresenter,
  mt_2025_01_01_dashboard: dashboardApiKeyPresenter
});

export let instancePresenter = declarePresenter(instanceType, {
  mt_2025_01_01_pulsar: v1InstancePresenter,
  mt_2025_01_01_dashboard: v1InstancePresenter
});

export let machineAccessPresenter = declarePresenter(machineAccessType, {
  mt_2025_01_01_pulsar: v1MachineAccessPresenter,
  mt_2025_01_01_dashboard: v1MachineAccessPresenter
});

export let organizationActorPresenter = declarePresenter(organizationActorType, {
  mt_2025_01_01_pulsar: v1OrganizationActorPresenter,
  mt_2025_01_01_dashboard: v1OrganizationActorPresenter
});

export let organizationInvitePresenter = declarePresenter(organizationInviteType, {
  mt_2025_01_01_pulsar: v1OrganizationInvitePresenter,
  mt_2025_01_01_dashboard: v1OrganizationInvitePresenter
});

export let organizationMemberPresenter = declarePresenter(organizationMemberType, {
  mt_2025_01_01_pulsar: v1OrganizationMemberPresenter,
  mt_2025_01_01_dashboard: v1OrganizationMemberPresenter
});

export let organizationPresenter = declarePresenter(organizationType, {
  mt_2025_01_01_pulsar: v1OrganizationPresenter,
  mt_2025_01_01_dashboard: v1OrganizationPresenter
});

export let projectPresenter = declarePresenter(projectType, {
  mt_2025_01_01_pulsar: v1ProjectPresenter,
  mt_2025_01_01_dashboard: v1ProjectPresenter
});

export let userPresenter = declarePresenter(userType, {
  mt_2025_01_01_pulsar: v1UserPresenter,
  mt_2025_01_01_dashboard: v1UserPresenter
});

export let bootPresenter = declarePresenter(bootType, {
  mt_2025_01_01_pulsar: v1BootPresenter,
  mt_2025_01_01_dashboard: v1BootPresenter
});

export let filePresenter = declarePresenter(fileType, {
  mt_2025_01_01_pulsar: v1FilePresenter,
  mt_2025_01_01_dashboard: v1FilePresenter
});

export let fileLinkPresenter = declarePresenter(fileLinkType, {
  mt_2025_01_01_pulsar: v1FileLinkPresenter,
  mt_2025_01_01_dashboard: v1FileLinkPresenter
});

export let secretPresenter = declarePresenter(secretType, {
  mt_2025_01_01_pulsar: v1SecretPresenter,
  mt_2025_01_01_dashboard: v1SecretPresenter
});

export let serverPresenter = declarePresenter(serverType, {
  mt_2025_01_01_pulsar: v1ServerPresenter,
  mt_2025_01_01_dashboard: v1ServerPresenter
});

export let serverVariantPresenter = declarePresenter(serverVariantType, {
  mt_2025_01_01_pulsar: v1ServerVariantPresenter,
  mt_2025_01_01_dashboard: v1ServerVariantPresenter
});

export let serverVersionPresenter = declarePresenter(serverVersionType, {
  mt_2025_01_01_pulsar: v1ServerVersionPresenter,
  mt_2025_01_01_dashboard: v1ServerVersionPresenter
});

export let serverListingPresenter = declarePresenter(serverListingType, {
  mt_2025_01_01_pulsar: v1ServerListingPresenter,
  mt_2025_01_01_dashboard: v1ServerListingPresenter
});

export let serverListingCategoryPresenter = declarePresenter(serverListingCategoryType, {
  mt_2025_01_01_pulsar: v1ServerListingCategoryPresenter,
  mt_2025_01_01_dashboard: v1ServerListingCategoryPresenter
});

export let serverListingCollectionPresenter = declarePresenter(serverListingCollectionType, {
  mt_2025_01_01_pulsar: v1ServerListingCollectionPresenter,
  mt_2025_01_01_dashboard: v1ServerListingCollectionPresenter
});

export let serverInstancePresenter = declarePresenter(serverInstanceType, {
  mt_2025_01_01_pulsar: v1ServerInstancePresenter,
  mt_2025_01_01_dashboard: v1ServerInstancePresenter
});

export let serverDeploymentPresenter = declarePresenter(serverDeploymentType, {
  mt_2025_01_01_pulsar: v1ServerDeploymentPresenter,
  mt_2025_01_01_dashboard: v1ServerDeploymentPresenter
});
