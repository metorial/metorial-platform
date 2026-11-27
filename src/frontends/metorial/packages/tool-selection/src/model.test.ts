import { describe, expect, it } from 'vitest';
import { isToolAllowedByFilters } from './matcher';
import {
  allowCategory,
  buildToolIndex,
  checkTools,
  createToolSelection,
  getMissingSelections,
  getSelectedToolKeySet,
  getToolAccessGroup,
  hydrateToolSelection,
  isCategoryDynamicallySelected,
  rejectCategory,
  setToolSelectionMode,
  toToolFilterPayload,
  toToolFilterRules,
  uncheckTools,
  type ToolSelection
} from './model';
import { summarizeToolFilter } from './summary';

let tools = [
  {
    key: 'crm_get',
    name: 'CRM Get',
    tags: { readOnly: true, destructive: false },
    toolCategoryKeys: ['crm']
  },
  {
    key: 'crm_delete',
    name: 'CRM Delete',
    tags: { readOnly: false, destructive: true },
    toolCategoryKeys: ['crm']
  },
  {
    key: 'books_get',
    name: 'Books Get',
    tags: { readOnly: true },
    toolCategoryKeys: ['books']
  },
  {
    key: 'shared_search',
    name: 'Shared Search',
    tags: { readOnly: true },
    toolCategoryKeys: ['crm', 'books']
  },
  { key: 'who_am_i', name: 'Who Am I', tags: { readOnly: true } }
];

let definitions = [
  { key: 'crm', name: 'Zoho CRM', description: 'CRM tools' },
  { key: 'books', name: 'Zoho Books', description: null },
  { key: 'desk', name: 'Zoho Desk' }
];

let index = buildToolIndex(tools, definitions);

// Same provider without the "desk" category, which has no tools in this version.
let populatedIndex = buildToolIndex(
  tools,
  definitions.filter(definition => definition.key !== 'desk')
);

let select = (partial: Partial<ToolSelection>): ToolSelection => ({
  ...createToolSelection('select'),
  ...partial
});

let selected = (selection: ToolSelection, toolIndex = index) =>
  Array.from(getSelectedToolKeySet(selection, toolIndex)).sort();

describe('buildToolIndex', () => {
  it('indexes categories in declared order with multi-membership', () => {
    expect(index.hasCategories).toBe(true);
    expect(index.categories.map(category => category.key)).toEqual(['crm', 'books']);
    expect(index.categoriesByKey.get('crm')?.toolKeys).toEqual([
      'crm_get',
      'crm_delete',
      'shared_search'
    ]);
    expect(index.categoriesByKey.get('books')?.toolKeys).toEqual([
      'books_get',
      'shared_search'
    ]);
    expect(index.categoriesByKey.get('desk')?.toolKeys).toEqual([]);
    expect(index.uncategorizedToolKeys).toEqual(['who_am_i']);
  });

  it('falls back to key-named categories when definitions are missing', () => {
    let fallback = buildToolIndex(tools);

    expect(fallback.categories.map(category => [category.key, category.name])).toEqual([
      ['crm', 'crm'],
      ['books', 'books']
    ]);
    expect(fallback.categories.every(category => !category.isDefined)).toBe(true);
  });

  it('reports no categories when no tool has any', () => {
    let plain = buildToolIndex(
      [
        { key: 'a', name: 'A' },
        { key: 'b', name: 'B' }
      ],
      definitions
    );

    expect(plain.hasCategories).toBe(false);
    expect(plain.categories).toEqual([]);
  });

  it('dedupes category membership', () => {
    let duplicated = buildToolIndex([{ key: 'a', name: 'A', toolCategoryKeys: ['x', 'x'] }]);
    expect(duplicated.toolsByKey.get('a')?.categoryKeys).toEqual(['x']);
  });
});

describe('getToolAccessGroup', () => {
  it('maps tags to access groups', () => {
    expect(getToolAccessGroup({ tags: { destructive: true, readOnly: true } })).toBe(
      'destructive'
    );
    expect(getToolAccessGroup({ tags: { read_only: true } })).toBe('read');
    expect(getToolAccessGroup({ tags: null })).toBe('write');
  });
});

