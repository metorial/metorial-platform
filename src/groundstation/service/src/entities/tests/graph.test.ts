import { describe, expect, it } from 'vitest';
import { isLinkValidAt, reachableEntities, type GraphLink } from '../graph';

let at = new Date('2026-06-01T00:00:00Z');
let before = new Date('2026-01-01T00:00:00Z');
let after = new Date('2026-12-01T00:00:00Z');

let link = (
  id: string,
  type: string,
  from: [string, string],
  to: [string, string],
  opts: Partial<GraphLink> = {}
): GraphLink => ({
  id,
  type,
  fromId: from[0],
  fromKind: from[1],
  toId: to[0],
  toKind: to[1],
  weight: null,
  validFrom: before,
  validTo: null,
  ...opts
});

let user: [string, string] = ['user', 'user'];
let teamA: [string, string] = ['teamA', 'team'];
let teamB: [string, string] = ['teamB', 'team'];
let platform: [string, string] = ['platform', 'team'];
let cc: [string, string] = ['cc', 'cost_center'];
let cc2: [string, string] = ['cc2', 'cost_center'];
let repo: [string, string] = ['repo', 'repo'];
let project: [string, string] = ['project', 'project'];

let byId = (entries: ReturnType<typeof reachableEntities>) =>
  new Map(entries.map(entry => [entry.entityId, entry]));

describe('isLinkValidAt', () => {
  it('includes validFrom and excludes validTo', () => {
    let bounded = { validFrom: at, validTo: after };

    expect(isLinkValidAt(bounded, at)).toBe(true);
    expect(isLinkValidAt(bounded, after)).toBe(false);
    expect(isLinkValidAt(bounded, before)).toBe(false);
    expect(isLinkValidAt({ validFrom: before, validTo: null }, after)).toBe(true);
  });
});

