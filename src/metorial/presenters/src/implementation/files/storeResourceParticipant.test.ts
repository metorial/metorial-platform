import { describe, expect, it, vi } from 'vitest';

vi.mock('../consumer', async () => {
  let { v } = await import('@lowerdeck/validation');
  return { v1ConsumerProfilePresenter: { schema: v.any() } };
});
vi.mock('../consumer/consumer', async () => {
  let { v } = await import('@lowerdeck/validation');
  return { v1ConsumerPresenter: { schema: v.any() } };
});
vi.mock('../organization/organizationActor', async () => {
  let { v } = await import('@lowerdeck/validation');
  return { v1OrganizationActorPresenter: { schema: v.any() } };
});

import { v1SkillAccessPresenter } from '../skills/skillAccess';
import { v1SkillParticipantPresenter } from '../skills/skillParticipant';
import { v1DocumentParticipantPresenter } from './documentParticipant';
import { v1StoreParticipantPresenter } from './storeParticipant';

let context = {
  apiVersion: 'mt_2025_01_01_dashboard',
  accessType: 'user_auth_token'
} as const;

let createdAt = new Date('2026-01-01T00:00:00.000Z');
let updatedAt = new Date('2026-01-02T00:00:00.000Z');
let activeAt = new Date('2026-01-03T00:00:00.000Z');

let resourceActor = (name: string) => ({
  name,
  organizationActor: null,
  consumer: null,
  consumerProfile: null
});

let store = { id: 'sto_1' };
let skill = { id: 'skl_1' };

let actorRow = (id: string, d: { permissions: string[]; roles: string[]; name: string }) => ({
  id,
  permissions: d.permissions,
  roles: d.roles,
  lastActiveAt: activeAt,
  createdAt,
  resourceActor: resourceActor(d.name)
});

let dedupedParticipant = {
  id: 'stp_1',
  store,
  roles: ['creator', 'viewer'],
  lastActiveAt: activeAt,
  createdAt,
  updatedAt,
  primaryResourceActor: resourceActor('Primary'),
  actors: [
    actorRow('stp_row_1', {
      permissions: ['content_read'],
      roles: ['creator'],
      name: 'Primary'
    }),
    actorRow('stpa_row_2', {
      permissions: ['content_write'],
      roles: ['viewer'],
      name: 'Second surface'
    })
  ]
};

describe('store participant presenters', () => {
  it('presents a legacy store participant row with the deduplicated fields empty', async () => {
    let presented = await v1StoreParticipantPresenter
      .present(
        {
          storeParticipant: {
            id: 'stp_legacy',
            store,
            permissions: ['content_read'],
            roles: ['viewer'],
            lastActiveAt: null,
            createdAt,
            updatedAt,
            resourceActor: resourceActor('Legacy')
          } as any
        },
        context
      )
      .run();

    expect(presented).toMatchObject({
      object: 'store.participant',
      id: 'stp_legacy',
      store_id: 'sto_1',
      permissions: ['content_read'],
      roles: ['viewer'],
      actor: { type: 'resource_actor', name: 'Legacy' },
      surfaces: null,
      last_active_at: null
    });
  });

  it('presents a deduplicated store participant with every surface it acted through', async () => {
    let presented = await v1StoreParticipantPresenter
      .present({ storeParticipant: dedupedParticipant as any }, context)
      .run();

    expect(presented).toMatchObject({
      object: 'store.participant',
      id: 'stp_1',
      store_id: 'sto_1',
      permissions: ['content_read', 'content_write'],
      roles: ['creator', 'viewer'],
      actor: { name: 'Primary' },
      last_active_at: activeAt
    });
    expect(presented.surfaces).toEqual([
      expect.objectContaining({
        id: 'stp_row_1',
        roles: ['creator'],
        actor: expect.objectContaining({ name: 'Primary' })
      }),
      expect.objectContaining({
        id: 'stpa_row_2',
        roles: ['viewer'],
        actor: expect.objectContaining({ name: 'Second surface' })
      })
    ]);
  });

  it('presents legacy and deduplicated skill participants with the same fields', async () => {
    let legacy = await v1SkillParticipantPresenter
      .present(
        {
          skillParticipant: {
            id: 'skp_1',
            skill,
            roles: ['editor'],
            createdAt,
            updatedAt,
            resourceActor: resourceActor('Legacy')
          } as any
        },
        context
      )
      .run();
    let deduped = await v1SkillParticipantPresenter
      .present({ skillParticipant: { ...dedupedParticipant, skill } as any }, context)
      .run();

    expect(Object.keys(deduped).sort()).toEqual(Object.keys(legacy).sort());
    expect(legacy).toMatchObject({
      object: 'skill.participant',
      id: 'skp_1',
      skill_id: 'skl_1',
      roles: ['editor'],
      surfaces: null,
      last_active_at: null
    });
    expect(deduped).toMatchObject({
      id: 'stp_1',
      skill_id: 'skl_1',
      roles: ['creator', 'viewer'],
      last_active_at: activeAt
    });
    expect(deduped.surfaces).toHaveLength(2);
  });

  it('shows the deduplicated actor of a document participant when it is linked', async () => {
    let documentParticipant = {
      id: 'dpt_1',
      role: 'editor',
      editCount: 2,
      lastEditedAt: activeAt,
      lastViewedAt: activeAt,
      createdAt,
      resourceActor: resourceActor('Surface actor')
    };

    let unlinked = await v1DocumentParticipantPresenter
      .present({ documentParticipant: documentParticipant as any }, context)
      .run();
    let linked = await v1DocumentParticipantPresenter
      .present(
        {
          documentParticipant: {
            ...documentParticipant,
            storeParticipant: {
              id: 'stp_1',
              primaryResourceActor: resourceActor('Primary')
            }
          } as any
        },
        context
      )
      .run();

    expect(unlinked).toMatchObject({
      actor: { name: 'Surface actor' },
      store_participant_id: null
    });
    expect(linked).toMatchObject({
      actor: { name: 'Primary' },
      store_participant_id: 'stp_1'
    });
  });
});

describe('skill access presenter', () => {
  it('presents personal groups as consumer profiles and other tags as groups', async () => {
    let presented = await v1SkillAccessPresenter
      .present(
        {
          skill: skill as any,
          grants: [
            {
              level: 'manage',
              accessTag: {
                id: 'act_1',
                consumerGroup: {
                  id: 'cgr_personal',
                  name: 'Personal',
                  personalOwner: { id: 'cpf_1', name: 'Author' }
                },
                consumerProfile: null
              }
            },
            {
              level: 'read',
              accessTag: {
                id: 'act_2',
                consumerGroup: { id: 'cgr_team', name: 'Team', personalOwner: null },
                consumerProfile: null
              }
            },
            {
              level: 'write',
              accessTag: { id: 'act_3', consumerGroup: null, consumerProfile: null }
            }
          ] as any
        },
        context
      )
      .run();

    expect(presented).toMatchObject({ object: 'skill.access', skill_id: 'skl_1' });
    expect(presented.grants.map((grant: any) => [grant.level, grant.subject])).toEqual([
      [
        'manage',
        expect.objectContaining({ type: 'consumer_profile', consumer_profile_id: 'cpf_1' })
      ],
      [
        'read',
        expect.objectContaining({ type: 'consumer_group', consumer_group_id: 'cgr_team' })
      ],
      ['write', expect.objectContaining({ type: 'access_tag' })]
    ]);
  });
});
