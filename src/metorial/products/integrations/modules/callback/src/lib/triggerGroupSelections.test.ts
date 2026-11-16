import { describe, expect, it } from 'vitest';
import { parseTriggerGroupSelections } from './triggerGroupSelections';

let parse = (value: unknown) => () => parseTriggerGroupSelections(value);

describe('trigger group selections', () => {
  it('keeps omitted selections unchanged and clears null or empty ones', () => {
    expect(parseTriggerGroupSelections(undefined)).toBeUndefined();
    expect(parseTriggerGroupSelections(null)).toBeNull();
    expect(parseTriggerGroupSelections({})).toBeNull();
  });

  it('preserves resource selections and nested JSON', () => {
    let selections = {
      'spreadsheet-changes': { spreadsheetId: 'sheet-1', options: { columns: ['A', 'B'] } }
    };

    expect(parseTriggerGroupSelections(selections)).toEqual(selections);
  });

  it.each([[], 'sheet-1', { group: null }, { group: [] }, { group: 'sheet-1' }])(
    'rejects non-object selection input: %j',
    selections => {
      expect(parse(selections)).toThrow();
    }
  );

  it('rejects reserved keys without changing object prototypes', () => {
    let selections = JSON.parse('{"__proto__":{"spreadsheetId":"sheet-1"}}');

    expect(parse(selections)).toThrow();
    expect(parse({ group: { constructor: {} } })).toThrow();
    expect(Object.prototype).not.toHaveProperty('spreadsheetId');
  });

  it('bounds group count, key size and encoded bytes', () => {
    let tooMany = Object.fromEntries(Array.from({ length: 65 }, (_, i) => [`group-${i}`, {}]));

    expect(parse(tooMany)).toThrow('at most 64 object selections');
    expect(parse({ ['x'.repeat(129)]: {} })).toThrow();
    expect(parse({ group: { id: '💾'.repeat(17000) } })).toThrow();
  });

  it('rejects values nested beyond the depth limit', () => {
    let nest = (levels: number) => {
      let value: Record<string, any> = {};
      for (let i = 0; i < levels; i++) value = { nested: value };
      return value;
    };

    expect(parse({ group: nest(14) })).not.toThrow();
    expect(parse({ group: nest(18) })).toThrow('nesting up to 16 levels');
    expect(parse({ group: { list: [[nest(18)]] } })).toThrow();
  });
});
