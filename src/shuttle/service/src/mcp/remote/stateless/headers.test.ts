import { describe, expect, it } from 'vitest';
import {
  encodeHeaderValue,
  getStandardHeaders,
  getToolParamHeaders,
  validateToolHeaderAnnotations
} from './headers';

describe('encodeHeaderValue', () => {
  it('keeps plain ASCII values as-is', () => {
    expect(encodeHeaderValue('us-west1')).toBe('us-west1');
  });

  it('base64-encodes values that are unsafe or ambiguous', () => {
    expect(encodeHeaderValue('Hello, 世界')).toBe('=?base64?SGVsbG8sIOS4lueVjA==?=');
    expect(encodeHeaderValue(' padded ')).toBe('=?base64?IHBhZGRlZCA=?=');
    expect(encodeHeaderValue('line1\nline2')).toBe('=?base64?bGluZTEKbGluZTI=?=');
    expect(encodeHeaderValue('=?base64?literal?=')).toBe(
      '=?base64?PT9iYXNlNjQ/bGl0ZXJhbD89?='
    );
  });
});

describe('getStandardHeaders', () => {
  it('adds the protocol version and method to every request', () => {
    expect(getStandardHeaders({ method: 'tools/list' })).toEqual({
      'MCP-Protocol-Version': '2026-07-28',
      'Mcp-Method': 'tools/list'
    });
  });

  it('adds Mcp-Name for named methods', () => {
    expect(
      getStandardHeaders({ method: 'tools/call', params: { name: 'get_weather' } })['Mcp-Name']
    ).toBe('get_weather');

    expect(
      getStandardHeaders({ method: 'resources/read', params: { uri: 'file:///a.json' } })[
        'Mcp-Name'
      ]
    ).toBe('file:///a.json');

    expect(
      getStandardHeaders({ method: 'prompts/get', params: { name: 'résumé' } })['Mcp-Name']
    ).toBe(encodeHeaderValue('résumé'));
  });
});

describe('validateToolHeaderAnnotations', () => {
  it('collects annotations reachable through properties', () => {
    let result = validateToolHeaderAnnotations({
      type: 'object',
      properties: {
        region: { type: 'string', 'x-mcp-header': 'Region' },
        options: {
          type: 'object',
          properties: { dryRun: { type: 'boolean', 'x-mcp-header': 'Dry-Run' } }
        },
        query: { type: 'string' }
      }
    });

    expect(result).toEqual({
      ok: true,
      annotations: [
        { header: 'Region', path: ['region'] },
        { header: 'Dry-Run', path: ['options', 'dryRun'] }
      ]
    });
  });

  it('accepts schemas without annotations and properties named x-mcp-header', () => {
    expect(validateToolHeaderAnnotations(undefined)).toEqual({ ok: true, annotations: [] });

    expect(
      validateToolHeaderAnnotations({
        type: 'object',
        properties: { 'x-mcp-header': { type: 'string' } }
      })
    ).toEqual({ ok: true, annotations: [] });
  });

  it.each([
    ['empty name', { region: { type: 'string', 'x-mcp-header': '' } }],
    ['invalid token', { region: { type: 'string', 'x-mcp-header': 'Bad Header' } }],
    ['number type', { amount: { type: 'number', 'x-mcp-header': 'Amount' } }],
    [
      'duplicate name',
      {
        a: { type: 'string', 'x-mcp-header': 'Region' },
        b: { type: 'string', 'x-mcp-header': 'region' }
      }
    ]
  ])('rejects %s', (_label, properties) => {
    expect(validateToolHeaderAnnotations({ type: 'object', properties }).ok).toBe(false);
  });

  it('rejects annotations behind array or composition keywords', () => {
    expect(
      validateToolHeaderAnnotations({
        type: 'object',
        properties: {
          list: { type: 'array', items: { type: 'string', 'x-mcp-header': 'Item' } }
        }
      }).ok
    ).toBe(false);

    expect(
      validateToolHeaderAnnotations({
        type: 'object',
        oneOf: [{ properties: { a: { type: 'string', 'x-mcp-header': 'A' } } }]
      }).ok
    ).toBe(false);
  });
});

describe('getToolParamHeaders', () => {
  let annotations = [
    { header: 'Region', path: ['region'] },
    { header: 'Dry-Run', path: ['options', 'dryRun'] },
    { header: 'Limit', path: ['limit'] }
  ];

  it('mirrors present primitive values', () => {
    expect(
      getToolParamHeaders(annotations, {
        region: 'eu west',
        options: { dryRun: false },
        limit: 42
      })
    ).toEqual({
      'Mcp-Param-Region': 'eu west',
      'Mcp-Param-Dry-Run': 'false',
      'Mcp-Param-Limit': '42'
    });
  });

  it('omits missing and null values', () => {
    expect(getToolParamHeaders(annotations, { region: null, options: {} })).toEqual({});
    expect(getToolParamHeaders(annotations, undefined)).toEqual({});
  });
});
