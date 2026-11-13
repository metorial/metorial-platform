import type { SessionDocument } from '../../store/derivedModels';
import type { CandidateEntity } from '../candidates';

export let sessionDocument = (overrides: Partial<SessionDocument> = {}): SessionDocument => {
  let now = new Date('2026-11-13T10:00:00Z');

  return {
    _id: 'session-1',
    organizationId: 'gor_1',
    projectId: 'gpr_1',
    instanceId: 'gin_1',
    origin: 'native',
    versions: { summary: 1, attribution: 1, facts: 1 },
    client: { family: 'claude-code' },
    rootSessionKey: 'session-1',
    startedAt: now,
    lastActivityAt: now,
    lastObservedAt: now,
    state: 'active',
    observed: { clientUserIds: [], clientInstallationIds: [] },
    context: { workspaceIds: [], repoIds: [], ticketRefs: [], tags: [], pathStored: false },
    expiresAt: new Date(now.getTime() + 400 * 86_400_000),
    ...overrides
  };
};

export let candidate = (
  overrides: Partial<CandidateEntity> & { id: string }
): CandidateEntity => ({
  kind: 'project',
  name: overrides.id,
  keywords: [],
  repos: [],
  ticketPrefixes: [],
  scoped: false,
  ...overrides
});
