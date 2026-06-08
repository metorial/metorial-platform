import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceSkillsParticipantsGetOutput = {
  object: 'skill.participant';
  id: string;
  skillId: string;
  roles: ('creator' | 'editor' | 'viewer' | 'user' | 'forker')[];
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
  updatedAt: Date;
};

export let mapDashboardInstanceSkillsParticipantsGetOutput =
  mtMap.object<DashboardInstanceSkillsParticipantsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    skillId: mtMap.objectField('skill_id', mtMap.passthrough()),
    roles: mtMap.objectField('roles', mtMap.array(mtMap.passthrough())),
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
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

