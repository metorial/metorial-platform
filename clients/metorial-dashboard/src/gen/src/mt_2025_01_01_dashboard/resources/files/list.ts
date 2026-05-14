import { mtMap } from '@metorial/util-resource-mapper';

export type FilesListOutput = {
  items: ({
    object: 'file';
    id: string;
    status: 'active' | 'deleted';
    fileName: string;
    fileSize: number;
    fileType: string;
    title: string;
    purpose: string;
    createdBy: {
      type: 'organization_actor' | 'consumer' | 'unknown';
      name: string;
      imageUrl: string | null;
      email: string | null;
      organizationActor: {
        object: 'organization.actor';
        id: string;
        type: 'member' | 'machine_access';
        organizationId: string;
        name: string;
        email: string | null;
        imageUrl: string;
        teams: {
          id: string;
          name: string;
          slug: string;
          assignmentId: string;
          createdAt: Date;
          updatedAt: Date;
        }[];
        createdAt: Date;
        updatedAt: Date;
      } | null;
      consumer: {
        object: 'consumer';
        id: string;
        name: string;
        email: string;
        imageUrl: string;
        createdAt: Date;
        updatedAt: Date;
      } | null;
    } | null;
    createdAt: Date;
    updatedAt: Date;
  } & { downloadUrl: string | null })[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapFilesListOutput = mtMap.object<FilesListOutput>({
  items: mtMap.objectField(
    'items',
    mtMap.array(
      mtMap.union([
        mtMap.unionOption(
          'object',
          mtMap.object({
            object: mtMap.objectField('object', mtMap.passthrough()),
            id: mtMap.objectField('id', mtMap.passthrough()),
            status: mtMap.objectField('status', mtMap.passthrough()),
            fileName: mtMap.objectField('file_name', mtMap.passthrough()),
            fileSize: mtMap.objectField('file_size', mtMap.passthrough()),
            fileType: mtMap.objectField('file_type', mtMap.passthrough()),
            title: mtMap.objectField('title', mtMap.passthrough()),
            purpose: mtMap.objectField('purpose', mtMap.passthrough()),
            createdBy: mtMap.objectField(
              'created_by',
              mtMap.object({
                type: mtMap.objectField('type', mtMap.passthrough()),
                name: mtMap.objectField('name', mtMap.passthrough()),
                imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
                email: mtMap.objectField('email', mtMap.passthrough()),
                organizationActor: mtMap.objectField(
                  'organization_actor',
                  mtMap.object({
                    object: mtMap.objectField('object', mtMap.passthrough()),
                    id: mtMap.objectField('id', mtMap.passthrough()),
                    type: mtMap.objectField('type', mtMap.passthrough()),
                    organizationId: mtMap.objectField(
                      'organization_id',
                      mtMap.passthrough()
                    ),
                    name: mtMap.objectField('name', mtMap.passthrough()),
                    email: mtMap.objectField('email', mtMap.passthrough()),
                    imageUrl: mtMap.objectField(
                      'image_url',
                      mtMap.passthrough()
                    ),
                    teams: mtMap.objectField(
                      'teams',
                      mtMap.array(
                        mtMap.object({
                          id: mtMap.objectField('id', mtMap.passthrough()),
                          name: mtMap.objectField('name', mtMap.passthrough()),
                          slug: mtMap.objectField('slug', mtMap.passthrough()),
                          assignmentId: mtMap.objectField(
                            'assignment_id',
                            mtMap.passthrough()
                          ),
                          createdAt: mtMap.objectField(
                            'created_at',
                            mtMap.date()
                          ),
                          updatedAt: mtMap.objectField(
                            'updated_at',
                            mtMap.date()
                          )
                        })
                      )
                    ),
                    createdAt: mtMap.objectField('created_at', mtMap.date()),
                    updatedAt: mtMap.objectField('updated_at', mtMap.date())
                  })
                ),
                consumer: mtMap.objectField(
                  'consumer',
                  mtMap.object({
                    object: mtMap.objectField('object', mtMap.passthrough()),
                    id: mtMap.objectField('id', mtMap.passthrough()),
                    name: mtMap.objectField('name', mtMap.passthrough()),
                    email: mtMap.objectField('email', mtMap.passthrough()),
                    imageUrl: mtMap.objectField(
                      'image_url',
                      mtMap.passthrough()
                    ),
                    createdAt: mtMap.objectField('created_at', mtMap.date()),
                    updatedAt: mtMap.objectField('updated_at', mtMap.date())
                  })
                )
              })
            ),
            createdAt: mtMap.objectField('created_at', mtMap.date()),
            updatedAt: mtMap.objectField('updated_at', mtMap.date()),
            downloadUrl: mtMap.objectField('download_url', mtMap.passthrough())
          })
        )
      ])
    )
  ),
  pagination: mtMap.objectField(
    'pagination',
    mtMap.object({
      hasMoreBefore: mtMap.objectField('has_more_before', mtMap.passthrough()),
      hasMoreAfter: mtMap.objectField('has_more_after', mtMap.passthrough())
    })
  )
});

export type FilesListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  purpose?:
    | 'user_image'
    | 'organization_image'
    | 'project_brand_image'
    | 'generic'
    | (
        | 'user_image'
        | 'organization_image'
        | 'project_brand_image'
        | 'generic'
      )[]
    | undefined;
};

export let mapFilesListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough()),
      purpose: mtMap.objectField(
        'purpose',
        mtMap.union([mtMap.unionOption('array', mtMap.union([]))])
      )
    })
  )
]);

