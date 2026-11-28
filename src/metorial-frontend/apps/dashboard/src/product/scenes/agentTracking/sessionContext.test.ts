import { describe, expect, it } from 'vitest';
import {
  linesChangedLabel,
  linkableUrl,
  otherDefaultBranch,
  pullRequestLabel,
  repositoryLabel,
  shortSha,
  worktreeLabel
} from './sessionContext';

describe('session context', () => {
  it('shows the default branch only when it is not the branch', () => {
    expect(otherDefaultBranch({ branch: 'main', defaultBranch: 'main' })).toBeNull();
    expect(otherDefaultBranch({ branch: 'ada/eng-1', defaultBranch: 'main' })).toBe('main');
    expect(otherDefaultBranch({ branch: 'ada/eng-1', defaultBranch: null })).toBeNull();
  });

  it('labels commits, pull requests, worktrees and lines', () => {
    expect(shortSha('3f9c2a71d04b5e8a96c1f0d2b7e4a51300c1d2e3')).toBe('3f9c2a7');
    expect(pullRequestLabel({ host: 'github.com', repository: 'acme/api', number: 7 })).toBe(
      'acme/api#7'
    );
    expect([worktreeLabel(true), worktreeLabel(false), worktreeLabel(null)]).toEqual([
      'Linked Worktree',
      'Main Checkout',
      null
    ]);
    expect(linesChangedLabel({ added: 1200, removed: 3 })).toBe('+1,200 −3');
    expect(linesChangedLabel({ added: 0, removed: 0 })).toBeNull();
  });
});

describe('repository and link helpers', () => {
  it('names a repository by owner and name, else by what is known', () => {
    let repository = { id: 'aten_1', host: 'github.com', owner: 'acme', name: 'api' };

    expect(repositoryLabel(repository)).toBe('acme/api');
    expect(repositoryLabel({ ...repository, owner: null })).toBe('api');
    expect(repositoryLabel({ ...repository, host: null })).toBe('acme/api');
    expect(repositoryLabel({ ...repository, owner: null, name: null })).toBe(
      'Unknown Repository'
    );
  });

  it('shows every host but the three public ones', () => {
    let on = (host: string) => ({ id: 'aten_1', host, owner: 'acme', name: 'api' });

    expect(
      ['github.com', 'gitlab.com', 'bitbucket.org'].map(host => repositoryLabel(on(host)))
    ).toEqual(['acme/api', 'acme/api', 'acme/api']);
    expect(repositoryLabel(on('github.com.evil.io'))).toBe('github.com.evil.io/acme/api');
    expect(repositoryLabel(on('10.0.0.5'))).toBe('10.0.0.5/acme/api');
    expect(pullRequestLabel({ host: 'git.acme.io', repository: 'acme/api', number: 7 })).toBe(
      'git.acme.io/acme/api#7'
    );
  });

  it('links only http and https addresses', () => {
    expect(linkableUrl('https://github.com/acme/api')).toBe('https://github.com/acme/api');
    expect(linkableUrl('http://jira.local/browse/ENG-1')).toBe(
      'http://jira.local/browse/ENG-1'
    );
    expect(linkableUrl('javascript:alert(1)')).toBeNull();
    expect(linkableUrl('not a url')).toBeNull();
    expect(linkableUrl(null)).toBeNull();
  });
});
