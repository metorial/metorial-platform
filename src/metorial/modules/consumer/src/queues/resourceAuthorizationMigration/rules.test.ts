import { describe, expect, it } from 'vitest';
import {
  getConsumerSkillPermissions,
  getPersonalConsumerAccessPermissions,
  getSkillParticipantPolicyIdentifier,
  participantEvidenceGrantsAuthorization,
  shouldPruneMigrationPolicy
} from './rules';

describe('resource authorization migration rules', () => {
  it('maps ConsumerSkill access to participant-scoped policy permissions', () => {
    expect(getConsumerSkillPermissions(['read'])).toEqual(['skill_read']);
    expect(getConsumerSkillPermissions(['write'])).toEqual([
      'skill_read',
      'skill_write',
      'skill_manage_access'
    ]);
    expect(
      getSkillParticipantPolicyIdentifier(
        'resource_authorization_v1',
        'skp_1',
        'skill_manage_access'
      )
    ).toBe('skill_participant_migration:resource_authorization_v1:skp_1:skill_manage_access');
  });

  it('treats participant evidence as non-authorizing', () => {
    expect(participantEvidenceGrantsAuthorization()).toBe(false);
  });

  it('uses the participant projection to constrain stale personal access policies', () => {
    expect(
      getPersonalConsumerAccessPermissions({
        policyPermissions: ['skill_read', 'skill_write'],
        participantRoles: ['user', 'viewer']
      })
    ).toEqual(['skill_read']);
    expect(
      getPersonalConsumerAccessPermissions({
        policyPermissions: ['skill_read'],
        participantRoles: ['user', 'editor']
      })
    ).toEqual(['skill_read', 'skill_write']);
  });

  it('prunes only stale migration-owned and orphaned policies', () => {
    let base = {
      runId: 'resource_authorization_v1',
      expectedPolicyIdentifiers: new Set([
        'skill_participant_migration:resource_authorization_v1:skp_1:skill_read'
      ]),
      validConsumerAccessIds: new Set(['cac_active'])
    };

    expect(
      shouldPruneMigrationPolicy({
        ...base,
        systemIdentifier:
          'skill_participant_migration:resource_authorization_v1:skp_1:skill_read'
      })
    ).toBe(false);
    expect(
      shouldPruneMigrationPolicy({
        ...base,
        systemIdentifier:
          'skill_participant_migration:resource_authorization_v1:skp_1:skill_write'
      })
    ).toBe(true);
    expect(
      shouldPruneMigrationPolicy({
        ...base,
        systemIdentifier: 'skill_participant:skp_runtime:skill_write'
      })
    ).toBe(false);
    expect(
      shouldPruneMigrationPolicy({
        ...base,
        systemIdentifier: 'consumer_access:cac_orphan:skill_read'
      })
    ).toBe(true);
    expect(
      shouldPruneMigrationPolicy({
        ...base,
        systemIdentifier: 'consumer_access:cac_active:skill_read'
      })
    ).toBe(false);
  });
});
