import { describe, expect, it } from 'vitest';
import { defaultBuildEgressHosts, parseBuildEgressPolicy } from './buildEgressPolicy';

describe('build egress policy', () => {
  it('allows npm and the apt mirrors by default, never everything', () => {
    let policy = parseBuildEgressPolicy({ hosts: defaultBuildEgressHosts(), cidrs: [] });

    expect(policy.entries).toEqual([]);
    expect(policy.hosts).toContainEqual({ pattern: 'registry.npmjs.org', ports: [443] });
    expect(policy.hosts).toContainEqual({ pattern: 'archive.ubuntu.com', ports: [80, 443] });
    expect(policy.hosts).toContainEqual({ pattern: 'deb.debian.org', ports: [80, 443] });
    expect(policy).not.toHaveProperty('allowAll');
  });

  it('adds the slate npm registry host to the defaults', () => {
    expect(defaultBuildEgressHosts('https://npm.internal.example:8443/repo/')).toContain(
      'npm.internal.example:8443'
    );
    expect(defaultBuildEgressHosts('http://verdaccio.local/')).toContain('verdaccio.local:80');
    expect(defaultBuildEgressHosts('https://registry.example.com')).toContain(
      'registry.example.com:443'
    );
  });

  it('merges ports per host and keeps hosts without ports open on every port', () => {
    let policy = parseBuildEgressPolicy({
      hosts: ['*.Example.com:443', '*.example.com:8443', 'git.internal', 'git.internal:22'],
      cidrs: []
    });

    expect(policy.hosts).toEqual([
      { pattern: '*.example.com', ports: [443, 8443] },
      { pattern: 'git.internal' }
    ]);
  });

  it('parses CIDR entries with optional port ranges', () => {
    let policy = parseBuildEgressPolicy({
      hosts: [],
      cidrs: ['10.20.0.0/16:443', 'fd00::/8:1000-2000', '192.0.2.10', '2001:db8::/32']
    });

    expect(policy).toEqual({
      entries: [
        { cidr: '10.20.0.0/16', portRange: { from: 443, to: 443 } },
        { cidr: 'fd00::/8', portRange: { from: 1000, to: 2000 } },
        { cidr: '192.0.2.10' },
        { cidr: '2001:db8::/32' }
      ]
    });
    expect(JSON.stringify(policy.entries[0])).toBe(
      '{"cidr":"10.20.0.0/16","portRange":{"from":443,"to":443}}'
    );
  });

  it('rejects invalid rules', () => {
    let hosts = (item: string) => () => parseBuildEgressPolicy({ hosts: [item], cidrs: [] });
    let cidrs = (item: string) => () => parseBuildEgressPolicy({ hosts: [], cidrs: [item] });

    expect(hosts('*')).toThrow();
    expect(hosts('foo.*.com')).toThrow();
    expect(hosts('https://example.com')).toThrow();
    expect(hosts('example.com:0')).toThrow();
    expect(hosts('example.com:99999')).toThrow();
    expect(cidrs('10.0.0.0/33')).toThrow();
    expect(cidrs('example.com/8')).toThrow();
    expect(cidrs('10.0.0.0/8:2000-1000')).toThrow();
  });
});
