import { describe, expect, it } from 'vitest';
import { compileRoutes, matchRoute } from '../router';

describe('matchRoute', () => {
  it('matches a static route', () => {
    let match = matchRoute('POST', '/v1/logs');

    expect(match.type).toBe('match');
    if (match.type != 'match') return;

    expect(match.definition.routeKind).toBe('otlp_http');
    expect(match.definition.signal).toBe('logs');
  });

  it('extracts path params', () => {
    let match = matchRoute('POST', '/v1/ingest/hooks/claude-code');

    expect(match.type).toBe('match');
    if (match.type != 'match') return;

    expect(match.params.client).toBe('claude-code');
    expect(match.definition.routeKind).toBe('hook');
  });

  it('decodes encoded path params', () => {
    let match = matchRoute('POST', '/v1/ingest/hooks/a%20b');

    expect(match.type).toBe('match');
    if (match.type != 'match') return;

    expect(match.params.client).toBe('a b');
  });

  it('treats malformed escapes in path params as not found', () => {
    expect(matchRoute('POST', '/v1/ingest/hooks/%E0%A4%A').type).toBe('not_found');
  });

  it('ignores trailing slashes', () => {
    expect(matchRoute('GET', '/ping/').type).toBe('match');
    expect(matchRoute('POST', '/v1/ingest/hooks/claude-code/').type).toBe('match');
  });

  it('reports method_not_allowed for parameterized routes', () => {
    expect(matchRoute('GET', '/v1/ingest/hooks/claude-code')).toEqual({
      type: 'method_not_allowed',
      allow: ['POST']
    });
  });

  it('compiles static routes with several methods onto one path', () => {
    let handler = async () => new Response();
    let compiled = compileRoutes([
      { method: 'GET', path: '/x', auth: 'none', accepts: [], handler },
      { method: 'POST', path: '/x', auth: 'none', accepts: [], handler }
    ]);

    expect(matchRoute('POST', '/x', compiled).type).toBe('match');
    expect(matchRoute('PUT', '/x', compiled)).toEqual({
      type: 'method_not_allowed',
      allow: ['GET', 'POST']
    });
  });

  it('reports the allowed methods when the method does not match', () => {
    let match = matchRoute('GET', '/v1/traces');

    expect(match).toEqual({ type: 'method_not_allowed', allow: ['POST'] });
  });

  it('reports not found for unknown paths', () => {
    expect(matchRoute('GET', '/v1/unknown').type).toBe('not_found');
    expect(matchRoute('POST', '/v1/ingest/hooks').type).toBe('not_found');
  });

  it('distinguishes the bulk ingest and dialect routes', () => {
    let ingest = matchRoute('POST', '/v1/bulk');
    let dialects = matchRoute('GET', '/v1/bulk/dialects');

    expect(ingest.type).toBe('match');
    expect(dialects.type).toBe('match');
    expect(matchRoute('POST', '/v1/bulk/dialects').type).toBe('method_not_allowed');
  });
});
