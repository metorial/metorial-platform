import { describe, expect, test } from 'vitest';
import {
  applySessionProviderNameTemplate,
  buildBaseSessionProviderNameTemplate,
  buildFallbackSessionProviderNameTemplate,
  parseNameFromSessionProviderTemplates
} from './sessionProviderNameTemplate';

describe('session provider name templates', () => {
  test('builds a base template from provider names with underscores', () => {
    expect(buildBaseSessionProviderNameTemplate('MCP Server With Underscores')).toBe(
      'mcp_server_with_underscores_$'
    );
  });

  test('builds a fallback template with a suffix', () => {
    expect(buildFallbackSessionProviderNameTemplate('Calculator', '2543')).toBe(
      'calculator_$_2543'
    );
  });

  test('applies templates without changing tool names with underscores', () => {
    expect(applySessionProviderNameTemplate('calculator_$', 'add_numbers')).toBe(
      'calculator_add_numbers'
    );
  });

  test('parses the original name from a base template', () => {
    let provider = { id: 'sp_1', nameTemplate: 'calculator_$' };

    expect(
      parseNameFromSessionProviderTemplates('calculator_add_numbers', [provider])
    ).toEqual({
      provider,
      originalName: 'add_numbers',
      finalName: 'calculator_add_numbers'
    });
  });

  test('parses the original name from a fallback suffix template', () => {
    let provider = { id: 'sp_1', nameTemplate: 'calculator_$_2543' };

    expect(
      parseNameFromSessionProviderTemplates('calculator_add_numbers_2543', [provider])
    ).toEqual({
      provider,
      originalName: 'add_numbers',
      finalName: 'calculator_add_numbers_2543'
    });
  });

  test('uses the most specific matching template', () => {
    let base = { id: 'sp_1', nameTemplate: 'calculator_$' };
    let fallback = { id: 'sp_2', nameTemplate: 'calculator_$_2543' };

    expect(
      parseNameFromSessionProviderTemplates('calculator_add_numbers_2543', [base, fallback])
    ).toEqual({
      provider: fallback,
      originalName: 'add_numbers',
      finalName: 'calculator_add_numbers_2543'
    });
  });

  test('throws when two templates are equally specific', () => {
    expect(() =>
      parseNameFromSessionProviderTemplates('calculator_add_numbers', [
        { id: 'sp_1', nameTemplate: 'calculator_$' },
        { id: 'sp_2', nameTemplate: 'calculator_$' }
      ])
    ).toThrow('Ambiguous session provider name');
  });

  test('throws for invalid templates', () => {
    expect(() => applySessionProviderNameTemplate('calculator', 'add_numbers')).toThrow(
      'Invalid session provider name template'
    );
  });
});
