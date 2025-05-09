import { declarePresenter } from '@metorial/presenter';
import {
  apiKeyType,
  bootType,
  instanceType,
  machineAccessType,
  organizationActorType,
  organizationInviteType,
  organizationMemberType,
  organizationType,
  projectType,
  userType
} from './types';
import { v1ApiKeyPresenter } from './v1/apiKey';
import { v1BootPresenter } from './v1/boot';
import { v1InstancePresenter } from './v1/instance';
import { v1MachineAccessPresenter } from './v1/machineAccess';
import { v1OrganizationPresenter } from './v1/organization';
import { v1OrganizationActorPresenter } from './v1/organizationActor';
import { v1OrganizationInvitePresenter } from './v1/organizationInvite';
import { v1OrganizationMemberPresenter } from './v1/organizationMember';
import { v1ProjectPresenter } from './v1/project';
import { v1UserPresenter } from './v1/user';

export let apiKeyPresenter = declarePresenter(apiKeyType, {
  v_2025_01_01_pulsar: v1ApiKeyPresenter
});

export let instancePresenter = declarePresenter(instanceType, {
  v_2025_01_01_pulsar: v1InstancePresenter
});

export let machineAccessPresenter = declarePresenter(machineAccessType, {
  v_2025_01_01_pulsar: v1MachineAccessPresenter
});

export let organizationActorPresenter = declarePresenter(organizationActorType, {
  v_2025_01_01_pulsar: v1OrganizationActorPresenter
});

export let organizationInvitePresenter = declarePresenter(organizationInviteType, {
  v_2025_01_01_pulsar: v1OrganizationInvitePresenter
});

export let organizationMemberPresenter = declarePresenter(organizationMemberType, {
  v_2025_01_01_pulsar: v1OrganizationMemberPresenter
});

export let organizationPresenter = declarePresenter(organizationType, {
  v_2025_01_01_pulsar: v1OrganizationPresenter
});

export let projectPresenter = declarePresenter(projectType, {
  v_2025_01_01_pulsar: v1ProjectPresenter
});

export let userPresenter = declarePresenter(userType, {
  v_2025_01_01_pulsar: v1UserPresenter
});

export let bootPresenter = declarePresenter(bootType, {
  v_2025_01_01_pulsar: v1BootPresenter
});
