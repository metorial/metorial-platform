import { describe, expect, it } from 'vitest';
import {
  declarationMatches,
  isDeclarationActiveAt,
  matchDeclaration
} from '../../src/lib/billing/match';
import { declaration, declarationRequest } from './fixtures';

let user = (input: Parameters<typeof declaration>[0] = {}) =>
  declaration({ userId: 'aten_user', ...input });

let project = (input: Parameters<typeof declaration>[0] = {}) =>
  declaration({ projectId: 'atpr_a', ...input });

describe('matchDeclaration levels', () => {
  it('prefers a user declaration over a project one over the organization’s', () => {
    let organizationWide = declaration({ mode: 'api' });
    let projectWide = project({ mode: 'overage' });
    let forUser = user({ mode: 'included' });

    expect(
      matchDeclaration([organizationWide, projectWide, forUser], declarationRequest())
    ).toBe(forUser);
    expect(
      matchDeclaration([forUser, projectWide, organizationWide], declarationRequest())
    ).toBe(forUser);
    expect(matchDeclaration([organizationWide, projectWide], declarationRequest())).toBe(
      projectWide
    );
    expect(matchDeclaration([organizationWide], declarationRequest())).toBe(organizationWide);
  });

  it('keeps the level above the agent condition', () => {
    let projectAgent = project({ agentId: 'claude-code' });
    let forUser = user();

    expect(matchDeclaration([projectAgent, forUser], declarationRequest())).toBe(forUser);
  });

  it('prefers a declaration naming the agent within a level', () => {
    for (let make of [declaration, project, user]) {
      let anyAgent = make({ validFrom: new Date('2026-02-01T00:00:00Z') });
      let agent = make({ agentId: 'claude-code' });

      expect(matchDeclaration([anyAgent, agent], declarationRequest())).toBe(agent);
      expect(matchDeclaration([agent, anyAgent], declarationRequest())).toBe(agent);
    }
  });

  it('prefers a user declaration for both user and project over one for the user only', () => {
    let userOnly = user();
    let userInProject = user({ projectId: 'atpr_a' });

    expect(matchDeclaration([userOnly, userInProject], declarationRequest())).toBe(
      userInProject
    );
  });

  it('prefers the later validFrom, then the newer id', () => {
    let early = declaration({ validFrom: new Date('2026-01-01T00:00:00Z') });
    let late = declaration({ validFrom: new Date('2026-02-01T00:00:00Z') });
    expect(matchDeclaration([late, early], declarationRequest())).toBe(late);
    expect(matchDeclaration([early, late], declarationRequest())).toBe(late);

    let older = declaration({ id: 'atbd_0001' });
    let newer = declaration({ id: 'atbd_0002' });
    expect(matchDeclaration([older, newer], declarationRequest())).toBe(newer);
    expect(matchDeclaration([newer, older], declarationRequest())).toBe(newer);
  });
});

describe('declarationMatches conditions', () => {
  it('applies only to its own organization', () => {
    expect(
      declarationMatches(declaration({ organizationId: 'ator_b' }), declarationRequest())
    ).toBe(false);
    expect(
      matchDeclaration([declaration({ organizationId: 'ator_b' })], declarationRequest())
    ).toBeUndefined();
  });

  it('applies a project declaration only inside its project', () => {
    let scoped = project();

    expect(declarationMatches(scoped, declarationRequest())).toBe(true);
    expect(declarationMatches(scoped, declarationRequest({ projectId: 'atpr_b' }))).toBe(
      false
    );
    expect(declarationMatches(scoped, declarationRequest({ projectId: null }))).toBe(false);
  });

  it('applies a user declaration only to that user', () => {
    let scoped = user();

    expect(declarationMatches(scoped, declarationRequest({ userId: 'aten_other' }))).toBe(
      false
    );
    expect(declarationMatches(scoped, declarationRequest({ userId: undefined }))).toBe(false);
  });

  it('applies an agent declaration only to that agent', () => {
    let scoped = declaration({ agentId: 'codex' });

    expect(declarationMatches(scoped, declarationRequest())).toBe(false);
    expect(declarationMatches(scoped, declarationRequest({ agentId: 'codex' }))).toBe(true);
    expect(declarationMatches(scoped, declarationRequest({ agentId: undefined }))).toBe(false);
  });

  it('applies a declaration without conditions to every request of the organization', () => {
    expect(
      declarationMatches(
        declaration(),
        declarationRequest({ projectId: null, userId: undefined, agentId: undefined })
      )
    ).toBe(true);
  });
});

describe('declaration validity', () => {
  let bounded = declaration({
    validFrom: new Date('2026-03-01T00:00:00Z'),
    validTo: new Date('2026-04-01T00:00:00Z')
  });

  it('includes validFrom and excludes validTo', () => {
    expect(isDeclarationActiveAt(bounded, new Date('2026-03-01T00:00:00Z'))).toBe(true);
    expect(isDeclarationActiveAt(bounded, new Date('2026-03-31T23:59:59.999Z'))).toBe(true);
    expect(isDeclarationActiveAt(bounded, new Date('2026-04-01T00:00:00Z'))).toBe(false);
    expect(isDeclarationActiveAt(bounded, new Date('2026-02-28T23:59:59.999Z'))).toBe(false);
  });

  it('stays active without validTo', () => {
    expect(isDeclarationActiveAt(declaration(), new Date('2099-01-01T00:00:00Z'))).toBe(true);
  });

  it('never applies an archived declaration, even inside its validity', () => {
    let archived = user({ archivedAt: new Date('2026-03-10T00:00:00Z') });
    let fallback = declaration();

    expect(isDeclarationActiveAt(archived, new Date('2026-03-04T10:00:00Z'))).toBe(false);
    expect(matchDeclaration([archived, fallback], declarationRequest())).toBe(fallback);
  });

  it('falls back to a broader declaration outside the narrower one’s validity', () => {
    let forUser = user({ validTo: new Date('2026-03-01T00:00:00Z') });
    let fallback = declaration();

    expect(matchDeclaration([forUser, fallback], declarationRequest())).toBe(fallback);
    expect(
      matchDeclaration([forUser, fallback], declarationRequest({ at: new Date('2026-02-01') }))
    ).toBe(forUser);
  });

  it('does not apply a declaration that starts after the request', () => {
    let later = declaration({ validFrom: new Date('2026-03-05T00:00:00Z') });

    expect(matchDeclaration([later], declarationRequest())).toBeUndefined();
  });
});
