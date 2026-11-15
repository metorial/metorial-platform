// Regenerates ../go/testdata/validation.json, which ldrpc's schema interpreter is
// tested against, from the @lowerdeck/validation validators the spec defines:
//   bun run vectors
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { compile, createValidatorFactory, method, service, t } from '../index';

let output = join(import.meta.dir, '../../../go/testdata/validation.json');

let Node: t.Type<any> = t
  .object({ name: t.string(), children: t.array(t.lazy((): t.Type<any> => Node)).optional() })
  .named('Node');

let value = (type: t.Type<any>) =>
  method({ input: t.object({ value: type }), output: t.void() });

let spec = service({
  name: 'validation-vectors',
  go: { package: 'vectorsrpc' },
  ts: { client: 'VectorsClient' },
  methods: {
    string: value(t.string()),
    bounded: value(t.string({ minLength: 2, maxLength: 4 })),
    pattern: value(t.string({ pattern: '^[a-z]+(-[a-z]+)*$' })),
    slash: value(t.string({ pattern: '^[^/].*$' })),
    email: value(t.string({ format: 'email' })),
    url: value(t.string({ format: 'url' })),
    int: value(t.int()),
    boundedInt: value(t.int({ min: 1, max: 10 })),
    number: value(t.number()),
    boundedNumber: value(t.number({ min: -1.5, max: 2.5 })),
    boolean: value(t.boolean()),
    datetime: value(t.datetime()),
    bytes: value(t.bytes()),
    json: value(t.json()),
    stringLiteral: value(t.literal('on')),
    numberLiteral: value(t.literal(2)),
    booleanLiteral: value(t.literal(true)),
    enum: value(t.enum(['active', 'archived'])),
    array: value(t.array(t.int())),
    boundedArray: value(t.array(t.string(), { minLength: 1, maxLength: 2 })),
    record: value(t.record(t.int())),
    nullable: value(t.int().nullable()),
    optional: value(t.int().optional()),
    nested: value(t.object({ a: t.object({ b: t.array(t.object({ c: t.string() })) }) })),
    recursive: value(Node),
    alias: value(t.string({ maxLength: 3 }).named('ShortCode')),
    union: method({
      input: t.union('type', {
        file: t.object({ path: t.string(), size: t.int() }),
        directory: t.object({ path: t.string() })
      }),
      output: t.void()
    }),
    multi: method({
      input: t.object({ a: t.string(), b: t.int(), c: t.boolean().optional() }),
      output: t.void()
    })
  }
});

let cases: Record<string, unknown[]> = {
  string: ['', 'hello', 'ünïcødé 🎉', 1, true, null, [], {}, undefined],
  bounded: ['a', 'ab', 'abcd', 'abcde', '🎉', '🎉🎉', '🎉🎉🎉', 'éé'],
  pattern: ['abc', 'abc-def', 'Abc', 'abc-', '', 'a b'],
  slash: ['x', 'x/y', '/x', ''],
  email: [
    'a@b.co',
    'first.last+tag@example.com',
    'nope',
    'a@b',
    '@b.co',
    'a@@b.co',
    ' a@b.co',
    ''
  ],
  url: [
    'https://example.com',
    'http://localhost:3000/path?q=1#h',
    'ftp://files.example.com',
    'mailto:a@b.co',
    'example.com',
    '//example.com',
    'https://',
    'not a url',
    ''
  ],
  int: [
    0,
    -1,
    42,
    9007199254740991,
    9007199254740992,
    -9007199254740992,
    1.5,
    '5',
    '5.5',
    '',
    ' 7 ',
    'abc',
    '-Infinity',
    true,
    null,
    1e21
  ],
  boundedInt: [0, 1, 10, 11, 5.5, '3', '11'],
  number: [
    0,
    -0.5,
    1e300,
    '1.25',
    '',
    '  ',
    'NaN',
    'Infinity',
    '0x10',
    '1e3',
    true,
    false,
    null,
    [],
    [3],
    {}
  ],
  boundedNumber: [-1.5, -1.6, 2.5, 2.51, '2.6', 0],
  boolean: [true, false, 'true', 'false', 'yes', 1, 0, null, 'TRUE'],
  datetime: [
    '2024-01-02T03:04:05.678Z',
    '2024-01-02T03:04:05Z',
    '2024-01-02',
    '2024-01-02T03:04:05+02:00',
    '2024-13-02T00:00:00Z',
    'not a date',
    '',
    0,
    1700000000000,
    -1,
    1.5,
    true,
    null,
    {}
  ],
  bytes: ['', 'aGVsbG8=', 'not base64!', 1],
  json: [null, 1, 'x', [1, { a: true }], { nested: { deep: [null] } }, undefined],
  stringLiteral: ['on', 'off', 'ON', 1, true, null],
  numberLiteral: [2, 2.0, '2', ' 2 ', 3, true, null, [2], ['2']],
  booleanLiteral: [true, false, 'true', 1, '1', 0, null],
  enum: ['active', 'archived', 'deleted', 'Active', 1, null],
  array: [[], [1, 2], [1, 'x', 3.5], ['1'], 'nope', {}, null, { 0: 1, length: 1 }],
  boundedArray: [[], ['a'], ['a', 'b'], ['a', 'b', 'c'], [1, 2, 3]],
  record: [{}, { a: 1 }, { a: 'x', b: 2, c: 1.5 }, [], [1], 'nope', null, { '': 1, '0': 2 }],
  nullable: [null, 1, 'x', undefined],
  optional: [undefined, 1, null, 'x'],
  nested: [
    { a: { b: [] } },
    { a: { b: [{ c: 'x' }, { c: 1 }, {}] } },
    { a: { b: 'nope' } },
    { a: null },
    { a: { b: [{ c: 'x', extra: true }] }, extra: 1 }
  ],
  recursive: [
    { name: 'root' },
    { name: 'root', children: [{ name: 'a', children: [{ name: 1 }] }] },
    { name: 'root', children: [{}] },
    { children: null }
  ],
  alias: ['abc', 'abcd', 3]
};

let rawCases: Record<string, unknown[]> = {
  union: [
    { type: 'file', path: 'a', size: 1 },
    { type: 'directory', path: 'a' },
    { type: 'directory', path: 'a', size: 'ignored' },
    { type: 'file', path: 'a' },
    { type: 'link', path: 'a' },
    { path: 'a' },
    { type: 1 },
    'file',
    null,
    []
  ],
  multi: [
    { a: 'x', b: 1 },
    {},
    { a: 1, b: 'x', c: 'y' },
    { b: 1, a: 'x', c: true, z: 0 },
    null,
    'x',
    [],
    5
  ]
};

let ir = compile(spec);
let validators = createValidatorFactory(ir);

let vectors = [
  ...Object.entries(cases).flatMap(([name, values]) =>
    values.map(v => ({ method: name, payload: v === undefined ? {} : { value: v } }))
  ),
  ...Object.entries(rawCases).flatMap(([name, values]) =>
    values.map(payload => ({ method: name, payload }))
  )
].map(({ method, payload }) => {
  let input = ir.methods.find(m => m.name == method)!.input;
  if (input.kind != 'ref') throw new Error(`${method} has no named input`);

  let result = validators.methodInput(method).validate(payload);
  return {
    method,
    type: input.name,
    payload: JSON.stringify(payload),
    ...(result.success
      ? { value: JSON.stringify(result.value ?? null) }
      : { issues: result.errors })
  };
});

writeFileSync(output, JSON.stringify({ types: ir.types, cases: vectors }, null, 2) + '\n');
console.log(`wrote ${vectors.length} cases to ${output}`);