describe('hydrate / serialize', () => {
  it('treats empty and allow-all filters as all tools', () => {
    expect(hydrateToolSelection(null).mode).toBe('all');
    expect(hydrateToolSelection({ type: 'allow_all' }).mode).toBe('all');
    expect(hydrateToolSelection({ type: 'v1.allow_all' }).mode).toBe('all');
    expect(hydrateToolSelection([]).mode).toBe('all');
    expect(hydrateToolSelection({ type: 'filter', filters: [] }).mode).toBe('all');
    expect(toToolFilterRules(createToolSelection('all'))).toBeNull();
  });

  it('round-trips categories, keys and preserved rules', () => {
    let filter = {
      type: 'filter',
      filters: [
        { type: 'tool_categories', keys: ['crm'] },
        { type: 'tool_keys', keys: ['books_get'] },
        { type: 'tool_regex', pattern: '^who' },
        { type: 'prompt_keys', keys: ['p1'] }
      ]
    };
    let selection = hydrateToolSelection(filter);

    expect(selection).toEqual({
      mode: 'select',
      categoryKeys: ['crm'],
      toolKeys: ['books_get'],
      preservedRules: [
        { type: 'tool_regex', pattern: '^who' },
        { type: 'prompt_keys', keys: ['p1'] }
      ]
    });
    expect(toToolFilterRules(selection)).toEqual(filter.filters);
    expect(hydrateToolSelection(toToolFilterRules(selection))).toEqual(selection);
  });

  it('accepts a single rule object and v1 envelopes', () => {
    expect(hydrateToolSelection({ type: 'tool_keys', keys: ['a'] }).toolKeys).toEqual(['a']);
    expect(
      hydrateToolSelection({
        type: 'v1.filter',
        filters: [{ type: 'tool_categories', keys: ['crm'] }]
      }).categoryKeys
    ).toEqual(['crm']);
  });

  it('keeps prompt/resource-only filters as all tools without dropping them', () => {
    let selection = hydrateToolSelection([{ type: 'prompt_regex', pattern: 'x' }]);

    expect(selection.mode).toBe('all');
    expect(toToolFilterRules(selection)).toEqual([{ type: 'prompt_regex', pattern: 'x' }]);
  });

  it('emits tool_keys: [] for an empty selection so it denies all tools', () => {
    expect(toToolFilterRules(select({}))).toEqual([{ type: 'tool_keys', keys: [] }]);
    expect(
      toToolFilterRules(select({ preservedRules: [{ type: 'prompt_keys', keys: [] }] }))
    ).toEqual([
      { type: 'tool_keys', keys: [] },
      { type: 'prompt_keys', keys: [] }
    ]);
  });

  it('only saves tool_keys when categories are not used', () => {
    expect(toToolFilterRules(select({ toolKeys: ['a', 'b'] }))).toEqual([
      { type: 'tool_keys', keys: ['a', 'b'] }
    ]);
  });
});

describe('toToolFilterPayload', () => {
  it('sends null while tools are unrestricted', () => {
    expect(toToolFilterPayload(createToolSelection('all'), { emptySelection: 'none' })).toBe(
      null
    );
  });

  it('lets the caller decide what an empty selection sends', () => {
    expect(toToolFilterPayload(select({}), { emptySelection: 'all' })).toBe(null);
    expect(toToolFilterPayload(select({}), { emptySelection: 'none' })).toEqual([]);
  });

  it('unwraps a single rule and keeps several rules as a list', () => {
    expect(
      toToolFilterPayload(select({ toolKeys: ['a'] }), { emptySelection: 'all' })
    ).toEqual({ type: 'tool_keys', keys: ['a'] });
    expect(
      toToolFilterPayload(select({ categoryKeys: ['crm'], toolKeys: ['who_am_i'] }), {
        emptySelection: 'all'
      })
    ).toEqual([
      { type: 'tool_categories', keys: ['crm'] },
      { type: 'tool_keys', keys: ['who_am_i'] }
    ]);
  });
});

