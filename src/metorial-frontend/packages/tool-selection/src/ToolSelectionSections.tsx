import { Button, Callout, Checkbox, Flex, OptionToggle, Text, theme } from '@metorial/ui';
import { RiArrowDownSLine } from '@remixicon/react';
import { useState, type ReactNode } from 'react';
import styled from 'styled-components';
import { getSectionMode, type ToolSectionMode } from './model';
import {
  useToolSelection,
  type ToolSelectionState,
  type UseToolSelectionInput
} from './useToolSelection';

export type ToolSelectionGroupBy = 'category' | 'access';

let toolPermissionModeItems: { id: ToolSectionMode; label: string }[] = [
  { id: 'allow', label: 'Allow' },
  { id: 'reject', label: 'Reject' },
  { id: 'mixed', label: 'Mixed' }
];

let groupByItems: { id: ToolSelectionGroupBy; label: string }[] = [
  { id: 'category', label: 'Category' },
  { id: 'access', label: 'Access' }
];

type ToolSection = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  toolKeys: string[];
  mode: ToolSectionMode;
  onAllow: () => void;
  onReject: () => void;
};

let getAccessSections = (state: ToolSelectionState): ToolSection[] =>
  [
    { id: 'access:read', group: 'read', title: 'Read-Only Tools' },
    { id: 'access:write', group: 'write', title: 'Write Tools' },
    { id: 'access:destructive', group: 'destructive', title: 'Destructive Tools' }
  ].map(section => {
    let toolKeys = state.index.tools
      .filter(tool => tool.accessGroup === section.group)
      .map(tool => tool.key);

    return {
      id: section.id,
      title: section.title,
      description: null,
      imageUrl: null,
      toolKeys,
      mode: getSectionMode(toolKeys, state.selectedToolKeys),
      onAllow: () => state.setToolsChecked(toolKeys, true),
      onReject: () => state.setToolsChecked(toolKeys, false)
    };
  });

let getCategorySections = (state: ToolSelectionState): ToolSection[] => {
  let sections: ToolSection[] = state.index.categories.map(category => ({
    id: `category:${category.key}`,
    title: category.name,
    description: category.description,
    imageUrl: category.imageUrl,
    toolKeys: category.toolKeys,
    mode: state.isCategoryDynamic(category.key)
      ? 'allow'
      : getSectionMode(category.toolKeys, state.selectedToolKeys),
    onAllow: () => state.allowCategory(category.key),
    onReject: () => state.rejectCategory(category.key)
  }));

  let uncategorized = state.index.uncategorizedToolKeys;

  if (uncategorized.length > 0) {
    sections.push({
      id: 'category:__uncategorized__',
      title: 'Uncategorized',
      description: null,
      imageUrl: null,
      toolKeys: uncategorized,
      mode: getSectionMode(uncategorized, state.selectedToolKeys),
      onAllow: () => state.setToolsChecked(uncategorized, true),
      onReject: () => state.setToolsChecked(uncategorized, false)
    });
  }

  return sections;
};

export type ToolSelectionSectionsProps = {
  state: ToolSelectionState;
  groupBy?: ToolSelectionGroupBy;
  disabled?: boolean;
  /** Controls rendered on the same row as "Expand All", aligned to the left. */
  toolbar?: ReactNode;
};

/**
 * Section list with an Allow / Reject / Mixed toggle per section and a checkbox per tool.
 * Grouped by access (read-only / write / destructive) or by tool category. A tool in several
 * categories is listed in each of them.
 */
