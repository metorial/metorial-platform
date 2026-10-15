import { useMemo } from 'react';
import {
  allowCategory,
  buildToolIndex,
  getCustomRuleToolKeySet,
  getMissingSelections,
  getSelectedToolKeySet,
  isCategoryDynamicallySelected,
  rejectCategory,
  setToolsChecked,
  type ToolCategoryDefinition,
  type ToolSelection,
  type ToolSelectionToolInput
} from './model';

export type UseToolSelectionInput = {
  tools: ToolSelectionToolInput[];
  categories?: ToolCategoryDefinition[] | null;
  value: ToolSelection;
  onChange: (value: ToolSelection) => void;
  /** Collapse back to "all tools" once everything is selected. Defaults to true. */
  collapseToAll?: boolean;
};

export let useToolSelection = ({
  tools,
  categories,
  value,
  onChange,
  collapseToAll = true
}: UseToolSelectionInput) => {
  let index = useMemo(() => buildToolIndex(tools, categories), [tools, categories]);
  let selectedToolKeys = useMemo(() => getSelectedToolKeySet(value, index), [value, index]);
  let customRuleToolKeys = useMemo(
    () => getCustomRuleToolKeySet(value, index),
    [value, index]
  );
  let missing = useMemo(() => getMissingSelections(value, index), [value, index]);
  let opts = { collapseToAll };

  return {
    index,
    value,
    selectedToolKeys,
    customRuleToolKeys,
    missing,
    /**
     * True when the category picks up tools added to it later: every category does while all
     * tools are allowed, otherwise only categories stored as a dynamic rule.
     */
    isCategoryDynamic: (categoryKey: string) =>
      isCategoryDynamicallySelected(value, categoryKey),
    setToolsChecked: (toolKeys: string[], checked: boolean) =>
      onChange(setToolsChecked(value, index, toolKeys, checked, opts)),
    allowCategory: (categoryKey: string) =>
      onChange(allowCategory(value, index, categoryKey, opts)),
    rejectCategory: (categoryKey: string) =>
      onChange(rejectCategory(value, index, categoryKey, opts))
  };
};

export type ToolSelectionState = ReturnType<typeof useToolSelection>;
