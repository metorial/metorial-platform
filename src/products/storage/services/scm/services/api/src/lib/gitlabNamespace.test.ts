import { describe, expect, it } from 'vitest';
import {
  getGitLabNamespaceId,
  getGitLabPersonalNamespaceId,
  isGitLabNamespaceError
} from './gitlabNamespace';

describe('GitLab namespace helpers', () => {
  it('uses the personal namespace ID instead of the user ID', () => {
    expect(getGitLabPersonalNamespaceId({ namespaceId: 456 })).toBe(456);
  });

  it('supports GitLab API responses that use snake_case fields', () => {
    expect(getGitLabPersonalNamespaceId({ namespace_id: '456' })).toBe(456);
  });

  it('falls back to the personal namespace returned by the namespaces API', () => {
    expect(
      getGitLabPersonalNamespaceId(
        { username: 'tobias' },
        [
          { id: 123, kind: 'group', path: 'metorial' },
          { id: 456, kind: 'user', path: 'tobias' }
        ]
      )
    ).toBe(456);
  });

  it('rejects non-numeric namespace IDs before creating a project', () => {
    expect(() => getGitLabNamespaceId('team/metorial')).toThrow(
      'GitLab namespace ID must be a positive integer'
    );
  });

  it('identifies GitLab namespace validation failures', () => {
    expect(
      isGitLabNamespaceError({
        cause: { description: '{"namespace":["is not valid"]}' }
      })
    ).toBe(true);
  });
});
