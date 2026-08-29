import { Fabric, type FabricEvents } from '@metorial/fabric';
import { auditTrackerService } from '@metorial/module-audit-tracker';
import { recordAuditEventAfterCommit } from './record';

export let recordProjectRetentionUpdated = async (
  event: FabricEvents['organization.project.retention.updated:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'project_retention', 'update', {
      payload: {
        project: event.project
      },
      previousPayload: {
        project: event.previousProject
      },
      recordedAt
    });
  });
};

export let recordProjectSkillSyncConfigurationUpdated = async (
  event: FabricEvents['organization.project.skill_sync_configuration.updated:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(
      event.auditScope,
      'project_skill_sync_configuration',
      'update',
      {
        payload: {
          project: event.project
        },
        previousPayload: {
          project: event.previousProject
        },
        recordedAt
      }
    );
  });
};

export let recordProjectAuthConfigUpdated = async (
  event: FabricEvents['organization.project.auth_config_configuration.updated:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(
      event.auditScope,
      'project_auth_config_configuration',
      'update',
      {
        payload: {
          project: event.project,
          allowAuthConfigExport: event.configuration.allowAuthConfigExport,
          allowAuthConfigImport: event.configuration.allowAuthConfigImport,
          consumerAuthClientRegistrationsPerHourLimit:
            event.project.consumerAuthClientRegistrationsPerHourLimit,
          consumerAuthClientRegistrationsPerMinuteLimit:
            event.project.consumerAuthClientRegistrationsPerMinuteLimit
        },
        previousPayload: {
          project: event.previousProject,
          allowAuthConfigExport: event.previousConfiguration.allowAuthConfigExport,
          allowAuthConfigImport: event.previousConfiguration.allowAuthConfigImport,
          consumerAuthClientRegistrationsPerHourLimit:
            event.previousProject.consumerAuthClientRegistrationsPerHourLimit,
          consumerAuthClientRegistrationsPerMinuteLimit:
            event.previousProject.consumerAuthClientRegistrationsPerMinuteLimit
        },
        recordedAt
      }
    );
  });
};

export let recordProjectIntegrationNamingUpdated = async (
  event: FabricEvents['organization.project.integration_naming_configuration.updated:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(
      event.auditScope,
      'project_integration_naming_configuration',
      'update',
      {
        payload: {
          project: event.project,
          useIntegrationNames: event.configuration.useIntegrationNames
        },
        previousPayload: {
          project: event.project,
          useIntegrationNames: event.previousConfiguration.useIntegrationNames
        },
        recordedAt
      }
    );
  });
};

export let recordProjectToolCallingUpdated = async (
  event: FabricEvents['organization.project.tool_calling_configuration.updated:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(
      event.auditScope,
      'project_tool_calling_configuration',
      'update',
      {
        payload: {
          project: event.project,
          collectOperationDescriptionForToolCalls:
            event.configuration.collectOperationDescriptionForToolCalls,
          messageProcessingTimeoutMs: event.configuration.messageProcessingTimeoutMs
        },
        previousPayload: {
          project: event.project,
          collectOperationDescriptionForToolCalls:
            event.previousConfiguration.collectOperationDescriptionForToolCalls,
          messageProcessingTimeoutMs: event.previousConfiguration.messageProcessingTimeoutMs
        },
        recordedAt
      }
    );
  });
};

export let recordProjectBrandUpdated = async (
  event: FabricEvents['organization.project.brand.updated:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(event.auditScope, 'project_brand', 'update', {
      payload: {
        projectBrand: event.brand
      },
      previousPayload: {
        projectBrand: event.previousBrand
      },
      recordedAt
    });
  });
};

export let recordProjectDataRetentionUpdated = async (
  event: FabricEvents['organization.project.data_retention_configuration.updated:after']
) => {
  await recordAuditEventAfterCommit(async recordedAt => {
    await auditTrackerService.recordEvent(
      event.auditScope,
      'project_data_retention_configuration',
      'update',
      {
        payload: {
          project: event.project,
          dataRetentionLevel: event.configuration.dataRetentionLevel,
          storeToolCallAttachments: event.configuration.storeToolCallAttachments,
          collectErrors: event.configuration.collectErrors
        },
        previousPayload: {
          project: event.project,
          dataRetentionLevel: event.previousConfiguration.dataRetentionLevel,
          storeToolCallAttachments: event.previousConfiguration.storeToolCallAttachments,
          collectErrors: event.previousConfiguration.collectErrors
        },
        recordedAt
      }
    );
  });
};

Fabric.listen('organization.project.retention.updated:after', recordProjectRetentionUpdated);
Fabric.listen(
  'organization.project.skill_sync_configuration.updated:after',
  recordProjectSkillSyncConfigurationUpdated
);
Fabric.listen(
  'organization.project.auth_config_configuration.updated:after',
  recordProjectAuthConfigUpdated
);
Fabric.listen(
  'organization.project.integration_naming_configuration.updated:after',
  recordProjectIntegrationNamingUpdated
);
Fabric.listen(
  'organization.project.tool_calling_configuration.updated:after',
  recordProjectToolCallingUpdated
);
Fabric.listen(
  'organization.project.data_retention_configuration.updated:after',
  recordProjectDataRetentionUpdated
);
Fabric.listen('organization.project.brand.updated:after', recordProjectBrandUpdated);
