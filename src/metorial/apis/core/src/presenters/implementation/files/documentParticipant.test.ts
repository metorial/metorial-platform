import { describe, expect, it, vi } from 'vitest';

let databaseCalls = vi.hoisted(() => ({
  organizationActorFindUnique: vi.fn(),
  instanceConsumerFindFirst: vi.fn()
}));

vi.mock('@metorial/db', () => ({
  db: {
    organizationActor: {
      findUnique: databaseCalls.organizationActorFindUnique
    },
    instanceConsumer: {
      findFirst: databaseCalls.instanceConsumerFindFirst
    }
  },
  getImageUrl: vi.fn(async () => 'https://example.com/image.png')
}));

import { v1DocumentParticipantPresenter } from './documentParticipant';
import { v1SkillParticipantPresenter } from '../skills/skillParticipant';

let presenterContext = {
  apiVersion: 'mt_2025_01_01_dashboard',
  accessType: 'user_auth_token'
} as const;

let now = new Date('2026-07-19T12:00:00.000Z');

let consumerActor = {
  oid: 1n,
  id: 'rac_profile',
  identifier: 'mte-cpf-cpf_1',
  type: 'external',
  name: 'Profile Actor',
  resourceTenantOid: 2n,
  organizationActorOid: null,
  consumerOid: 3n,
  consumerProfileOid: 4n,
  createdAt: now,
  updatedAt: now,
  organizationActor: null,
  consumerProfile: {
    oid: 4n,
    id: 'cpf_1',
    status: 'active',
    name: 'Portal Profile',
    email: 'portal@example.com',
    instanceOid: 5n,
    organizationMember: null,
    surface: {},
    consumer: {
      instanceConsumers: [
        {
          id: 'inc_1',
          name: 'Portal Consumer',
          email: 'portal@example.com',
          instanceOid: 5n,
          createdAt: now,
          updatedAt: now,
          consumer: {
            id: 'con_1'
          }
        }
      ]
    }
  },
  consumer: null
} as any;

describe('participant actor presentation', () => {
  it('presents a document participant profile actor without database lookups', async () => {
    let result = await v1DocumentParticipantPresenter
      .present(
        {
          documentParticipant: {
            id: 'dpa_1',
            role: 'editor',
            editCount: 3,
            lastEditedAt: now,
            lastViewedAt: null,
            createdAt: now,
            document: { id: 'doc_1' },
            resourceActor: consumerActor
          } as any
        },
        presenterContext
      )
      .run();

    expect(result.actor.resource_actor).toEqual({
      id: 'rac_profile',
      type: 'external',
      name: 'Profile Actor'
    });
    expect(result.actor.consumer_profile).toEqual({
      id: 'cpf_1',
      name: 'Portal Profile',
      status: 'active'
    });
    expect(result.actor.consumer).toMatchObject({
      id: 'inc_1',
      name: 'Portal Consumer',
      email: 'portal@example.com'
    });
    expect(databaseCalls.organizationActorFindUnique).not.toHaveBeenCalled();
    expect(databaseCalls.instanceConsumerFindFirst).not.toHaveBeenCalled();
  });

  it('presents a skill participant organization member from eager data', async () => {
    let organizationMember = {
      id: 'omem_1',
      status: 'active',
      role: 'admin'
    };
    let organizationActor = {
      id: 'oac_1',
      type: 'member',
      name: 'Organization Member',
      email: 'member@example.com',
      organization: {
        id: 'org_1'
      },
      member: organizationMember,
      teams: [],
      createdAt: now,
      updatedAt: now
    };

    let result = await v1SkillParticipantPresenter
      .present(
        {
          skillParticipant: {
            id: 'spa_1',
            roles: ['creator'],
            skill: { id: 'skl_1' },
            resourceActor: {
              ...consumerActor,
              id: 'rac_member',
              name: 'Organization Member',
              organizationActorOid: 6n,
              consumerOid: null,
              consumerProfileOid: null,
              organizationActor,
              consumerProfile: null
            },
            createdAt: now,
            updatedAt: now
          } as any
        },
        presenterContext
      )
      .run();

    expect(result.actor.resource_actor).toMatchObject({
      id: 'rac_member',
      name: 'Organization Member'
    });
    expect(result.actor.organization_actor).toMatchObject({
      id: 'oac_1',
      organization_id: 'org_1'
    });
    expect(result.actor.organization_member).toEqual(organizationMember);
    expect(databaseCalls.organizationActorFindUnique).not.toHaveBeenCalled();
    expect(databaseCalls.instanceConsumerFindFirst).not.toHaveBeenCalled();
  });
});
