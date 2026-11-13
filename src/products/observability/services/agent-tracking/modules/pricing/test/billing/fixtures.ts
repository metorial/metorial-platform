import type { DeclarationRequest, MatchableDeclaration } from '../../src/lib/billing/match';

let counter = 0;

export let validFrom = new Date('2026-01-01T00:00:00Z');

export let declaration = (
  input: Partial<MatchableDeclaration> = {}
): MatchableDeclaration => ({
  id: `atbd_${String(++counter).padStart(4, '0')}`,
  organizationId: 'ator_a',
  projectId: null,
  userId: null,
  agentId: null,
  mode: 'included',
  plan: null,
  validFrom,
  validTo: null,
  archivedAt: null,
  ...input
});

export let declarationRequest = (
  input: Partial<DeclarationRequest> = {}
): DeclarationRequest => ({
  at: new Date('2026-03-04T10:00:00Z'),
  organizationId: 'ator_a',
  projectId: 'atpr_a',
  userId: 'aten_user',
  agentId: 'claude-code',
  ...input
});
