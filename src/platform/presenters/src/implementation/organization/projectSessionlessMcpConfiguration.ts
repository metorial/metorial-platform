import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { projectSessionlessMcpConfigurationType } from '../../types';

export let v1ProjectSessionlessMcpConfigurationPresenter = Presenter.create(
  projectSessionlessMcpConfigurationType
)
  .presenter(async ({ project, sessionlessMcpEnabled }) => ({
    object: 'organization.project.sessionless_mcp_configuration' as const,

    project_id: project.id,
    sessionless_mcp_enabled: sessionlessMcpEnabled,
    updated_at: project.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('organization.project.sessionless_mcp_configuration'),
      project_id: v.string({
        description: 'The ID of the project this configuration belongs to',
        examples: ['prj_0mm97hpoosQAcleJQRtajt']
      }),
      sessionless_mcp_enabled: v.boolean({
        description:
          'Whether MCP clients using the sessionless protocol (2026-07-28 and later) can connect to this project without an initialize handshake. Until the project sets a value, this reflects the platform default for the environment.',
        examples: [true]
      }),
      updated_at: v.date({
        description: 'The time the project was last updated'
      })
    })
  )
  .build();
