import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { projectResourceOwnershipConfigurationType } from '../../types';

export let v1ProjectResourceOwnershipConfigurationPresenter = Presenter.create(
  projectResourceOwnershipConfigurationType
)
  .presenter(
    async ({
      project,
      allowApiAccessToConsumerOwnedResources,
      allowMemberAccessToConsumerOwnedResources
    }) => ({
      object: 'organization.project.resource_ownership_configuration' as const,

      project_id: project.id,
      allow_api_access_to_consumer_owned_resources: allowApiAccessToConsumerOwnedResources,
      allow_member_access_to_consumer_owned_resources:
        allowMemberAccessToConsumerOwnedResources,
      updated_at: project.updatedAt
    })
  )
  .schema(
    v.object({
      object: v.literal('organization.project.resource_ownership_configuration'),
      project_id: v.string(),
      allow_api_access_to_consumer_owned_resources: v.boolean({
        description:
          'Whether API keys and service accounts can use resources owned by consumers, such as connecting to their magic MCP servers or creating sessions from them.'
      }),
      allow_member_access_to_consumer_owned_resources: v.boolean({
        description:
          'Whether organization members in the dashboard can use resources owned by consumers. Consumer-owned resources stay visible either way.'
      }),
      updated_at: v.date()
    })
  )
  .build();
