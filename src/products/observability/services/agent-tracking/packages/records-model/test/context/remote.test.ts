import { describe, expect, it } from 'vitest';
import { parseRemote, repoFromParts, repoIdentifier } from '../../src/context/remote';

let github = {
  provider: 'github.com',
  owner: 'metorial',
  name: 'platform',
  url: 'https://github.com/metorial/platform'
};

describe('parseRemote', () => {
  it.each([
    'https://github.com/metorial/platform.git',
    'https://github.com/Metorial/Platform',
    'https://user:secret@github.com/metorial/platform.git',
    'https://github.com:443/metorial/platform/',
    'http://www.github.com/metorial/platform',
    'git@github.com:metorial/platform.git',
    'ssh://git@github.com/metorial/platform.git',
    'ssh://git@ssh.github.com:443/metorial/platform.git',
    'git://github.com/metorial/platform.git',
    'github.com/metorial/platform',
    '  GIT@GITHUB.COM:Metorial/Platform.git  '
  ])('normalizes %s to one repo', raw => {
    expect(parseRemote(raw)).toEqual(github);
  });

  it('never keeps credentials or ports in the url', () => {
    let repo = parseRemote('https://oauth2:ghp_abc@gitlab.example.com:8443/team/app.git');

    expect(repo).toEqual({
      provider: 'gitlab.example.com',
      owner: 'team',
      name: 'app',
      url: 'https://gitlab.example.com/team/app'
    });
    expect(JSON.stringify(repo)).not.toContain('ghp_abc');
  });

  it('keeps nested gitlab groups in the owner', () => {
    expect(parseRemote('git@gitlab.com:acme/platform/backend/api.git')).toMatchObject({
      provider: 'gitlab.com',
      owner: 'acme/platform/backend',
      name: 'api'
    });
  });

  it.each([
    'https://dev.azure.com/acme/Payments/_git/api',
    'git@ssh.dev.azure.com:v3/acme/Payments/api',
    'https://acme.visualstudio.com/Payments/_git/api'
  ])('maps azure devops remote %s onto dev.azure.com', raw => {
    let repo = parseRemote(raw);

    expect(repo?.provider).toBe('dev.azure.com');
    expect(repo?.name).toBe('api');
  });

  it.each([
    undefined,
    '',
    'not a remote',
    '/Users/dev/code/platform',
    'file:///srv/git/platform.git',
    'https://github.com/metorial',
    'git@github.com:metorial',
    `https://github.com/${'a'.repeat(600)}/b`,
    'https://github.com/owner/na me'
  ])('rejects %s', raw => {
    expect(parseRemote(raw)).toBeNull();
  });
});

describe('repoFromParts', () => {
  it('maps provider names to hosts', () => {
    expect(repoFromParts({ provider: 'GitHub', owner: 'Metorial', name: 'platform' })).toEqual(
      github
    );
    expect(repoFromParts({ provider: 'gitlab', owner: 'a', name: 'b' })?.provider).toBe(
      'gitlab.com'
    );
    expect(repoFromParts({ provider: 'bitbucket', owner: 'a', name: 'b' })?.provider).toBe(
      'bitbucket.org'
    );
  });

  it('accepts a self-hosted host as the provider', () => {
    expect(
      repoFromParts({ provider: 'git.acme.internal', owner: 'core', name: 'api.git' })
    ).toMatchObject({ provider: 'git.acme.internal', owner: 'core', name: 'api' });
  });

  it('needs all three parts', () => {
    expect(repoFromParts({ provider: 'github', owner: 'a' })).toBeNull();
    expect(repoFromParts({ owner: 'a', name: 'b' })).toBeNull();
  });
});

describe('repoIdentifier', () => {
  it('is provider/owner/name', () => {
    expect(repoIdentifier(github)).toBe('github.com/metorial/platform');
  });
});
