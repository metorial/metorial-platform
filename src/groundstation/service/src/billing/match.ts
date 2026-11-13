import type { BillingMode } from '@metorial/groundstation-spec';

export type DeclaredBillingMode = Exclude<BillingMode, 'unknown'>;

export type MatchableDeclaration = {
  id: string;
  organizationId: string;
  projectId: string | null;
  userId: string | null;
  agentId: string | null;
  mode: DeclaredBillingMode;
  plan: string | null;
  validFrom: Date;
  validTo: Date | null;
  archivedAt: Date | null;
};

export type DeclarationRequest = {
  at: Date;
  organizationId: string;
  projectId: string | null;
  userId?: string;
  agentId?: string;
};

export let isDeclarationActiveAt = (declaration: MatchableDeclaration, at: Date) =>
  !declaration.archivedAt &&
  declaration.validFrom.getTime() <= at.getTime() &&
  (!declaration.validTo || at.getTime() < declaration.validTo.getTime());

export let declarationMatches = (
  declaration: MatchableDeclaration,
  request: DeclarationRequest
) =>
  declaration.organizationId == request.organizationId &&
  (!declaration.projectId || declaration.projectId == request.projectId) &&
  (!declaration.userId || declaration.userId == request.userId) &&
  (!declaration.agentId || declaration.agentId == request.agentId) &&
  isDeclarationActiveAt(declaration, request.at);

let compareDeclarations = (a: MatchableDeclaration, b: MatchableDeclaration) =>
  Number(!a.userId) - Number(!b.userId) ||
  Number(!a.projectId) - Number(!b.projectId) ||
  Number(!a.agentId) - Number(!b.agentId) ||
  b.validFrom.getTime() - a.validFrom.getTime() ||
  (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);

// A user declaration beats a project one, which beats the organization's; within each, one
// naming the agent beats one for every agent, then the later validFrom and the newer id win.
export let matchDeclaration = <T extends MatchableDeclaration>(
  declarations: T[],
  request: DeclarationRequest
): T | undefined =>
  declarations
    .filter(declaration => declarationMatches(declaration, request))
    .sort(compareDeclarations)[0];
