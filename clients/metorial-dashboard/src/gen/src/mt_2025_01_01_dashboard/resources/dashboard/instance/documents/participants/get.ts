import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceDocumentsParticipantsGetOutput = {
  object: 'document.participant';
  id: string;
  role: 'editor' | 'viewer';
  editCount: number;
  lastEditedAt: Date | null;
  lastViewedAt: Date | null;
  actor: {
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
  };
  createdAt: Date;
};

export let mapDashboardInstanceDocumentsParticipantsGetOutput =
  mtMap.object<DashboardInstanceDocumentsParticipantsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    role: mtMap.objectField('role', mtMap.passthrough()),
    editCount: mtMap.objectField('edit_count', mtMap.passthrough()),
    lastEditedAt: mtMap.objectField('last_edited_at', mtMap.date()),
    lastViewedAt: mtMap.objectField('last_viewed_at', mtMap.date()),
    actor: mtMap.objectField(
      'actor',
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
    createdAt: mtMap.objectField('created_at', mtMap.date())
  });

