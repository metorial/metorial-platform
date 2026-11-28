import { describe, expect, it } from 'vitest';

import { pullRequestUrl, repositoryHost, repositoryUrl, ticketUrl } from '../src/lib/urls';

let github = { provider: 'github.com', owner: 'acme', name: 'api' };

let template = 'https://linear.app/acme/issue/{key}';

describe('ticketUrl', () => {
  it('fills the template with the encoded key', () => {
    expect(ticketUrl('ENG-12', { template, repositories: [] })).toBe(
      'https://linear.app/acme/issue/ENG-12'
    );
    expect(
      ticketUrl('A&B/?#-1', {
        template: 'https://tickets.example.com/browse?key={key}&from={key}',
        repositories: []
      })
    ).toBe('https://tickets.example.com/browse?key=A%26B%2F%3F%23-1&from=A%26B%2F%3F%23-1');
  });

  it('has no link without a template', () => {
    expect(ticketUrl('ENG-12', { template: null, repositories: [github] })).toBeNull();
  });

  it('links an issue number to the issues of the one GitHub or GitLab repository', () => {
    expect(ticketUrl('#42', { template, repositories: [github] })).toBe(
      'https://github.com/acme/api/issues/42'
    );
    expect(
      ticketUrl('#7', {
        template: null,
        repositories: [{ provider: 'gitlab.example.com', owner: 'team/sub', name: 'web' }]
      })
    ).toBe('https://gitlab.example.com/team/sub/web/issues/7');
  });

  it('does not link an issue number it cannot place', () => {
    expect(ticketUrl('#42', { template, repositories: [] })).toBeNull();
    expect(
      ticketUrl('#42', {
        template,
        repositories: [github, { ...github, name: 'web' }]
      })
    ).toBeNull();
    expect(
      ticketUrl('#42', {
        template,
        repositories: [{ provider: 'bitbucket.org', owner: 'acme', name: 'api' }]
      })
    ).toBeNull();
    expect(ticketUrl('#0', { template: null, repositories: [github] })).toBeNull();
  });
});

describe('pullRequestUrl', () => {
  let pullRequest = (provider: string, repository = 'acme/api', number = 7) => ({
    provider,
    repository,
    number
  });

  it('builds the pull request page of each known provider', () => {
    expect(pullRequestUrl(pullRequest('github'))).toBe('https://github.com/acme/api/pull/7');
    expect(pullRequestUrl(pullRequest('github.com'))).toBe(
      'https://github.com/acme/api/pull/7'
    );
    expect(pullRequestUrl(pullRequest('gitlab.com', 'group/sub/api'))).toBe(
      'https://gitlab.com/group/sub/api/-/merge_requests/7'
    );
    expect(pullRequestUrl(pullRequest('bitbucket'))).toBe(
      'https://bitbucket.org/acme/api/pull-requests/7'
    );
  });

  it('uses a self-hosted host only when a repository of the session is on it', () => {
    let hosted = [{ provider: 'github.acme.dev' }];

    expect(pullRequestUrl(pullRequest('github.acme.dev'), hosted)).toBe(
      'https://github.acme.dev/acme/api/pull/7'
    );
    expect(
      pullRequestUrl(pullRequest('gitlab.acme.dev'), [{ provider: 'gitlab.acme.dev' }])
    ).toBe('https://gitlab.acme.dev/acme/api/-/merge_requests/7');
    expect(pullRequestUrl(pullRequest('github.acme.dev'))).toBeNull();
    expect(
      pullRequestUrl(pullRequest('git.acme.dev'), [{ provider: 'git.acme.dev' }])
    ).toBeNull();
  });

  it('has no link for an unknown provider', () => {
    expect(pullRequestUrl(pullRequest('azure'))).toBeNull();
    expect(pullRequestUrl(pullRequest('constructor'))).toBeNull();
    expect(pullRequestUrl(pullRequest('__proto__'))).toBeNull();
    expect(pullRequestUrl(pullRequest('codeberg.org'))).toBeNull();
  });

  it('refuses owners, names and numbers that do not fit a path', () => {
    expect(pullRequestUrl(pullRequest('github', 'acme/../evil'))).toBeNull();
    expect(pullRequestUrl(pullRequest('github', '../api'))).toBeNull();
    expect(pullRequestUrl(pullRequest('github', 'acme/api?x=1'))).toBeNull();
    expect(pullRequestUrl(pullRequest('github', 'evil.com/@acme/api'))).toBeNull();
    expect(pullRequestUrl(pullRequest('github', 'group/sub/api'))).toBeNull();
    expect(pullRequestUrl(pullRequest('github', 'api'))).toBeNull();
    expect(pullRequestUrl(pullRequest('github', 'acme/api', 0))).toBeNull();
    expect(pullRequestUrl(pullRequest('github', 'acme/api', 1.5))).toBeNull();
    expect(pullRequestUrl(pullRequest('evil.com/x'), [{ provider: 'evil.com/x' }])).toBeNull();
  });
});

