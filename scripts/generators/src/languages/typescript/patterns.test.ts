import { describe, expect, it } from 'bun:test';
import { isDeepStrictEqual } from 'node:util';
import {
  createMapper,
  mapObject
} from '../../../../../clients/metorial-node/packages/util-resource-mapper/src/compact';
import type { CompactDescriptor } from '../../../../../clients/metorial-node/packages/util-resource-mapper/src/compact';
import type { IntrospectedType } from '../../fetch';
import type { Descriptor, MapperOptions, PatternId } from './descriptor';
import { generateMapper, generateMapperDescriptor } from './mapper';
import { expandPatterns, mapperPatterns } from './patterns';

let type = (kind: string, extra: Partial<IntrospectedType> = {}): IntrospectedType => ({
  type: kind,
  optional: false,
  nullable: false,
  examples: [],
  ...extra
});

let object = (properties: Record<string, IntrospectedType>) => type('object', { properties });

let array = (item: IntrospectedType) => type('array', { items: [item] });

let date = type('date', { optional: true, nullable: true });

let pagination = object({ has_more_before: type('boolean'), has_more_after: type('boolean') });

let filter = object({ gt: date, lt: date });

let timestamps = object({ id: type('string'), created_at: date, updated_at: date });

let fixtures: [PatternId, IntrospectedType, Descriptor, any][] = [
  [5, filter, 5, { gt: '2026-10-14', lt: null, unknown_at: '2026-10-14' }],
  [
    6,
    pagination,
    6,
    { has_more_before: true, has_more_after: false, unknown_at: '2026-10-14' }
  ],
  [
    7,
    object({ object: type('literal'), items: array(timestamps), pagination }),
    [7, 8],
    {
      object: 'list',
      items: [{ id: 'one', created_at: '2026-10-14', updated_at: null }],
      pagination: { has_more_before: false, has_more_after: true }
    }
  ],
  [
    8,
    timestamps,
    8,
    {
      id: 'one',
      created_at: '2026-10-14',
      updated_at: null,
      metadata: { raw_at: '2026-10-14' }
    }
  ]
];

describe('mapper patterns', () => {
  it.each(fixtures)(
    'matches pattern %s and remains equivalent in both directions',
    (id, schema, expected, wire) => {
      let descriptor = generateMapperDescriptor(schema, 'Example');
      let enabled = createMapper(descriptor as CompactDescriptor, 1);
      let canonical = createMapper(
        generateMapperDescriptor(schema, 'Example', {
          patterns: false,
          dateDefaults: false
        }) as CompactDescriptor
      );

      expect(descriptor).toEqual(expected);
      expect(
        isDeepStrictEqual(enabled.transformFrom(wire), canonical.transformFrom(wire))
      ).toBe(true);
      expect(
        isDeepStrictEqual(
          enabled.transformTo(canonical.transformFrom(wire)),
          canonical.transformTo(canonical.transformFrom(wire))
        )
      ).toBe(true);
      expect(
        createMapper(expandPatterns(descriptor) as CompactDescriptor).transformFrom(wire)
      ).toEqual(canonical.transformFrom(wire));
      expect(mapperPatterns.some(pattern => pattern.id === id)).toBe(true);
    }
  );

  it('uses date shorthand but explicitly preserves non-date suffix fields and records', async () => {
    let schema = object({
      created_at: date,
      first_seen_at: type('string'),
      last_seen_at: type('string'),
      metadata: type('record', { items: [type('any')] }),
      metadata_at: type('record', { items: [type('any')] }),
      arbitrary_at: type('any'),
      timestamp: date
    });
    let descriptor = generateMapperDescriptor(schema, 'Logs');
    let mapper = createMapper(descriptor as CompactDescriptor, 1);
    let metadata = { raw_at: '2026-10-14', nested_key: { created_at: '2026-10-14' } };
    let wire = {
      created_at: '2026-10-14',
      first_seen_at: '2026-10-14',
      last_seen_at: '2026-10-14',
      metadata,
      metadata_at: metadata,
      arbitrary_at: metadata,
      unknown_at: '2026-10-14',
      timestamp: '2026-10-14'
    };
    let source = await generateMapper('mapper', 'Logs', schema);
    let output = mapper.transformFrom(wire);

    expect(source).toContain("'created_at'");
    expect(source).toContain("['first_seen_at', 1, 0]");
    expect(source).toContain("['metadata_at', 1, 0]");
    expect(source).toContain("['timestamp', 0, 4]");
    expect(output.createdAt).toEqual(new Date('2026-10-14'));
    expect(output.firstSeenAt).toBe('2026-10-14');
    expect(output.lastSeenAt).toBe('2026-10-14');
    expect(output.metadata).toBe(metadata);
    expect(output.metadataAt).toBe(metadata);
    expect(output.arbitraryAt).toBe(metadata);
    expect(output.unknown_at).toBe('2026-10-14');
    expect(mapper.transformTo(output).metadata_at).toBe(metadata);
  });

  it('falls back for mismatched schemas and additional transformations', () => {
    for (let schema of [
      object({ gt: type('string'), lt: date }),
      object({ gt: date, lt: date, nested_key: type('string') }),
      object({ has_more_before: type('string'), has_more_after: type('boolean') }),
      object({ created_at: date, updated_at: type('string') }),
      object({ items: array(timestamps), pagination, total_count: type('number') })
    ]) {
      expect(Array.isArray(generateMapperDescriptor(schema, 'Example'))).toBe(true);
    }
  });

  it('supports registry-disabled and individually selected patterns', () => {
    let schema = object({ items: array(timestamps), pagination });
    let hits: PatternId[] = [];

    expect(
      generateMapperDescriptor(filter, 'Filter', { patterns: false, dateDefaults: false })
    ).toEqual([
      1,
      [
        ['gt', 0, 4],
        ['lt', 0, 4]
      ]
    ]);
    expect(
      generateMapperDescriptor(schema, 'List', {
        patterns: [7],
        onPattern: id => hits.push(id)
      })
    ).toEqual([7, [1, ['created_at', 'updated_at']]]);
    expect(hits).toEqual([7]);
    expect(generateMapperDescriptor(schema, 'List', { patterns: [6] })).toEqual([
      1,
      [
        ['items', 0, [2, [1, ['created_at', 'updated_at']]]],
        ['pagination', 0, 6]
      ]
    ]);
  });

  it('preserves primitive precedence in date unions under suffix defaults', () => {
    let union = type('union', { items: [date, type('string')] });
    let mapper = createMapper(
      generateMapperDescriptor(
        object({ expires_at: union, created_at: filter }),
        'Input'
      ) as CompactDescriptor,
      1
    );

    expect(
      mapper.transformFrom({ expires_at: '2026-10-14', created_at: { gt: '2026-10-14' } })
    ).toEqual({ expiresAt: '2026-10-14', createdAt: { gt: new Date('2026-10-14') } });
  });
  it('omits unnecessary flags and uses explicit flags for inferred dates', async () => {
    expect(await generateMapper('mapper', 'Preview', timestamps)).toContain(
      'createMapper<Preview>(8)'
    );
    expect(await generateMapper('mapper', 'Page', pagination)).toContain(
      'createMapper<Page>(6)'
    );
    expect(await generateMapper('mapper', 'Output', object({ created_at: date }))).toContain(
      "mapObject<Output>(['created_at'], 1)"
    );
    expect(
      await generateMapper('mapper', 'Logs', object({ first_seen_at: type('string') }), {
        dateDefaults: false,
        patterns: false
      })
    ).toContain("mapObject<Logs>(['first_seen_at'])");
  });
});