describe('transitions', () => {
  it('allowCategory stores a dynamic category key', () => {
    let next = allowCategory(select({}), index, 'crm');

    expect(next.categoryKeys).toEqual(['crm']);
    expect(next.toolKeys).toEqual([]);
    expect(selected(next)).toEqual(['crm_delete', 'crm_get', 'shared_search']);
    expect(toToolFilterRules(next)).toEqual([{ type: 'tool_categories', keys: ['crm'] }]);
  });

  it('allowCategory removes redundant explicit keys', () => {
    let next = allowCategory(select({ toolKeys: ['crm_get', 'books_get'] }), index, 'crm');
    expect(next.toolKeys).toEqual(['books_get']);
  });

  it('unchecking a tool degrades every selected category that contains it', () => {
    let start = select({ categoryKeys: ['crm', 'books'] });
    let next = uncheckTools(start, index, ['shared_search']);

    expect(next.categoryKeys).toEqual([]);
    expect(next.toolKeys.sort()).toEqual(['books_get', 'crm_delete', 'crm_get']);
  });

  it('keeps untouched categories following new tools when leaving "all tools"', () => {
    let all = createToolSelection('all');

    expect(isCategoryDynamicallySelected(all, 'crm')).toBe(true);
    expect(isCategoryDynamicallySelected(all, 'books')).toBe(true);

    // Only the edited category stops following new tools; desk has no tools to follow.
    let next = uncheckTools(all, index, ['crm_delete']);

    expect(isCategoryDynamicallySelected(next, 'crm')).toBe(false);
    expect(isCategoryDynamicallySelected(next, 'books')).toBe(true);
    expect(isCategoryDynamicallySelected(next, 'desk')).toBe(false);
  });

  it('unchecking leaves unaffected categories dynamic and drops keys they cover', () => {
    let start = select({ categoryKeys: ['crm', 'books'] });
    let next = uncheckTools(start, index, ['crm_delete']);

    expect(next.categoryKeys).toEqual(['books']);
    expect(next.toolKeys).toEqual(['crm_get']);
    expect(selected(next)).toEqual(['books_get', 'crm_get', 'shared_search']);
  });

  it('rejectCategory removes the category and its tools from other categories', () => {
    let start = select({ categoryKeys: ['crm', 'books'] });
    let next = rejectCategory(start, index, 'crm');

    expect(next.categoryKeys).toEqual([]);
    expect(next.toolKeys).toEqual(['books_get']);
  });

  it('rejectCategory matches unchecking every tool of the category', () => {
    let starts = [
      createToolSelection('all'),
      select({}),
      select({ categoryKeys: ['crm', 'books'] }),
      select({ categoryKeys: ['books'], toolKeys: ['crm_get', 'who_am_i'] }),
      select({
        toolKeys: ['shared_search'],
        preservedRules: [{ type: 'tool_regex', pattern: 'x' }]
      })
    ];

    for (let start of starts) {
      for (let category of index.categories) {
        for (let opts of [{}, { collapseToAll: false }]) {
          expect(rejectCategory(start, index, category.key, opts)).toEqual(
            uncheckTools(start, index, category.toolKeys, opts)
          );
        }
      }
    }
  });

  it('access-group style toggles only add or remove explicit keys', () => {
    let readKeys = index.tools.filter(tool => tool.accessGroup === 'read').map(t => t.key);
    let next = checkTools(select({}), index, readKeys);

    expect(next.categoryKeys).toEqual([]);
    expect(next.toolKeys).toEqual(readKeys);

    let removed = uncheckTools(next, index, readKeys);
    expect(removed.toolKeys).toEqual([]);
  });

  it('checkTools skips tools already covered by a dynamic category', () => {
    let next = checkTools(select({ categoryKeys: ['crm'] }), index, ['crm_get', 'books_get']);
    expect(next.toolKeys).toEqual(['books_get']);
  });

  it('collapses to all when everything is selected and every category has tools', () => {
    let next = allowCategory(select({ categoryKeys: ['crm'] }), populatedIndex, 'books');
    expect(next.mode).toBe('select');

    let all = checkTools(next, populatedIndex, ['who_am_i']);
    expect(all).toEqual(createToolSelection('all'));
  });

  it('does not collapse while a defined category has no tools in this version', () => {
    let next = checkTools(select({ categoryKeys: ['crm', 'books'] }), index, ['who_am_i']);

    expect(next).toEqual(select({ categoryKeys: ['crm', 'books'], toolKeys: ['who_am_i'] }));
    expect(selected(next)).toHaveLength(index.tools.length);
  });

  it('keeps collapsing for providers without categories', () => {
    let plain = buildToolIndex([
      { key: 'a', name: 'A' },
      { key: 'b', name: 'B' }
    ]);

    expect(checkTools(select({ toolKeys: ['a'] }), plain, ['b'])).toEqual(
      createToolSelection('all')
    );
  });

  it('does not collapse when collapseToAll is false', () => {
    let next = checkTools(
      select({ categoryKeys: ['crm', 'books'] }),
      populatedIndex,
      ['who_am_i'],
      { collapseToAll: false }
    );

    expect(next.mode).toBe('select');
    expect(selected(next, populatedIndex)).toHaveLength(populatedIndex.tools.length);
  });

  it('collapse keeps non-tool preserved rules', () => {
    let next = checkTools(
      select({
        categoryKeys: ['crm', 'books'],
        preservedRules: [
          { type: 'tool_regex', pattern: 'zzz' },
          { type: 'resource_uris', uris: ['a'] }
        ]
      }),
      populatedIndex,
      ['who_am_i']
    );

    expect(next).toEqual(createToolSelection('all', [{ type: 'resource_uris', uris: ['a'] }]));
  });

  it('unchecking from all keeps untouched categories dynamic', () => {
    let next = uncheckTools(createToolSelection('all'), index, ['crm_delete']);

    expect(next.mode).toBe('select');
    expect(next.categoryKeys).toEqual(['books']);
    expect(next.toolKeys.sort()).toEqual(['crm_get', 'who_am_i']);
    expect(selected(next)).toEqual(['books_get', 'crm_get', 'shared_search', 'who_am_i']);
  });

  it('unchecking from all without categories yields explicit keys like before', () => {
    let plain = buildToolIndex([
      { key: 'a', name: 'A' },
      { key: 'b', name: 'B' }
    ]);
    let next = uncheckTools(createToolSelection('all'), plain, ['a']);

    expect(next).toEqual(select({ toolKeys: ['b'] }));
    expect(toToolFilterRules(next)).toEqual([{ type: 'tool_keys', keys: ['b'] }]);
  });

  it('rejectCategory from all selects everything else', () => {
    let next = rejectCategory(createToolSelection('all'), index, 'books');

    expect(next.categoryKeys).toEqual([]);
    expect(next.toolKeys.sort()).toEqual(['crm_delete', 'crm_get', 'who_am_i']);
  });

  it('custom regex rules select matching tools', () => {
    let next = select({ preservedRules: [{ type: 'tool_regex', pattern: '^who' }] });

    expect(selected(next)).toEqual(['who_am_i']);
    expect(toToolFilterRules(next)).toEqual([{ type: 'tool_regex', pattern: '^who' }]);
  });

  it('setToolSelectionMode switches between all and an empty selection', () => {
    let next = setToolSelectionMode(createToolSelection('all'), 'select');

    expect(next).toEqual(select({}));
    expect(setToolSelectionMode(select({ toolKeys: ['a'] }), 'all')).toEqual(
      createToolSelection('all')
    );
  });

  it('reports selections missing in this version', () => {
    let missing = getMissingSelections(
      select({ categoryKeys: ['crm', 'desk', 'gone'], toolKeys: ['books_get', 'old_tool'] }),
      index
    );

    expect(missing).toEqual({ categoryKeys: ['desk', 'gone'], toolKeys: ['old_tool'] });
  });
});

