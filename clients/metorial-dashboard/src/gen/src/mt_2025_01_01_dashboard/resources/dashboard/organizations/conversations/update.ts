import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardOrganizationsConversationsUpdateOutput = {
  object: 'assistant.conversation';
  id: string;
  title: string | null;
  assistantId: string;
  instanceId: string;
  organizationId: string;
  createdByActorId: string;
  rootMessageId: string;
  assistant: {
    object: 'assistant';
    id: string;
    slug: string;
    name: string;
    ownerType: 'metorial' | 'organization';
    organizationId: string | null;
    defaultModel: {
      object: 'assistant.model';
      id: string;
      slug: string;
      name: string;
      contextWindow: number;
      provider: {
        object: 'assistant.model_provider';
        id: string;
        slug: string;
        name: string;
        imageUrl: string;
      };
    } | null;
    availableModels: {
      object: 'assistant.model';
      id: string;
      slug: string;
      name: string;
      contextWindow: number;
      provider: {
        object: 'assistant.model_provider';
        id: string;
        slug: string;
        name: string;
        imageUrl: string;
      };
    }[];
    createdAt: Date;
    updatedAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardOrganizationsConversationsUpdateOutput =
  mtMap.object<DashboardOrganizationsConversationsUpdateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    title: mtMap.objectField('title', mtMap.passthrough()),
    assistantId: mtMap.objectField('assistant_id', mtMap.passthrough()),
    instanceId: mtMap.objectField('instance_id', mtMap.passthrough()),
    organizationId: mtMap.objectField('organization_id', mtMap.passthrough()),
    createdByActorId: mtMap.objectField(
      'created_by_actor_id',
      mtMap.passthrough()
    ),
    rootMessageId: mtMap.objectField('root_message_id', mtMap.passthrough()),
    assistant: mtMap.objectField(
      'assistant',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        slug: mtMap.objectField('slug', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        ownerType: mtMap.objectField('owner_type', mtMap.passthrough()),
        organizationId: mtMap.objectField(
          'organization_id',
          mtMap.passthrough()
        ),
        defaultModel: mtMap.objectField(
          'default_model',
          mtMap.object({
            object: mtMap.objectField('object', mtMap.passthrough()),
            id: mtMap.objectField('id', mtMap.passthrough()),
            slug: mtMap.objectField('slug', mtMap.passthrough()),
            name: mtMap.objectField('name', mtMap.passthrough()),
            contextWindow: mtMap.objectField(
              'context_window',
              mtMap.passthrough()
            ),
            provider: mtMap.objectField(
              'provider',
              mtMap.object({
                object: mtMap.objectField('object', mtMap.passthrough()),
                id: mtMap.objectField('id', mtMap.passthrough()),
                slug: mtMap.objectField('slug', mtMap.passthrough()),
                name: mtMap.objectField('name', mtMap.passthrough()),
                imageUrl: mtMap.objectField('image_url', mtMap.passthrough())
              })
            )
          })
        ),
        availableModels: mtMap.objectField(
          'available_models',
          mtMap.array(
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              slug: mtMap.objectField('slug', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              contextWindow: mtMap.objectField(
                'context_window',
                mtMap.passthrough()
              ),
              provider: mtMap.objectField(
                'provider',
                mtMap.object({
                  object: mtMap.objectField('object', mtMap.passthrough()),
                  id: mtMap.objectField('id', mtMap.passthrough()),
                  slug: mtMap.objectField('slug', mtMap.passthrough()),
                  name: mtMap.objectField('name', mtMap.passthrough()),
                  imageUrl: mtMap.objectField('image_url', mtMap.passthrough())
                })
              )
            })
          )
        ),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type DashboardOrganizationsConversationsUpdateBody = {
  title?: string | undefined;
};

export let mapDashboardOrganizationsConversationsUpdateBody =
  mtMap.object<DashboardOrganizationsConversationsUpdateBody>({
    title: mtMap.objectField('title', mtMap.passthrough())
  });

