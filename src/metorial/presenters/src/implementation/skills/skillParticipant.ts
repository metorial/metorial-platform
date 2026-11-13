import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { skillParticipantType } from '../../types';
import {
  documentParticipantActorSchema,
  presentDocumentParticipantActor
} from '../files/documentParticipant';
import {
  presentStoreResourceParticipantSurfaces,
  storeParticipantSurfaceSchema,
  type StoreParticipantSurface
} from '../files/storeResourceParticipant';

export let v1SkillParticipantPresenter = Presenter.create(skillParticipantType)
  .presenter(async ({ skillParticipant }, opts) => ({
    object: 'skill.participant' as const,
    id: skillParticipant.id,
    skill_id: skillParticipant.skill.id,
    roles: skillParticipant.roles,
    actor: await presentDocumentParticipantActor(skillParticipant.primaryResourceActor, opts),
    surfaces: (await presentStoreResourceParticipantSurfaces(skillParticipant, opts)) as
      StoreParticipantSurface[] | null,
    last_active_at: skillParticipant.lastActiveAt,
    created_at: skillParticipant.createdAt,
    updated_at: skillParticipant.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('skill.participant', {
        description: "String representing the object's type"
      }),
      id: v.string(),
      skill_id: v.string(),
      roles: v.array(v.enumOf(['creator', 'owner', 'editor', 'viewer', 'user', 'forker'])),
      actor: documentParticipantActorSchema,
      surfaces: v.nullable(v.array(storeParticipantSurfaceSchema)),
      last_active_at: v.nullable(v.date()),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();

export let dashboardSkillParticipantPresenter = Presenter.create(skillParticipantType)
  .presenter(async (input, opts) => {
    let inner = await v1SkillParticipantPresenter.present(input, opts).run();
    let { skillParticipant } = input;
    let instanceConsumer = skillParticipant.consumer?.instanceConsumers.find(
      instanceConsumer => instanceConsumer.instanceOid === skillParticipant.skill.instanceOid
    );

    return {
      ...inner,
      consumer_id: instanceConsumer?.id ?? null,
      has_organization_member_access: !!skillParticipant.hasOrganizationMemberAccess
    };
  })
  .schema(
    v.intersection([
      v1SkillParticipantPresenter.schema,
      v.object({
        consumer_id: v.nullable(
          v.string({
            description:
              'The consumer this participant is in the skill instance, including organization members linked to a consumer through their user.'
          })
        ),
        has_organization_member_access: v.boolean({
          description:
            'Whether the participant has full access through an organization membership instead of its skill grants.'
        })
      })
    ])
  )
  .build();