export let ToolSelectionSections = ({
  state,
  groupBy = 'access',
  disabled,
  toolbar
}: ToolSelectionSectionsProps) => {
  let [mixedSectionIds, setMixedSectionIds] = useState<Set<string>>(() => new Set());
  let [expandedOverrides, setExpandedOverrides] = useState<Record<string, boolean>>({});

  let effectiveGroupBy =
    groupBy === 'category' && state.index.hasCategories ? 'category' : 'access';
  let sections = (
    effectiveGroupBy === 'category' ? getCategorySections(state) : getAccessSections(state)
  ).filter(section => section.toolKeys.length > 0);
  let showImages = sections.some(section => section.imageUrl);

  // Categories start collapsed so every category is visible at a glance; the three access
  // groups stay open as before.
  let defaultExpanded = effectiveGroupBy !== 'category';
  let isExpanded = (sectionId: string) => expandedOverrides[sectionId] ?? defaultExpanded;
  let allExpanded = sections.every(section => isExpanded(section.id));

  let setAllExpanded = (expanded: boolean) =>
    setExpandedOverrides(Object.fromEntries(sections.map(section => [section.id, expanded])));

  // A transition can change the state of every section sharing one of these tools, so their
  // "Mixed" choice no longer applies.
  let clearMixedForTools = (toolKeys: string[]) => {
    let changed = new Set(toolKeys);

    setMixedSectionIds(prev => {
      let next = new Set(prev);
      for (let section of sections) {
        if (section.toolKeys.some(key => changed.has(key))) next.delete(section.id);
      }
      return next;
    });
  };

  return (
    <Flex direction="column" gap={8}>
      {toolbar || sections.length > 1 ? (
        <Flex align="center" justify="space-between" gap={10} wrap="wrap">
          <ToolbarSlot>{toolbar}</ToolbarSlot>

          {sections.length > 1 ? (
            <Button
              type="button"
              variant="ghost"
              size="1"
              onClick={() => setAllExpanded(!allExpanded)}
            >
              {allExpanded ? 'Collapse All' : 'Expand All'}
            </Button>
          ) : null}
        </Flex>
      ) : null}

      {sections.map(section => {
        let expanded = isExpanded(section.id);
        let contentId = `tool-section-${section.id}`;
        let selectedCount = section.toolKeys.filter(key =>
          state.selectedToolKeys.has(key)
        ).length;

        return (
          <SectionCard key={section.id}>
            <SectionHeader>
              <SectionTrigger
                type="button"
                title={!expanded && section.description ? section.description : undefined}
                aria-expanded={expanded}
                aria-controls={contentId}
                onClick={() =>
                  setExpandedOverrides(prev => ({ ...prev, [section.id]: !expanded }))
                }
              >
                <Chevron size={16} aria-hidden="true" $expanded={expanded} />

                {showImages ? (
                  <CategoryImage imageUrl={section.imageUrl} name={section.title} />
                ) : null}

                <SectionText>
                  <Text size="2" weight="strong" style={{ lineHeight: 1.2 }}>
                    {section.title}
                  </Text>
                  <Text size="1" color="gray600">
                    {selectedCount} of {section.toolKeys.length} enabled
                  </Text>
                  {/* Collapsed cards keep a fixed two-line header so every category fits at a
                      glance; the description is shown once the card is opened. */}
                  {expanded && section.description ? (
                    <Text size="1" color="gray600">
                      {section.description}
                    </Text>
                  ) : null}
                </SectionText>
              </SectionTrigger>

              <OptionToggle
                size="1"
                disabled={disabled}
                value={mixedSectionIds.has(section.id) ? 'mixed' : section.mode}
                onChange={value => {
                  if (value === 'mixed') {
                    setMixedSectionIds(prev => new Set(prev).add(section.id));
                    // Mixed means picking tools one by one, so show them.
                    setExpandedOverrides(prev => ({ ...prev, [section.id]: true }));
                    return;
                  }

                  if (value !== 'allow' && value !== 'reject') return;

                  clearMixedForTools(section.toolKeys);
                  if (value === 'allow') section.onAllow();
                  else section.onReject();
                }}
                items={toolPermissionModeItems}
              />
            </SectionHeader>

            {expanded ? (
              <SectionContent id={contentId}>
                {section.toolKeys.map(toolKey => {
                  let tool = state.index.toolsByKey.get(toolKey);
                  if (!tool) return null;

                  let isCustomRuleTool = state.customRuleToolKeys.has(toolKey);

                  return (
                    <ToolRow key={`${section.id}:${toolKey}`}>
                      <Checkbox
                        checked={state.selectedToolKeys.has(toolKey)}
                        disabled={disabled || isCustomRuleTool}
                        onCheckedChange={checked => {
                          clearMixedForTools([toolKey]);
                          state.setToolsChecked([toolKey], !!checked);
                        }}
                        label={tool.name}
                        description={isCustomRuleTool ? 'Allowed by a custom rule' : undefined}
                      />
                    </ToolRow>
                  );
                })}
              </SectionContent>
            ) : null}
          </SectionCard>
        );
      })}

      {effectiveGroupBy === 'category' ? (
        <Text size="1" color="gray600" style={{ marginTop: 4 }}>
          Allowing a whole category also includes tools added to it in later versions, unless
          the provider version is pinned. Tools picked individually stay limited to the ones
          you selected.
        </Text>
      ) : null}
    </Flex>
  );
};

let ToolbarSlot = styled.div`
  flex: 1 1 auto;
  min-width: 0;
`;

let SectionCard = styled.div`
  border: 1px solid ${theme.colors.gray300};
  border-radius: 10px;
  background: ${theme.colors.background};
`;

