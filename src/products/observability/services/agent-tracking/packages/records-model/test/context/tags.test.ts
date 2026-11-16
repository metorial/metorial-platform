import { describe, expect, it } from 'vitest';
import {
  buildTag,
  configTags,
  dedupeTags,
  envTagKey,
  envTags,
  namespacedTags,
  normalizeTagKey,
  sourceTags
} from '../../src/context/tags';

describe('normalizeTagKey', () => {
  it('namespaces bare keys under metorial.', () => {
    expect(normalizeTagKey('team')).toBe('metorial.team');
    expect(normalizeTagKey('Cost_Center')).toBe('metorial.cost_center');
  });

  it('keeps dotted keys', () => {
    expect(normalizeTagKey('acme.project')).toBe('acme.project');
  });

  it('rejects invalid and reserved keys', () => {
    expect(normalizeTagKey('1team')).toBeUndefined();
    expect(normalizeTagKey('has space')).toBeUndefined();
    expect(normalizeTagKey(`metorial.${'a'.repeat(80)}`)).toBeUndefined();
    expect(normalizeTagKey('metorial.user.ref')).toBeUndefined();
    expect(normalizeTagKey('metorial.device.ref')).toBeUndefined();
  });
});

describe('envTagKey', () => {
  it('maps METORIAL_ variables', () => {
    expect(envTagKey('METORIAL_TEAM')).toBe('metorial.team');
    expect(envTagKey('METORIAL_COST_CENTER')).toBe('metorial.cost_center');
  });

  it('ignores other and secret-looking variables', () => {
    expect(envTagKey('HOME')).toBeUndefined();
    expect(envTagKey('METORIAL_API_KEY')).toBeUndefined();
    expect(envTagKey('METORIAL_TOKEN')).toBeUndefined();
    expect(envTagKey('METORIAL_DB_PASSWORD')).toBeUndefined();
  });
});

describe('tag origins', () => {
  it('marks committed, unmodified config tags as repo', () => {
    expect(configTags({ tags: { team: 'payments' }, tracked: true, modified: false })).toEqual(
      [{ k: 'metorial.team', v: 'payments', origin: 'repo' }]
    );
  });

  it.each([{ tracked: true, modified: true }, { tracked: false, modified: false }, {}])(
    'marks other config tags as environment (%o)',
    state => {
      expect(configTags({ tags: { team: 'payments' }, ...state })).toEqual([
        { k: 'metorial.team', v: 'payments', origin: 'environment' }
      ]);
    }
  );

  it('marks credential tags as source', () => {
    expect(sourceTags([{ key: 'metorial.team', value: 'core' }])).toEqual([
      { k: 'metorial.team', v: 'core', origin: 'source' }
    ]);
  });

  it('marks env and resource attribute tags as environment', () => {
    expect(dedupeTags(envTags({ METORIAL_TEAM: 'core', PATH: '/bin' }))).toEqual([
      { k: 'metorial.team', v: 'core', origin: 'environment' }
    ]);
    expect(
      dedupeTags(
        namespacedTags({ 'metorial.project': 'x', 'service.name': 'y' }, 'environment')
      )
    ).toEqual([{ k: 'metorial.project', v: 'x', origin: 'environment' }]);
  });
});

describe('buildTag and dedupeTags', () => {
  it('drops empty, oversized and non-scalar values', () => {
    expect(buildTag('team', '', 'source')).toBeUndefined();
    expect(buildTag('team', 'x'.repeat(300), 'source')).toBeUndefined();
    expect(buildTag('team', { a: 1 }, 'source')).toBeUndefined();
    expect(buildTag('team', 3, 'source')).toEqual({
      k: 'metorial.team',
      v: '3',
      origin: 'source'
    });
  });

  it('keeps the first tag per origin and key and caps the count', () => {
    let tags = dedupeTags([
      buildTag('team', 'a', 'source'),
      buildTag('team', 'b', 'source'),
      buildTag('team', 'c', 'repo')
    ]);

    expect(tags.map(tag => `${tag.origin}:${tag.v}`)).toEqual(['source:a', 'repo:c']);

    let many = dedupeTags(
      Array.from({ length: 30 }, (_, index) => buildTag(`k${index}`, 'v', 'environment'))
    );
    expect(many).toHaveLength(20);
  });
});
