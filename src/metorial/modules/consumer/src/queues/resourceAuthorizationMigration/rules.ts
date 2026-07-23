export type MigratedSkillPermission = 'skill_read' | 'skill_write' | 'skill_manage_access';

export let getConsumerSkillPermissions = (permissions: string[]) => {
  let migrated: MigratedSkillPermission[] = [];
  if (permissions.includes('read')) migrated.push('skill_read');
  if (permissions.includes('write')) {
    migrated.push('skill_read', 'skill_write', 'skill_manage_access');
  }
  return [...new Set(migrated)];
};

export let getSkillParticipantPolicyIdentifier = (
  runId: string,
  skillParticipantId: string,
  permission: MigratedSkillPermission
) => `skill_participant_migration:${runId}:${skillParticipantId}:${permission}`;

export let participantEvidenceGrantsAuthorization = () => false;

export let getPersonalConsumerAccessPermissions = (d: {
  policyPermissions: MigratedSkillPermission[];
  participantRoles?: string[];
}) => {
  if (d.participantRoles?.includes('creator')) {
    return [
      'skill_read',
      'skill_write',
      'skill_manage_access'
    ] satisfies MigratedSkillPermission[];
  }
  if (d.participantRoles?.includes('editor')) {
    return ['skill_read', 'skill_write'] satisfies MigratedSkillPermission[];
  }
  if (d.participantRoles?.includes('viewer')) {
    return ['skill_read'] satisfies MigratedSkillPermission[];
  }
  if (!d.policyPermissions.length) {
    return ['skill_read'] satisfies MigratedSkillPermission[];
  }
  return [...new Set(d.policyPermissions)];
};

export let shouldPruneMigrationPolicy = (d: {
  systemIdentifier: string | null;
  runId: string;
  expectedPolicyIdentifiers: Set<string>;
  validConsumerAccessIds: Set<string>;
}) => {
  if (!d.systemIdentifier) return false;

  let sourceId = d.systemIdentifier.split(':')[1];
  let isLegacyMigrationPolicy =
    d.systemIdentifier.startsWith('consumer_access:legacy-consumer-skill:') ||
    d.systemIdentifier.startsWith('consumer_access:legacy-store-participant:');
  let isParticipantMigrationPolicy = d.systemIdentifier.startsWith(
    `skill_participant_migration:${d.runId}:`
  );
  if (isLegacyMigrationPolicy || isParticipantMigrationPolicy) {
    return !d.expectedPolicyIdentifiers.has(d.systemIdentifier);
  }

  return (
    d.systemIdentifier.startsWith('consumer_access:') &&
    !!sourceId &&
    !d.validConsumerAccessIds.has(sourceId)
  );
};
