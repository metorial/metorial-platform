import { describe, expect, it } from 'vitest';
import { formValuesAfterLoad, unusedSelections } from './triggerSelections';

let triggerGroups = [{ key: 'folder_events' }];
let selections = {
  folder_events: { folderIds: ['a'] },
  renamed_group: { ids: ['x'] },
  mistyped: {}
};

describe('unused trigger group selections', () => {
  it('lists the stored selections that match no trigger group', () => {
    expect(unusedSelections(triggerGroups, selections)).toEqual({
      renamed_group: { ids: ['x'] },
      mistyped: {}
    });
    expect(unusedSelections(triggerGroups, null)).toEqual({});
  });

  it('drops the ones removed in the form and keeps the rest as stored', () => {
    expect(unusedSelections(triggerGroups, selections, ['mistyped'])).toEqual({
      renamed_group: { ids: ['x'] }
    });
    expect(unusedSelections(triggerGroups, selections, ['mistyped', 'renamed_group'])).toEqual(
      {}
    );
  });
});

describe('form values after trigger groups load', () => {
  let folders = {
    key: 'folder_events',
    selectionSchema: {
      properties: { folderIds: { type: 'array', items: { type: 'string' } } }
    }
  };
  let sheets = {
    key: 'sheet_events',
    selectionSchema: { properties: { sheetId: { type: 'string' } } }
  };
  let stored = { folder_events: { folderIds: ['a'] } };

  type Group = { key: string; selectionSchema: Record<string, any> };

  let load = (
    triggerGroups: Group[],
    selections: Record<string, Record<string, any>> | null,
    current: Record<string, Record<string, any>>,
    previousGroups: Group[] | null,
    previousSelections = selections
  ) =>
    formValuesAfterLoad({
      triggerGroups,
      selections,
      current,
      previous: previousGroups && {
        selectionsKey: JSON.stringify(previousSelections),
        schemaKeys: Object.fromEntries(
          previousGroups.map(group => [group.key, JSON.stringify(group.selectionSchema)])
        )
      }
    });

  it('fills the form from the stored selections on the first load', () => {
    expect(load([folders], stored, {}, null)).toEqual({ folder_events: { folderIds: ['a'] } });
  });

  it('keeps edits when a refresh only adds a trigger group', () => {
    let edited = { folder_events: { folderIds: ['a', 'typing'] } };

    expect(load([folders, sheets], stored, edited, [folders])).toEqual({
      folder_events: { folderIds: ['a', 'typing'] },
      sheet_events: { sheetId: '' }
    });
  });

  it('keeps edits of a trigger group that disappears for a refresh', () => {
    let edited = { folder_events: { folderIds: ['typing'] } };
    let during = load([], stored, edited, [folders]);

    expect(load([folders], stored, during, [folders])).toEqual(edited);
  });

  it('starts over when the stored selections change', () => {
    let edited = { folder_events: { folderIds: ['typing'] } };
    let saved = { folder_events: { folderIds: ['b'] } };

    expect(load([folders], saved, edited, [folders], stored)).toEqual({
      folder_events: { folderIds: ['b'] }
    });
  });

  it('starts a trigger group over when its schema changes', () => {
    let edited = { folder_events: { folderIds: ['typing'] } };
    let changed = {
      ...folders,
      selectionSchema: { properties: { folderId: { type: 'string' } } }
    };

    expect(load([changed], stored, edited, [folders])).toEqual({
      folder_events: { folderId: '' }
    });
  });
});