describe('summarizeToolFilter', () => {
  it('keeps the pre-existing wording without categories', () => {
    expect(summarizeToolFilter(null)).toBe('All tools');
    expect(summarizeToolFilter({ type: 'allow_all' })).toBe('All tools');
    expect(
      summarizeToolFilter({ type: 'filter', filters: [{ type: 'tool_keys', keys: [] }] })
    ).toBe('No tools');
    expect(
      summarizeToolFilter({ type: 'filter', filters: [{ type: 'tool_keys', keys: ['a'] }] })
    ).toBe('1 selected');
    expect(
      summarizeToolFilter({
        type: 'filter',
        filters: [{ type: 'tool_keys', keys: ['a', 'b'] }]
      })
    ).toBe('2 selected');
    expect(
      summarizeToolFilter({
        type: 'filter',
        filters: [
          { type: 'tool_keys', keys: ['a'] },
          { type: 'tool_regex', pattern: 'x' }
        ]
      })
    ).toBe('Custom + 1 selected');
  });

  it('lists category names with extra tools', () => {
    let filter = {
      type: 'filter',
      filters: [
        { type: 'tool_categories', keys: ['crm', 'books', 'desk'] },
        { type: 'tool_keys', keys: ['a', 'b', 'c'] }
      ]
    };

    expect(
      summarizeToolFilter(filter, { categoryNames: { crm: 'CRM', books: 'Books' } })
    ).toBe('CRM, Books +1 more + 3 tools');
    expect(
      summarizeToolFilter({
        type: 'filter',
        filters: [{ type: 'tool_categories', keys: ['crm'] }]
      })
    ).toBe('crm');
  });
});

