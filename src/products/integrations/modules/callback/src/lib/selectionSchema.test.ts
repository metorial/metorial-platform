import { describe, expect, it } from 'vitest';
import { assertSelectionsMatchTriggerGroups } from './selectionSchema';

let group = (key: string, selectionSchema: Record<string, any>) => ({
  key,
  name: key,
  description: null,
  selectionSchema,
  status: 'selection_required' as const
});

let instances = [
  { selectableTriggerGroups: null },
  {
    selectableTriggerGroups: [
      group('folder_events', {
        type: 'object',
        required: ['folderIds'],
        properties: {
          folderIds: { type: 'array', minItems: 1, items: { type: 'string', minLength: 1 } }
        }
      }),
      group('row_observations', {
        type: 'object',
        additionalProperties: false,
        properties: { sheetId: { type: 'integer', minimum: 0 } }
      })
    ]
  }
];

let check =
  (selections: Record<string, Record<string, any>>, from = instances) =>
  () =>
    assertSelectionsMatchTriggerGroups(selections, from);

describe('assertSelectionsMatchTriggerGroups', () => {
  it('accepts selections that match their group schema', () => {
    expect(
      check({ folder_events: { folderIds: ['a'] }, row_observations: { sheetId: 0 } })
    ).not.toThrow();
  });

  it('rejects unknown trigger groups once an instance has reported its groups', () => {
    expect(check({ unknown: {} })).toThrow('Unknown trigger group: unknown');
    expect(check({ unknown: {} }, [{ selectableTriggerGroups: [] }])).toThrow(
      'Unknown trigger group: unknown'
    );
  });

  it('lets a stored selection for an unknown trigger group through unchanged', () => {
    let stored = { renamed: { ids: ['a', 'b'], mode: 'all' } };
    let checkStored = (selections: Record<string, Record<string, any>>) => () =>
      assertSelectionsMatchTriggerGroups(selections, instances, stored);

    expect(
      checkStored({ renamed: { mode: 'all', ids: ['a', 'b'] }, row_observations: {} })
    ).not.toThrow();
    expect(checkStored({ renamed: { ids: ['a'], mode: 'all' } })).toThrow(
      'Unknown trigger group: renamed'
    );
    expect(checkStored({ ...stored, mistyped: {} })).toThrow(
      'Unknown trigger group: mistyped'
    );
  });

  it('still validates a stored selection whose trigger group is known', () => {
    let stored = { folder_events: { folderIds: [] } };

    expect(() => assertSelectionsMatchTriggerGroups(stored, instances, stored)).toThrow(
      'folder_events.folderIds'
    );
  });

  it('accepts anything before any instance has reported its groups', () => {
    expect(check({ unknown: {} }, [{ selectableTriggerGroups: null }])).not.toThrow();
  });

  it('reports the first schema violation with its path', () => {
    expect(check({ folder_events: { folderIds: [''] } })).toThrow('folder_events.folderIds.0');
    expect(check({ row_observations: { sheetId: 1.5 } })).toThrow('row_observations.sheetId');
    expect(check({ row_observations: { extra: 1 } })).toThrow('row_observations');
  });
});
