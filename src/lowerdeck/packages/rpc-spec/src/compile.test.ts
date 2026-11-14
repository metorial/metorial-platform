import { describe, expect, test } from 'vitest';
import * as t from './builders';
import { compile } from './compile';
import bucket from './fixtures/bucket';
import { error, method, service } from './spec';

let withError = (data: Record<string, t.Type<any>>) =>
  service({
    name: 'errors',
    go: { package: 'errorsrpc' },
    ts: { client: 'ErrorsClient' },
    methods: {
      get: method({
        input: t.void(),
        output: t.void(),
        errors: [error({ status: 400, code: 'nope', message: 'Nope.', data })]
      })
    }
  });

describe('compile', () => {
  test('carries idempotent: false into the IR', () => {
    let ir = compile(bucket);
    let byName = Object.fromEntries(ir.methods.map(m => [m.name, m]));

    expect(byName['bucket:files:put']!.idempotent).toBe(false);
    expect('idempotent' in byName['bucket:get']!).toBe(false);
  });

  test('allows the standard string error fields as data', () => {
    let ir = compile(withError({ reason: t.string(), hint: t.string().optional() }));
    expect(ir.errors.nope!.data.map(field => field.name)).toEqual(['reason', 'hint']);
  });

  test('rejects reserved and non-string standard error fields', () => {
    expect(() => compile(withError({ entity: t.string() }))).toThrow(
      /entity is a reserved error field/
    );
    expect(() => compile(withError({ reason: t.int() }))).toThrow(
      /reason is a standard error field/
    );
  });
});
