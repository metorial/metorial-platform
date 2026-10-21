import { rejectionOf, uniqueEmail, uniqueId, useOrganization } from '@metorial/e2e';
import {
  db,
  loadOrganizationFixture,
  subspaceDb,
  type OrganizationFixture
} from '@metorial/e2e/db';
import {
  consumerProfileService,
  consumerSurfaceService
} from '@metorial/module-consumer-core';
import { describe, expect, it } from 'vitest';
import {
  consumerActivityScopeService,
  consumerActorService,
  consumerSkillService
} from '../src';

let createProfile = async (
  fixture: OrganizationFixture,
  input: { allowConsumerSkillAuthoring?: boolean } = {}
) => {
  let consumerSurface = await consumerSurfaceService.createConsumerSurface({
    organization: fixture.organization,
    instance: fixture.instance,
    context: fixture.context,
    auditScope: fixture.auditScope,
    type: 'portal',
    input: {
      name: uniqueId('Entities Surface'),
      sessionExpiryTimeInSeconds: 3600,
      allowConsumerSkillAuthoring: input.allowConsumerSkillAuthoring
    }
  });
  let consumerProfile = await consumerProfileService.createConsumerProfile({
    surface: consumerSurface,
    email: uniqueEmail('entities'),
    name: 'E2E Entities Consumer',
    auditScope: fixture.auditScope
  });

  return { consumerSurface, consumerProfile };
};

describe('module-consumer-entities', () => {
  let org = useOrganization();

  it('provisions a default consumer actor with an identity in the integrations database', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { consumerProfile } = await createProfile(fixture);

    let actor = await consumerActorService.ensureDefaultConsumerActor({
      instance: fixture.instance,
      consumerProfile
    });
    expect(actor.isDefault).toBe(true);
    expect(actor.consumerProfileOid).toBe(consumerProfile.oid);
    expect(actor.defaultIdentityId).toBeTruthy();

    let again = await consumerActorService.ensureDefaultConsumerActor({
      instance: fixture.instance,
      consumerProfile
    });
    expect(again.id).toBe(actor.id);
    expect(
      await db.consumerActor.count({
        where: { consumerProfileOid: consumerProfile.oid, isDefault: true }
      })
    ).toBe(1);

    let identityActor = await subspaceDb.identityActor.findUniqueOrThrow({
      where: { id: actor.id }
    });
    expect(identityActor.type).toBe('consumer');

    let identity = await subspaceDb.identity.findUniqueOrThrow({
      where: { id: actor.defaultIdentityId! }
    });
    expect(identity.status).toBe('active');
  });

  it('resolves the activity scope of a consumer profile', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { consumerProfile } = await createProfile(fixture);

    let scope = await consumerActivityScopeService.resolve({
      instance: fixture.instance,
      consumerProfile,
      accessTags: [{ accessTagOid: consumerProfile.accessTagOid }]
    });
    expect(scope.consumerActor.consumerProfileOid).toBe(consumerProfile.oid);
    expect(scope.magicMcpSessions).toEqual([]);
    expect(scope.subspaceSessionIds).toEqual([]);

    let error = await rejectionOf(
      consumerActivityScopeService.resolve({
        instance: fixture.instance,
        consumerProfile: { oid: consumerProfile.oid, instanceOid: -1n },
        accessTags: []
      })
    );
    expect(error.data.code).toBe('not_found');
  });

  it('creates a consumer-authored skill only when the surface allows it', async () => {
    let fixture = await loadOrganizationFixture(org.ids);

    let blocked = await createProfile(fixture, { allowConsumerSkillAuthoring: false });
    let blockedError = await rejectionOf(
      consumerSkillService.createConsumerSkill({
        organization: fixture.organization,
        instance: fixture.instance,
        project: fixture.project,
        auditScope: fixture.auditScope,
        consumerSurface: blocked.consumerSurface,
        consumerProfile: blocked.consumerProfile,
        consumerGroups: [blocked.consumerProfile.personalConsumerGroup!],
        input: { name: uniqueId('blocked-skill') }
      })
    );
    expect(blockedError.data.code).toBe('precondition_failed');

    let { consumerSurface, consumerProfile } = await createProfile(fixture, {
      allowConsumerSkillAuthoring: true
    });
    let name = uniqueId('consumer-skill');
    let skill = await consumerSkillService.createConsumerSkill({
      organization: fixture.organization,
      instance: fixture.instance,
      project: fixture.project,
      auditScope: fixture.auditScope,
      consumerSurface,
      consumerProfile,
      consumerGroups: [consumerProfile.personalConsumerGroup!],
      input: { name, description: 'Authored by an e2e consumer' }
    });
    expect(skill.name).toBe(name);
    expect(skill.status).toBe('active');

    let participant = await db.skillParticipant.findFirst({
      where: {
        skill: { id: skill.id },
        resourceActor: { consumerProfileOid: consumerProfile.oid }
      }
    });
    expect(participant).not.toBeNull();
  });
});