let SectionHeader = styled.div`
  display: grid;
  grid-template-columns: minmax(120px, 1fr) auto;
  gap: 10px;
  align-items: center;
  padding: 8px 12px 8px 4px;
`;

let SectionTrigger = styled.button`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 4px 6px;
  border: none;
  border-radius: 8px;
  background: transparent;
  text-align: left;
  cursor: pointer;
  color: inherit;
  font: inherit;

  &:hover {
    background: ${theme.colors.gray100};
  }

  &:focus-visible {
    outline: 2px solid ${theme.colors.gray500};
    outline-offset: 1px;
  }
`;

let SectionText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
`;

let SectionContent = styled.div`
  display: flex;
  flex-direction: column;
  padding: 0 12px 4px;
`;

let ToolRow = styled.div`
  padding: 9px 2px;
  border-top: 1px solid ${theme.colors.gray300};
`;

let Chevron = styled(RiArrowDownSLine)<{ $expanded: boolean }>`
  flex-shrink: 0;
  color: ${theme.colors.gray600};
  transform: rotate(${p => (p.$expanded ? '0deg' : '-90deg')});
  transition: transform 0.15s ease;
`;

let ImageTile = styled.span`
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  border-radius: 6px;
  border: 1px solid ${theme.colors.gray300};
  background: ${theme.colors.gray100};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  font-size: 11px;
  font-weight: 600;
  color: ${theme.colors.gray600};

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
`;

// Falls back to the category's initial so rows stay aligned when only some categories have
// an image, or an image fails to load.
let CategoryImage = ({ imageUrl, name }: { imageUrl: string | null; name: string }) => {
  let [failed, setFailed] = useState(false);

  return (
    <ImageTile aria-hidden="true">
      {imageUrl && !failed ? (
        <img src={imageUrl} alt="" loading="lazy" onError={() => setFailed(true)} />
      ) : (
        name.trim().charAt(0).toUpperCase()
      )}
    </ImageTile>
  );
};

let pluralize = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

let ToolSelectionCallouts = ({ state }: { state: ToolSelectionState }) => {
  let preservedRuleTypes = Array.from(
    new Set(state.value.preservedRules.map(rule => rule.type))
  );
  let missingCategoryCount = state.missing.categoryKeys.length;
  let missingToolCount = state.missing.toolKeys.length;
  let missingParts = [
    ...(missingCategoryCount
      ? [`${missingCategoryCount} ${missingCategoryCount === 1 ? 'category' : 'categories'}`]
      : []),
    ...(missingToolCount ? [pluralize(missingToolCount, 'tool')] : [])
  ];

  if (!preservedRuleTypes.length && !missingParts.length) return null;

  return (
    <Flex direction="column" gap={8}>
      {preservedRuleTypes.length > 0 ? (
        <Callout color="gray">
          This filter also has {pluralize(state.value.preservedRules.length, 'custom rule')} (
          {preservedRuleTypes.join(', ')}). They are kept when you save.
        </Callout>
      ) : null}

      {missingParts.length > 0 ? (
        <Callout color="orange">
          {missingParts.join(' and ')}{' '}
          {missingCategoryCount + missingToolCount === 1 ? 'is' : 'are'} selected but not
          available in this provider version. They stay in the filter until you remove them.
        </Callout>
      ) : null}
    </Flex>
  );
};

export type ToolSelectionEditorProps = UseToolSelectionInput & {
  disabled?: boolean;
};

/**
 * Full tool picker: a "Group by" switch (only when the provider has tool categories),
 * callouts for preserved or unavailable selections, and the section list.
 */
export let ToolSelectionEditor = ({ disabled, ...input }: ToolSelectionEditorProps) => {
  let state = useToolSelection(input);
  let [groupBy, setGroupBy] = useState<ToolSelectionGroupBy>('category');

  return (
    <Flex direction="column" gap={12}>
      <ToolSelectionCallouts state={state} />

      <ToolSelectionSections
        state={state}
        groupBy={groupBy}
        disabled={disabled}
        toolbar={
          state.index.hasCategories ? (
            <Flex align="center" gap={10}>
              <Text size="2" color="gray700" wrap="nowrap" style={{ flexShrink: 0 }}>
                Group by
              </Text>
              <OptionToggle
                size="1"
                label="Group tools by"
                hideLabel
                value={groupBy}
                onChange={value => {
                  if (value === 'category' || value === 'access') setGroupBy(value);
                }}
                items={groupByItems}
              />
            </Flex>
          ) : null
        }
      />
    </Flex>
  );
};