describe('repositoryUrl', () => {
  it('builds an https URL from the provider host, owner and name', () => {
    expect(repositoryUrl(github)).toBe('https://github.com/acme/api');
    expect(repositoryUrl({ ...github, provider: 'gitlab' })).toBe(
      'https://gitlab.com/acme/api'
    );
  });

  it('has no URL for a hostile or missing part', () => {
    expect(repositoryUrl({ ...github, owner: 'acme/..' })).toBeNull();
    expect(repositoryUrl({ ...github, name: 'api"><script>' })).toBeNull();
    expect(repositoryUrl({ ...github, provider: 'javascript:alert(1)//' })).toBeNull();
    expect(repositoryUrl({ ...github, provider: null })).toBeNull();
    expect(repositoryUrl({ ...github, owner: null })).toBeNull();
  });
});

describe('hosts a device chose', () => {
  let on = (host: string) => ({ provider: host, owner: 'acme', name: 'api' });

  let pullRequestOn = (host: string) =>
    pullRequestUrl({ provider: host, repository: 'acme/api', number: 7 }, [on(host)]);

  let issueOn = (host: string) =>
    ticketUrl('#7', { template: null, repositories: [on(host)] });

  it('links the three public hosts with their own paths', () => {
    expect(['github.com', 'gitlab.com', 'bitbucket.org'].map(pullRequestOn)).toEqual([
      'https://github.com/acme/api/pull/7',
      'https://gitlab.com/acme/api/-/merge_requests/7',
      'https://bitbucket.org/acme/api/pull-requests/7'
    ]);
    expect(['github.com', 'gitlab.com', 'bitbucket.org'].map(repositoryHost)).toEqual([
      'github.com',
      'gitlab.com',
      'bitbucket.org'
    ]);
  });

  it('gives a GitHub or GitLab path only to a host with a whole github or gitlab label', () => {
    expect(pullRequestOn('github.acme.com')).toBe('https://github.acme.com/acme/api/pull/7');
    expect(pullRequestOn('gitlab.acme.com')).toBe(
      'https://gitlab.acme.com/acme/api/-/merge_requests/7'
    );
    expect(issueOn('gitlab.acme.com')).toBe('https://gitlab.acme.com/acme/api/issues/7');

    expect(pullRequestOn('evilgithub.com')).toBeNull();
    expect(issueOn('evilgithub.com')).toBeNull();
    expect(repositoryUrl(on('evilgithub.com'))).toBe('https://evilgithub.com/acme/api');
  });

  it('keeps a look-alike host as its own host, so it can be shown', () => {
    expect(repositoryHost('github.com.evil.io')).toBe('github.com.evil.io');
    expect(repositoryUrl(on('github.com.evil.io'))).toBe(
      'https://github.com.evil.io/acme/api'
    );
    expect(pullRequestOn('github.com.evil.io')).toBe(
      'https://github.com.evil.io/acme/api/pull/7'
    );
  });

  it.each([
    '10.0.0.5',
    '127.1',
    '10.0.1',
    '0x7f.0.0.1',
    'github.0x7f',
    'gitlab.acme.0x',
    'github.192',
    'git.localhost',
    'github.acme.local',
    'gitlab.corp.internal',
    'xn--gthub-cta.com',
    'github.xn--80ak6aa92e.com'
  ])('never links %s, an IP address, a local or an internationalized host', host => {
    expect(repositoryHost(host)).toBe(host);
    expect(repositoryUrl(on(host))).toBeNull();
    expect(pullRequestOn(host)).toBeNull();
    expect(issueOn(host)).toBeNull();
  });

  it.each(['github.acme.io', 'gitlab.1password.com', 'github.v2.acme.dev'])(
    'still links %s, whose last label is a name',
    host => {
      expect(repositoryUrl(on(host))).toBe(`https://${host}/acme/api`);
      expect(pullRequestOn(host)).not.toBeNull();
    }
  );
});
