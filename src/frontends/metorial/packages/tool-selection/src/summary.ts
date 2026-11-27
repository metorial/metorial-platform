import { hydrateToolSelection } from './model';
import { isToolScopedRuleType } from './shared';

let MAX_CATEGORY_NAMES = 2;

let pluralize = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/**
 * Short human summary of a stored tool filter, e.g. "All tools", "3 selected",
 * "CRM, Books + 3 tools". Filters without category rules keep the pre-existing wording.
 * Category names fall back to the category key.
 */
export let summarizeToolFilter = (
  filter: unknown,
  opts: { categoryNames?: Record<string, string> } = {}
) => {
  let selection = hydrateToolSelection(filter);
  if (selection.mode === 'all') return 'All tools';

  let toolCount = selection.toolKeys.length;
  let hasCustomRules = selection.preservedRules.some(rule => isToolScopedRuleType(rule.type));

  if (selection.categoryKeys.length === 0) {
    if (hasCustomRules && toolCount > 0) return `Custom + ${toolCount} selected`;
    if (hasCustomRules) return 'Custom filter';
    if (toolCount === 0) return 'No tools';
    if (toolCount === 1) return '1 selected';
    return `${toolCount} selected`;
  }

  let names = selection.categoryKeys.map(key => opts.categoryNames?.[key] ?? key);
  let label = names.slice(0, MAX_CATEGORY_NAMES).join(', ');
  let hiddenCategories = names.length - MAX_CATEGORY_NAMES;

  if (hiddenCategories > 0) label += ` +${hiddenCategories} more`;
  if (toolCount > 0) label += ` + ${pluralize(toolCount, 'tool')}`;
  if (hasCustomRules) label += ' + custom';

  return label;
};

export let toolFilterHasCategories = (filter: unknown) =>
  hydrateToolSelection(filter).categoryKeys.length > 0;
