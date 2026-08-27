import { v } from '@lowerdeck/validation';
import { Project } from '@metorial/db';
import type { ProjectBrandOverride } from '@metorial/module-organization';
import {
  projectAuthConfigConfigurationPresenter,
  projectBrandPresenter,
  projectIntegrationNamingConfigurationPresenter,
  projectRetentionPresenter,
  projectSkillSyncConfigurationPresenter,
  projectToolCallingConfigurationPresenter
} from '@metorial/presenters';
import { resource } from '../../_lib/resource';

export let projectBrandResource = resource({
  name: 'project_brand',
  payload: v.typedAny<{
    projectBrand: ProjectBrandOverride;
  }>('project_brand'),
  presenter: projectBrandPresenter,
  actions: {
    update: true
  }
});

export let projectRetentionResource = resource({
  name: 'project_retention',
  payload: v.typedAny<{
    project: Project;
  }>('project_retention'),
  presenter: projectRetentionPresenter,
  actions: {
    update: true
  }
});

export let projectAuthConfigConfigurationResource = resource({
  name: 'project_auth_config_configuration',
  payload: v.typedAny<{
    project: Project;
    allowAuthConfigExport: boolean;
    allowAuthConfigImport: boolean;
    consumerAuthClientRegistrationsPerHourLimit: number;
    consumerAuthClientRegistrationsPerMinuteLimit: number;
  }>('project_auth_config_configuration'),
  presenter: projectAuthConfigConfigurationPresenter,
  actions: {
    update: true
  }
});

export let projectIntegrationNamingConfigurationResource = resource({
  name: 'project_integration_naming_configuration',
  payload: v.typedAny<{
    project: Project;
    useIntegrationNames: boolean;
  }>('project_integration_naming_configuration'),
  presenter: projectIntegrationNamingConfigurationPresenter,
  actions: {
    update: true
  }
});

export let projectSkillSyncConfigurationResource = resource({
  name: 'project_skill_sync_configuration',
  payload: v.typedAny<{
    project: Project;
  }>('project_skill_sync_configuration'),
  presenter: projectSkillSyncConfigurationPresenter,
  actions: {
    update: true
  }
});

export let projectToolCallingConfigurationResource = resource({
  name: 'project_tool_calling_configuration',
  payload: v.typedAny<{
    project: Project;
    collectOperationDescriptionForToolCalls: boolean;
    messageProcessingTimeoutMs: number;
  }>('project_tool_calling_configuration'),
  presenter: projectToolCallingConfigurationPresenter,
  actions: {
    update: true
  }
});
