import { describe, expect, it } from 'bun:test';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getEndpoints, getEndpointVersions } from '../../fetch';
import {
  createMapper,
  mapObject
} from '../../../../../clients/metorial-node/packages/util-resource-mapper/src/compact';
import type { IntrospectedType } from '../../fetch';
import { generateMapper } from './mapper';
import { generateTypeFromIntrospectedType } from './type';

let type = (kind: string, extra: Partial<IntrospectedType> = {}): IntrospectedType => ({
  type: kind,
  optional: false,
  nullable: false,
  examples: [],
  ...extra
});

let object = (properties: Record<string, IntrospectedType>) => type('object', { properties });

let array = (item: IntrospectedType) => type('array', { items: [item] });

let union = (...items: IntrospectedType[]) => type('union', { items });

let evaluate = async (schema: IntrospectedType) => {
  let source = await generateMapper('mapper', 'Example', schema, {
    patterns: false,
    dateDefaults: false
  });
  let javascript = new Bun.Transpiler({ loader: 'ts' }).transformSync(
    source.replace('export let mapper', 'let mapper')
  );
  return {
    source,
    mapper: new Function('createMapper', 'mapObject', `${javascript}; return mapper;`)(
      createMapper,
      mapObject
    )
  };
};

describe('compact mapper generation', () => {
  it('eliminates identity trees and keeps only required renames and conversions', async () => {
    let { source, mapper } = await evaluate(
      object({
        direction: type('string'),
        cidrs: array(type('string')),
        ports: array(object({ from: type('number'), to: type('number') })),
        network_policies: array(
          object({ rules: array(object({ enabled: type('boolean') })) })
        ),
        created_at: type('date')
      })
    );

    expect(source).toContain("'network_policies'");
    expect(source).toContain("['created_at', 1, 4]");
    expect(source).not.toMatch(/direction|cidrs|ports|rules|passthrough|objectField/);
    expect(source).toContain('/* @__PURE__ */');
    expect(mapper.transformFrom({ direction: 'ingress', created_at: '2026-10-13' })).toEqual({
      direction: 'ingress',
      createdAt: new Date('2026-10-13')
    });
    expect((await evaluate(array(object({ name: type('string') })))).source).toContain(
      'createMapper<Example>(0)'
    );
  });

  it('uses explicit targets for noncanonical casing, acronyms, digits, and aliases', async () => {
    let { source, mapper } = await evaluate(
      object({
        createdAt: type('date'),
        updatedAt: type('date'),
        API_key: type('string'),
        field_2_name: type('string'),
        weirdName: type('string')
      })
    );

    expect(source).toContain("['created_at', 1, 4]");
    expect(source).toContain("['updated_at', 1, 4]");
    expect(source).toContain("['API_key', 'apiKey']");
    expect(source).toContain("['field_2_name', 'field2Name']");
    expect(source).not.toContain('weirdName');
    expect(mapper.transformFrom({ API_key: 1, field_2_name: 2 })).toEqual({
      apiKey: 1,
      field2Name: 2
    });
  });

  it('rejects normalized collisions before identity pruning in both generators', async () => {
    let schema = object({ some_key: type('string'), someKey: type('string') });

    await expect(generateMapper('mapper', 'Example', schema)).rejects.toThrow(
      /Example.some_key and Example.someKey/
    );
    await expect(generateTypeFromIntrospectedType('Example', schema)).rejects.toThrow(
      /some_key and .*someKey/
    );
    await expect(evaluate(object({ nested: array(schema) }))).rejects.toThrow(
      /Example.nested\[\].some_key/
    );
    await expect(
      evaluate(
        union(object({ some_key: type('string') }), object({ someKey: type('string') }))
      )
    ).rejects.toThrow(/some_key and .*someKey/);
  });

  it('retains distinct singular and plural properties in generated types', async () => {
    let source = await generateTypeFromIntrospectedType(
      'Example',
      object({ id: type('string'), ids: array(type('string')) })
    );

    expect(source).toContain('id: string');
    expect(source).toContain('ids: string[]');
  });

  it('maps union arrays and dates with primitive precedence in both directions', async () => {
    let schema = union(array(object({ some_key: type('string') })), type('date'));
    let { mapper } = await evaluate(schema);

    expect(mapper.transformFrom([{ some_key: 'a' }])).toEqual([{ someKey: 'a' }]);
    expect(mapper.transformTo([{ someKey: 'a' }])).toEqual([{ some_key: 'a' }]);
    expect(mapper.transformFrom('2026-10-13')).toEqual(new Date('2026-10-13'));
    expect(mapper.transformTo(42)).toEqual(new Date(42));

    let strings = (await evaluate(union(type('date'), type('string')))).mapper;
    let numbers = (await evaluate(union(type('date'), type('number')))).mapper;
    let literals = (
      await evaluate(union(type('date'), type('literal', { examples: ['2026-10-13'] })))
    ).mapper;

    expect(strings.transformFrom('2026-10-13')).toBe('2026-10-13');
    expect(numbers.transformTo(42)).toBe(42);
    expect(literals.transformFrom('2026-10-13')).toBe('2026-10-13');
  });

  it('merges object alternatives and nested array alternatives without mapping records', async () => {
    let { mapper } = await evaluate(
      union(
        object({ first_key: type('string') }),
        object({ second_key: type('number') }),
        array(array(object({ inner_key: type('string') })))
      )
    );

    expect(mapper.transformFrom({ first_key: 'a', second_key: 2 })).toEqual({
      firstKey: 'a',
      secondKey: 2
    });
    expect(mapper.transformFrom([[{ inner_key: 'a' }]])).toEqual([[{ innerKey: 'a' }]]);
    expect((await evaluate(type('record', { items: [type('date')] }))).source).toContain(
      'createMapper<Example>(0)'
    );
  });
  it('reads snapshots without contacting the API', async () => {
    let version = {
      version: 'mt_2025_01_01_dashboard',
      displayVersion: '2025-01-01',
      isCurrent: true
    };
    let data = { types: [], controllers: [], endpoints: [] };
    let snapshot = {
      versions: { versions: [version] },
      endpoints: { [version.version]: data }
    };

    expect(await getEndpointVersions('http://unreachable.invalid', snapshot)).toBe(
      snapshot.versions
    );
    expect(await getEndpoints('http://unreachable.invalid', version.version, snapshot)).toBe(
      data
    );
    await expect(
      getEndpoints('http://unreachable.invalid', 'missing', snapshot)
    ).rejects.toThrow('Missing introspection snapshot');
  });

  it('rejects schema conflicts before deleting or writing generated files', async () => {
    let directory = await mkdtemp(path.join(tmpdir(), 'metorial-generator-'));

    try {
      let output = path.join(directory, 'clients/metorial-dashboard/src/gen');
      let marker = path.join(output, 'src/mt_previous_dashboard/keep.txt');
      let snapshotFile = path.join(directory, 'snapshot.json');
      let version = {
        version: 'mt_2025_01_01_dashboard',
        displayVersion: '2025-01-01',
        isCurrent: true
      };
      let schema = object({ some_key: type('string'), someKey: type('string') });

      await mkdir(path.dirname(marker), { recursive: true });
      await writeFile(marker, 'keep');
      await writeFile(
        snapshotFile,
        JSON.stringify({
          versions: { versions: [version] },
          endpoints: {
            [version.version]: {
              types: [{ id: 'conflict', name: 'Conflict', type: schema }],
              endpoints: [],
              controllers: []
            }
          }
        })
      );

      let generator = fileURLToPath(new URL('../../index.ts', import.meta.url));
      let originalArgs = process.argv;

      try {
        process.argv = [
          process.execPath,
          generator,
          'http://unreachable.invalid',
          output,
          'typescript',
          snapshotFile
        ];
        await expect(import(generator)).rejects.toThrow(
          'Conflict.some_key and Conflict.someKey'
        );
      } finally {
        process.argv = originalArgs;
      }

      expect(await readFile(marker, 'utf8')).toBe('keep');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
