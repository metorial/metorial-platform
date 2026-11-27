import { describe, expect, it } from 'vitest';
import {
  hasSelectionOptions,
  listDescription,
  parseGroupValues
} from './triggerSelectionSchema';

describe('selection options in a field schema', () => {
  it('treats a field marked with options as having options', () => {
    expect(hasSelectionOptions({ type: 'string', 'x-metorial-options': true })).toBe(true);
  });

  it('ignores a missing, disabled or malformed marker', () => {
    expect(hasSelectionOptions({ type: 'string' })).toBe(false);
    expect(hasSelectionOptions({ type: 'string', 'x-metorial-options': false })).toBe(false);
    expect(hasSelectionOptions({ type: 'string', 'x-metorial-options': 'true' })).toBe(false);
  });
});

describe('group form values', () => {
  let schema = {
    properties: {
      spreadsheetId: { type: 'string' },
      sheetIds: { type: 'array', items: { type: 'string' } },
      limit: { type: 'integer' },
      includeHidden: { type: 'boolean' },
      filter: { type: 'object' }
    }
  };

  it('parses entered values and leaves empty fields out', () => {
    expect(
      parseGroupValues(schema, {
        spreadsheetId: ' sheet_1 ',
        sheetIds: ['', ' tab_1 '],
        limit: '10',
        includeHidden: false,
        filter: '{"a":1}'
      })
    ).toEqual({
      selection: {
        spreadsheetId: 'sheet_1',
        sheetIds: ['tab_1'],
        limit: 10,
        includeHidden: false,
        filter: { a: 1 }
      },
      errors: {}
    });

    expect(
      parseGroupValues(schema, { spreadsheetId: '  ', sheetIds: [''], limit: '', filter: '' })
    ).toEqual({ selection: {}, errors: {} });
    expect(parseGroupValues(schema, undefined)).toEqual({ selection: {}, errors: {} });
  });

  it('reports values that cannot be parsed and keeps the rest', () => {
    expect(
      parseGroupValues(schema, { spreadsheetId: 'sheet_1', limit: 'ten', filter: '{' })
    ).toEqual({
      selection: { spreadsheetId: 'sheet_1' },
      errors: { limit: 'Enter a number', filter: 'Enter valid JSON' }
    });
  });
});

describe('list field description', () => {
  it('names one item after the schema title', () => {
    expect(listDescription('sheetIds', { title: 'Tabs' })).toBe(
      'Enter one tab per box. Use Add, or press Enter, for another.'
    );
    expect(listDescription('folderIds', { description: 'Folders to watch.' })).toBe(
      'Enter one folder ID per box. Use Add, or press Enter, for another. Folders to watch.'
    );
  });
});
