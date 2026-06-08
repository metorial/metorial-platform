import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceAssistantsListOutput = {
  items: {
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
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceAssistantsListOutput =
  mtMap.object<DashboardInstanceAssistantsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
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
                    imageUrl: mtMap.objectField(
                      'image_url',
                      mtMap.passthrough()
                    )
                  })
                )
              })
            )
          ),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          updatedAt: mtMap.objectField('updated_at', mtMap.date())
        })
      )
    ),
    pagination: mtMap.objectField(
      'pagination',
      mtMap.object({
        hasMoreBefore: mtMap.objectField(
          'has_more_before',
          mtMap.passthrough()
        ),
        hasMoreAfter: mtMap.objectField('has_more_after', mtMap.passthrough())
      })
    )
  });

export type DashboardInstanceAssistantsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapDashboardInstanceAssistantsListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough())
    })
  )
]);

