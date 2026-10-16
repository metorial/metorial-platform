import { Flex, OptionToggle, Text } from '@metorial/ui';
import type { ToolCategoryDefinition, ToolSelection, ToolSelectionToolInput } from './model';
import { ToolSelectionEditor } from './ToolSelectionSections';

export type ToolAccessMode = 'all' | 'select' | 'none';

export type ToolAccessEditorProps = {
  title: string;
  description: string;
  emptyText: string;
  allowNoAccess?: boolean;
  mode: ToolAccessMode;
  onModeChange: (mode: ToolAccessMode) => void;
  tools: ToolSelectionToolInput[];
  categories?: ToolCategoryDefinition[] | null;
  selection: ToolSelection;
  onSelectionChange: (selection: ToolSelection) => void;
};

/**
 * "Allow all tools" / "Select tools" (and optionally "No access") switch with the tool picker
 * for the "Select tools" mode. Selecting every tool keeps the explicit selection.
 */
export let ToolAccessEditor = (p: ToolAccessEditorProps) => {
  let modeItems = [
    { id: 'all', label: 'Allow all tools' },
    { id: 'select', label: 'Select tools' },
    ...(p.allowNoAccess ? [{ id: 'none', label: 'No access' }] : [])
  ];

  return (
    <Flex direction="column" gap={12}>
      <div>
        <Text size="2" weight="medium">
          {p.title}
        </Text>
        <Text size="1" color="gray600">
          {p.description}
        </Text>
      </div>

      <OptionToggle
        label="Tool access mode"
        hideLabel
        fullWidth
        size="2"
        value={p.mode}
        onChange={value => {
          if (value === 'all' || value === 'select' || value === 'none') p.onModeChange(value);
        }}
        items={modeItems}
      />

      {p.mode === 'select' && p.tools.length === 0 ? (
        <Text size="1" color="gray600">
          {p.emptyText}
        </Text>
      ) : null}

      {p.mode === 'select' && p.tools.length > 0 ? (
        <ToolSelectionEditor
          tools={p.tools}
          categories={p.categories}
          value={p.selection}
          onChange={p.onSelectionChange}
          collapseToAll={false}
        />
      ) : null}
    </Flex>
  );
};
