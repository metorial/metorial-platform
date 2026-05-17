import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceSkillsExportsCreateOutput = {
  object: 'skill.export';
  id: string;
  target: 'skill' | 'plugin' | 'marketplace';
  status: 'pending' | 'completed' | 'failed';
  file: {
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
  } | null;
  fileLink: {
    object: 'file.file_link';
    id: string;
    fileId: string;
    url: string;
    createdAt: Date;
    expiresAt: Date | null;
  } | null;
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
  startedAt: Date | null;
  completedAt: Date | null;
};

export let mapManagementInstanceSkillsExportsCreateOutput =
  mtMap.object<ManagementInstanceSkillsExportsCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    target: mtMap.objectField('target', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    file: mtMap.objectField(
      'file',
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
                imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
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
                      createdAt: mtMap.objectField('created_at', mtMap.date()),
                      updatedAt: mtMap.objectField('updated_at', mtMap.date())
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
                imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
                createdAt: mtMap.objectField('created_at', mtMap.date()),
                updatedAt: mtMap.objectField('updated_at', mtMap.date())
              })
            )
          })
        ),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
    ),
    fileLink: mtMap.objectField(
      'file_link',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        fileId: mtMap.objectField('file_id', mtMap.passthrough()),
        url: mtMap.objectField('url', mtMap.passthrough()),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        expiresAt: mtMap.objectField('expires_at', mtMap.date())
      })
    ),
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
            imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
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
                  createdAt: mtMap.objectField('created_at', mtMap.date()),
                  updatedAt: mtMap.objectField('updated_at', mtMap.date())
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
            imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
            createdAt: mtMap.objectField('created_at', mtMap.date()),
            updatedAt: mtMap.objectField('updated_at', mtMap.date())
          })
        )
      })
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    startedAt: mtMap.objectField('started_at', mtMap.date()),
    completedAt: mtMap.objectField('completed_at', mtMap.date())
  });

export type ManagementInstanceSkillsExportsCreateBody = {
  target: 'skill' | 'plugin' | 'marketplace';
  skillId?: string | undefined;
  skillPluginId?: string | undefined;
  skillMarketplaceId?: string | undefined;
};

export let mapManagementInstanceSkillsExportsCreateBody =
  mtMap.object<ManagementInstanceSkillsExportsCreateBody>({
    target: mtMap.objectField('target', mtMap.passthrough()),
    skillId: mtMap.objectField('skill_id', mtMap.passthrough()),
    skillPluginId: mtMap.objectField('skill_plugin_id', mtMap.passthrough()),
    skillMarketplaceId: mtMap.objectField(
      'skill_marketplace_id',
      mtMap.passthrough()
    )
  });

