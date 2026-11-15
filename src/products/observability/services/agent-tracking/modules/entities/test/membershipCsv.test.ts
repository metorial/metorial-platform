import { describe, expect, it } from 'vitest';
import { diffMembers, groupRowsByTeam, parseMembershipCsv } from '../src/lib/membershipCsv';

describe('parseMembershipCsv', () => {
  it('parses rows with and without weights and skips the header', () => {
    let { rows, errors } = parseMembershipCsv(
      [
        'team,member email,weight',
        'platform, Ada@Acme.com ,0.5',
        'payments,bob@acme.com',
        ''
      ].join('\n')
    );

    expect(errors).toEqual([]);
    expect(rows).toEqual([
      { line: 2, team: 'platform', email: 'ada@acme.com', weight: 0.5 },
      { line: 3, team: 'payments', email: 'bob@acme.com' }
    ]);
  });

  it('works without a header, with CRLF, quotes and comments', () => {
    let { rows, errors } = parseMembershipCsv(
      '\uFEFF"Platform, Core",ada@acme.com\r\n# comment\r\n"say ""hi""";bob@acme.com\r\n'
    );

    expect(errors).toEqual([]);
    expect(rows.map(row => [row.team, row.email])).toEqual([
      ['Platform, Core', 'ada@acme.com'],
      ['say "hi"', 'bob@acme.com']
    ]);
  });

  it('reports invalid rows with their line numbers', () => {
    let { rows, errors } = parseMembershipCsv(
      [
        'platform,ada@acme.com',
        ',bob@acme.com',
        'platform,not-an-email',
        'platform,c@acme.com,2'
      ].join('\n')
    );

    expect(rows).toHaveLength(1);
    expect(errors.map(error => error.line)).toEqual([2, 3, 4]);
    expect(errors[1]!.message).toContain('not-an-email');
    expect(errors[2]!.message).toContain('weight');
  });

  it('groups rows by team and keeps the last row per email', () => {
    let { rows } = parseMembershipCsv(
      ['platform,ada@acme.com,0.2', 'platform,ada@acme.com,0.4', 'payments,ada@acme.com'].join(
        '\n'
      )
    );

    let groups = groupRowsByTeam(rows);

    expect([...groups.keys()]).toEqual(['platform', 'payments']);
    expect(groups.get('platform')).toEqual([{ email: 'ada@acme.com', weight: 0.4 }]);
  });
});

describe('diffMembers', () => {
  it('splits desired members into added, changed and kept, and finds removals', () => {
    let diff = diffMembers({
      current: [
        { email: 'ada@acme.com', userId: 'aten_ada', weight: null },
        { email: 'bob@acme.com', userId: 'aten_bob', weight: 0.5 },
        { email: 'eve@acme.com', userId: 'aten_eve', weight: null },
        { email: null, userId: 'aten_no_email', weight: null },
        { email: 'pending@acme.com', userId: null, weight: null }
      ],
      desired: [
        { email: 'ada@acme.com' },
        { email: 'bob@acme.com', weight: 0.25 },
        { email: 'pending@acme.com' },
        { email: 'new@acme.com' }
      ]
    });

    expect(diff.added).toEqual([{ email: 'new@acme.com' }]);
    expect(diff.changed).toEqual([{ email: 'bob@acme.com', weight: 0.25 }]);
    expect(diff.kept.map(member => member.email)).toEqual([
      'ada@acme.com',
      'pending@acme.com'
    ]);
    expect(diff.removed.map(member => member.userId)).toEqual(['aten_eve', 'aten_no_email']);
  });
});
