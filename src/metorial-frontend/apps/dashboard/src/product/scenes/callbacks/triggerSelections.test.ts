import { describe, expect, it } from 'vitest';
import { unusedSelections } from './triggerSelections';

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
