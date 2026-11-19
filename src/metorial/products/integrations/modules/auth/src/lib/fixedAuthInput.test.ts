import { describe, expect, it } from 'vitest';
import { omitFixedAuthInput } from './fixedAuthInput';

let schema = {
  type: 'object',
  properties: {
    instanceUrl: { type: 'string', title: 'Instance URL' },
    organization: { type: 'string' }
  },
  required: ['instanceUrl', 'organization']
};

describe('omitFixedAuthInput', () => {
  it('removes fixed keys from properties and required', () => {
    expect(omitFixedAuthInput(schema, { instanceUrl: 'https://github.example.com' })).toEqual({
      type: 'object',
      properties: { organization: { type: 'string' } },
      required: ['organization']
    });
  });

  it('returns the schema unchanged without fixed input', () => {
    expect(omitFixedAuthInput(schema, null)).toBe(schema);
    expect(omitFixedAuthInput(schema, {})).toBe(schema);
  });

  it('leaves schemas without properties alone', () => {
    let empty = { type: 'object' };
    expect(omitFixedAuthInput(empty, { instanceUrl: 'x' })).toBe(empty);
    expect(omitFixedAuthInput(null, { instanceUrl: 'x' })).toBe(null);
  });

  it('does not add required when the schema has none', () => {
    expect(omitFixedAuthInput({ properties: { a: {}, b: {} } }, { a: 'fixed' })).toEqual({
      properties: { b: {} }
    });
  });
});