describe('isToolAllowedByFilters', () => {
  let crmTool = { key: 'crm_get', toolCategoryKeys: ['crm'] };
  let booksTool = { key: 'books_get', toolCategoryKeys: ['books'] };
  let plainTool = { key: 'who_am_i' };

  it('allows everything without restricting layers', () => {
    expect(isToolAllowedByFilters(plainTool, null)).toBe(true);
    expect(isToolAllowedByFilters(plainTool, [{ type: 'v1.allow_all' }])).toBe(true);
    expect(
      isToolAllowedByFilters(plainTool, [
        { type: 'filter', filters: [{ type: 'prompt_keys', keys: ['x'] }] }
      ])
    ).toBe(true);
  });

  it('matches tool_categories and ORs rules within a layer', () => {
    let filters = [
      {
        type: 'v1.filter',
        filters: [
          { type: 'tool_categories', keys: ['crm'] },
          { type: 'tool_keys', keys: ['who_am_i'] }
        ]
      }
    ];

    expect(isToolAllowedByFilters(crmTool, filters)).toBe(true);
    expect(isToolAllowedByFilters(plainTool, filters)).toBe(true);
    expect(isToolAllowedByFilters(booksTool, filters)).toBe(false);
  });

  it('ANDs layers', () => {
    let filters = [
      { type: 'filter', filters: [{ type: 'tool_categories', keys: ['crm', 'books'] }] },
      { type: 'filter', filters: [{ type: 'tool_keys', keys: ['books_get'] }] }
    ];

    expect(isToolAllowedByFilters(booksTool, filters)).toBe(true);
    expect(isToolAllowedByFilters(crmTool, filters)).toBe(false);
  });

  it('treats bare rule arrays as one OR layer', () => {
    let filters = [
      { type: 'tool_categories', keys: ['crm'] },
      { type: 'tool_keys', keys: ['books_get'] }
    ];

    expect(isToolAllowedByFilters(crmTool, filters)).toBe(true);
    expect(isToolAllowedByFilters(booksTool, filters)).toBe(true);
    expect(isToolAllowedByFilters(plainTool, filters)).toBe(false);
  });

  it('matches nothing for unknown categories or uncategorized tools', () => {
    let filters = [{ type: 'filter', filters: [{ type: 'tool_categories', keys: ['nope'] }] }];

    expect(isToolAllowedByFilters(crmTool, filters)).toBe(false);
    expect(isToolAllowedByFilters(plainTool, filters)).toBe(false);
  });

  it('does not substring-match keys that are not an array', () => {
    let malformedKeys = 'crm_get_all, crm' as unknown as string[];

    expect(isToolAllowedByFilters(crmTool, [{ type: 'tool_keys', keys: malformedKeys }])).toBe(
      false
    );
    expect(
      isToolAllowedByFilters(crmTool, [{ type: 'tool_categories', keys: malformedKeys }])
    ).toBe(false);
  });

  it('denies all with empty tool_keys', () => {
    expect(
      isToolAllowedByFilters(plainTool, [
        { type: 'filter', filters: [{ type: 'tool_keys', keys: [] }] }
      ])
    ).toBe(false);
  });
});