describe('reachableEntities', () => {
  it('walks membership and hierarchy upwards with the via path', () => {
    let links = [
      link('l1', 'member_of', user, teamA),
      link('l2', 'part_of', teamA, platform),
      link('l3', 'part_of', platform, cc)
    ];

    let reached = byId(reachableEntities(['user'], links, at));

    expect([...reached.keys()].sort()).toEqual(['cc', 'platform', 'teamA']);
    expect(reached.get('teamA')).toMatchObject({ hops: 1, weight: 1, via: ['user'] });
    expect(reached.get('cc')).toMatchObject({
      kind: 'cost_center',
      hops: 3,
      via: ['user', 'teamA', 'platform'],
      linkIds: ['l1', 'l2', 'l3'],
      startId: 'user'
    });
  });

  it('splits weight 1/n among siblings of the same kind', () => {
    let links = [
      link('l1', 'member_of', user, teamA),
      link('l2', 'member_of', user, teamB),
      link('l3', 'part_of', teamA, cc),
      link('l4', 'part_of', teamB, cc2)
    ];

    let reached = byId(reachableEntities(['user'], links, at));

    expect(reached.get('teamA')!.weight).toBe(0.5);
    expect(reached.get('teamB')!.weight).toBe(0.5);
    expect(reached.get('cc')!.weight).toBe(0.5);
    expect(reached.get('cc2')!.weight).toBe(0.5);
  });

  it('counts siblings per target kind', () => {
    let links = [link('l1', 'member_of', user, teamA), link('l2', 'member_of', user, cc)];

    let reached = byId(reachableEntities(['user'], links, at));

    expect(reached.get('teamA')!.weight).toBe(1);
    expect(reached.get('cc')!.weight).toBe(1);
  });

  it('uses explicit link weights', () => {
    let links = [
      link('l1', 'member_of', user, teamA, { weight: 0.8 }),
      link('l2', 'member_of', user, teamB, { weight: 0.2 }),
      link('l3', 'part_of', teamA, cc, { weight: 0.5 })
    ];

    let reached = byId(reachableEntities(['user'], links, at));

    expect(reached.get('teamA')!.weight).toBe(0.8);
    expect(reached.get('teamB')!.weight).toBe(0.2);
    expect(reached.get('cc')!.weight).toBeCloseTo(0.4);
  });

  it('sums paths that converge on one entity, capped at 1', () => {
    let links = [
      link('l1', 'member_of', user, teamA),
      link('l2', 'member_of', user, teamB),
      link('l3', 'part_of', teamA, cc),
      link('l4', 'part_of', teamB, cc)
    ];

    let reached = byId(reachableEntities(['user'], links, at));

    expect(reached.get('cc')!.weight).toBe(1);
    expect(reached.get('cc')!.hops).toBe(2);

    let overlapping = [
      ...links,
      link('l5', 'part_of', teamA, teamB),
      link('l6', 'member_of', user, cc2)
    ];

    expect(byId(reachableEntities(['user'], overlapping, at)).get('cc')!.weight).toBe(1);
  });

  it('terminates on cycles without revisiting entities', () => {
    let links = [
      link('l1', 'member_of', user, teamA),
      link('l2', 'part_of', teamA, teamB),
      link('l3', 'part_of', teamB, teamA),
      link('l4', 'part_of', teamB, cc)
    ];

    let reached = byId(reachableEntities(['user'], links, at));

    expect([...reached.keys()].sort()).toEqual(['cc', 'teamA', 'teamB']);
    expect(reached.get('teamA')!.via).toEqual(['user']);
    expect(reached.get('cc')!.via).toEqual(['user', 'teamA', 'teamB']);
  });

  it('ignores self links', () => {
    let reached = reachableEntities(['teamA'], [link('l1', 'part_of', teamA, teamA)], at);

    expect(reached).toEqual([]);
  });

  it('only follows links valid at the given time', () => {
    let links = [
      link('l1', 'member_of', user, teamA, { validTo: at }),
      link('l2', 'member_of', user, teamB, { validFrom: at }),
      link('l3', 'member_of', user, platform, { validFrom: after })
    ];

    let reached = byId(reachableEntities(['user'], links, at));

    expect([...reached.keys()]).toEqual(['teamB']);
    expect(reached.get('teamB')!.weight).toBe(1);

    let earlier = byId(reachableEntities(['user'], links, new Date('2026-03-01T00:00:00Z')));
    expect([...earlier.keys()]).toEqual(['teamA']);
  });

  it('stops after the maximum number of hops', () => {
    let links = [
      link('l1', 'member_of', user, ['t1', 'team']),
      link('l2', 'part_of', ['t1', 'team'], ['t2', 'team']),
      link('l3', 'part_of', ['t2', 'team'], ['t3', 'team']),
      link('l4', 'part_of', ['t3', 'team'], ['t4', 'team']),
      link('l5', 'part_of', ['t4', 'team'], ['t5', 'team'])
    ];

    expect(reachableEntities(['user'], links, at).map(entry => entry.entityId)).toEqual([
      't1',
      't2',
      't3',
      't4'
    ]);
    expect(reachableEntities(['user'], links, at, { maxHops: 2 })).toHaveLength(2);
  });

  it('skips links that do not propagate attribution', () => {
    let links = [
      link('l1', 'owned_by', ['device', 'device'], user),
      link('l2', 'part_of', ['sub', 'agent'], ['root', 'agent']),
      link('l3', 'member_of', user, project)
    ];

    expect(reachableEntities(['device', 'sub', 'user'], links, at)).toEqual([]);
    expect(
      reachableEntities(['user'], links, at, { staffingPropagates: true }).map(
        entry => entry.entityId
      )
    ).toEqual(['project']);
  });

  it('prefers the closest start and excludes the starts themselves', () => {
    let links = [
      link('l1', 'member_of', user, teamA),
      link('l2', 'part_of', teamA, cc),
      link('l3', 'part_of', repo, project),
      link('l4', 'part_of', project, cc)
    ];

    let reached = byId(reachableEntities(['user', 'repo', 'teamA'], links, at));

    expect(reached.has('teamA')).toBe(false);
    expect(reached.get('project')).toMatchObject({ startId: 'repo', hops: 1 });
    expect(reached.get('cc')).toMatchObject({ startId: 'teamA', hops: 1, via: ['teamA'] });
  });
});
