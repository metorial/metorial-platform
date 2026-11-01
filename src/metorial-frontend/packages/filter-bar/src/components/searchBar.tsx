import { type ControlSize, getControlSize, theme, Tooltip, useControlSize } from '@metorial/ui';
import { RiCloseLine, RiEqualizerLine, RiSearchLine } from '@remixicon/react';
import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { styled } from 'styled-components';
import {
  type FilterStateTuple,
  getListValue,
  isListFilter,
  type ListFilter,
  matchesQuery,
  removeFilterState,
  type SearchStateTuple,
  sortFiltersForDisplay,
  toggleListValue,
  upsertFilterState
} from '../model/state';
import { getFilterPayload, toFilterFieldNames, type TableFilter } from '../model/tableFilter';
import { FilterPanel } from './panel';
import { FilterPopover } from './popover';
import {
  type AsyncValueOptions,
  type BarOption,
  type FilterSuggestionGroup,
  ListValueSource,
  optionDomId,
  SuggestionList
} from './suggestions';
import { FilterToken, PendingToken } from './token';

let VALUE_MATCH_LIMIT = 6;
let SUGGESTION_WIDTH = 440;

let Bar = styled('div')<{ $radius: string; $minHeight: string }>`
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  min-height: ${p => p.$minHeight};
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 5px 4px 11px;
  box-sizing: border-box;
  border-radius: ${p => p.$radius};
  border: 1px solid ${theme.colors.gray400};
  background: ${theme.colors.background};
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
  cursor: text;
  transition: border-color 0.15s ease;

  &:hover {
    border-color: ${theme.colors.gray500};
  }
`;

let SearchIcon = styled(RiSearchLine)`
  flex-shrink: 0;
  color: ${theme.colors.gray600};
`;

let Tokens = styled('div')`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  flex: 1;
  min-width: 0;
`;

let Field = styled('input')<{ $fontSize: string }>`
  flex: 1 0 120px;
  min-width: 120px;
  height: 26px;
  border: none;
  outline: none;
  background: transparent;
  padding: 0 2px;
  font-size: ${p => p.$fontSize};
  color: ${theme.colors.foreground};

  &::placeholder {
    color: ${theme.colors.gray600};
  }
`;

let End = styled('div')`
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  align-self: flex-start;
`;

let Kbd = styled('kbd')`
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  border-radius: 5px;
  border: 1px solid ${theme.colors.gray400};
  background: ${theme.colors.gray100};
  color: ${theme.colors.gray600};
  font: inherit;
  font-size: 11px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-right: 2px;
`;

let IconButton = styled('button')<{ $size: string; $active?: boolean }>`
  position: relative;
  width: ${p => p.$size};
  height: ${p => p.$size};
  padding: 0;
  border: none;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${p => (p.$active ? theme.colors.gray300 : 'transparent')};
  color: ${p => (p.$active ? theme.colors.foreground : theme.colors.gray650)};
  cursor: pointer;
  transition:
    background 0.12s ease,
    color 0.12s ease;

  &:hover {
    background: ${theme.colors.gray300};
    color: ${theme.colors.foreground};
  }

  &:focus-visible {
    outline: 2px solid ${theme.colors.blue800};
    outline-offset: 1px;
  }
`;

let Badge = styled('span')`
  position: absolute;
  top: 1px;
  right: 1px;
  min-width: 14px;
  height: 14px;
  padding: 0 3px;
  border-radius: 7px;
  background: ${theme.colors.gray900};
  color: ${theme.colors.background};
  font-size: 9.5px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
`;

let isTypingTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || !!target.closest('input, textarea, select, [role="textbox"]'));

let findFilterByKey = (filters: TableFilter<any>[], key: string) => {
  let normalized = key.toLowerCase().replace(/[\s_-]/g, '');
  return filters.find(
    f =>
      f.label.toLowerCase().replace(/[\s_-]/g, '') == normalized ||
      f.id.toLowerCase().replace(/[\s_-]/g, '') == normalized
  );
};

let emptyAsync: AsyncValueOptions = { items: [], isLoading: false };

export type FilterSearchBarProps = {
  filters: TableFilter<any>[];
  filterState: FilterStateTuple;
  searchState?: SearchStateTuple;
  placeholder?: string;
  suggestions?: FilterSuggestionGroup[];
  size?: ControlSize;
  shortcut?: boolean;
};

export let FilterSearchBar = ({
  filters,
  filterState: filterStateTuple,
  searchState,
  placeholder,
  suggestions = [],
  size: sizeProp,
  shortcut = true
}: FilterSearchBarProps) => {
  let [filterState, setFilterState] = filterStateTuple;
  let [localQuery, setLocalQuery] = useState('');
  let search = searchState ? searchState[0] : localQuery;
  let setSearch = searchState ? searchState[1] : setLocalQuery;

  let size = useControlSize(sizeProp);
  let sizing = getControlSize(size);
  let tokenHeight = `calc(${sizing.height} - 12px)`;
  let iconButtonSize = `calc(${sizing.height} - 10px)`;

  let barRef = useRef<HTMLDivElement>(null);
  let inputRef = useRef<HTMLInputElement>(null);
  let listId = useId();

  let [focused, setFocused] = useState(false);
  let [open, setOpen] = useState(false);
  let [activeIndex, setActiveIndex] = useState(-1);
  let [pendingId, setPendingId] = useState<string | null>(null);
  let [pendingQuery, setPendingQuery] = useState('');
  let [asyncValues, setAsyncValues] = useState<AsyncValueOptions>(emptyAsync);

  let [panelOpen, setPanelOpen] = useState(false);
  let [panelFilterId, setPanelFilterId] = useState(() => filters[0]?.id ?? '');

  let orderedFilters = useMemo(() => sortFiltersForDisplay(filters), [filters]);
  let filterPayload = useMemo(() => getFilterPayload(filterState), [filterState]);
  let pendingFilter = pendingId ? filters.find(f => f.id == pendingId) : undefined;
  let query = pendingFilter ? pendingQuery : search;
  let activeFilterCount = filterState.length;

  let tokenStates = useMemo(
    () =>
      filterState.flatMap(state => {
        let filter = filters.find(f => f.id == state.id);
        if (!filter || (filter.highlight && isListFilter(filter))) return [];
        return [{ filter, state }];
      }),
    [filterState, filters]
  );

  let options = useMemo((): BarOption[] => {
    let result: BarOption[] = [];

    if (pendingFilter) {
      if (isListFilter(pendingFilter)) {
        let selected = getListValue(filterState.find(f => f.id == pendingFilter.id));
        for (let item of asyncValues.items) {
          result.push({
            kind: 'value',
            key: `value:${item.id}`,
            group: pendingFilter.label,
            filter: pendingFilter,
            item,
            selected: selected.includes(item.id)
          });
        }
      } else if (pendingQuery.trim()) {
        result.push({
          kind: 'text',
          key: 'text',
          group: pendingFilter.label,
          filter: pendingFilter,
          value: pendingQuery.trim()
        });
      }

      return result;
    }

    let trimmed = search.trim();

    for (let group of suggestions) {
      for (let suggestion of group.items) {
        result.push({
          kind: 'suggestion',
          key: `suggestion:${group.id}:${suggestion.id}`,
          group: group.label,
          suggestion
        });
      }
    }

    if (trimmed) {
      let matches = 0;

      for (let filter of orderedFilters) {
        if (filter.type != 'select') continue;
        let selected = getListValue(filterState.find(f => f.id == filter.id));

        for (let item of filter.options) {
          if (matches >= VALUE_MATCH_LIMIT) break;
          if (!matchesQuery(item.label, trimmed)) continue;

          matches++;
          result.push({
            kind: 'value',
            key: `match:${filter.id}:${item.id}`,
            group: 'Matching filters',
            filter,
            item,
            selected: selected.includes(item.id),
            showFilterLabel: true
          });
        }
      }
    }

    for (let filter of orderedFilters) {
      if (trimmed && !matchesQuery(filter.label, trimmed)) continue;
      result.push({ kind: 'filter', key: `filter:${filter.id}`, group: 'Filter by', filter });
    }

    return result;
  }, [pendingFilter, pendingQuery, asyncValues, search, suggestions, orderedFilters, filterState]);

  useEffect(() => {
    setActiveIndex((pendingId || query.trim()) && options.length ? 0 : -1);
  }, [query, pendingId, options.length]);

  useEffect(() => {
    if (!pendingId) setAsyncValues(emptyAsync);
  }, [pendingId]);

  useEffect(() => {
    if (!shortcut) return;

    let onKeyDown = (e: KeyboardEvent) => {
      if (e.key != '/' || e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;

      let input = inputRef.current;
      if (!input || !input.offsetParent) return;

      let dialogs = document.querySelectorAll('[role="dialog"]');
      let topDialog = dialogs[dialogs.length - 1];
      if (topDialog && !topDialog.contains(input)) return;

      e.preventDefault();
      input.focus();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [shortcut]);

  let focusInput = () => requestAnimationFrame(() => inputRef.current?.focus());

  let cancelPending = () => {
    setPendingId(null);
    setPendingQuery('');
  };

  let openPanel = (filterId: string) => {
    setOpen(false);
    cancelPending();
    setPanelFilterId(filterId);
    setPanelOpen(true);
  };

  let startPending = (filter: TableFilter<any>, initialQuery = '') => {
    if (filter.type == 'number' || filter.type == 'date') {
      openPanel(filter.id);
      return;
    }

    setPendingId(filter.id);
    setPendingQuery(initialQuery);
    setOpen(true);
    focusInput();
  };

  let selectOption = (option: BarOption) => {
    if (option.kind == 'suggestion') {
      setOpen(false);
      option.suggestion.onSelect();
      return;
    }

    if (option.kind == 'filter') {
      startPending(option.filter);
      return;
    }

    if (option.kind == 'value') {
      setFilterState(prev => toggleListValue(prev, option.filter, option.item.id));
      if (!pendingFilter) setSearch('');
      cancelPending();
      focusInput();
      return;
    }

    setFilterState(prev =>
      upsertFilterState(prev, {
        id: option.filter.id,
        fields: toFilterFieldNames(option.filter.fields),
        type: 'string',
        operation: 'eq',
        value: option.value
      })
    );
    cancelPending();
    focusInput();
  };

  let onChange = (value: string) => {
    setOpen(true);

    if (pendingFilter) {
      setPendingQuery(value);
      return;
    }

    let keyMatch = value.match(/(?:^|\s)([\w-]+):(\S*)$/);
    let keyFilter = keyMatch ? findFilterByKey(filters, keyMatch[1]) : undefined;

    if (keyMatch && keyFilter && keyFilter.type != 'number' && keyFilter.type != 'date') {
      setSearch(value.slice(0, value.length - keyMatch[0].length).trimEnd());
      startPending(keyFilter, keyMatch[2]);
      return;
    }

    setSearch(value);
  };

  let onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key == 'ArrowDown' || e.key == 'ArrowUp') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (!options.length) return;

      let delta = e.key == 'ArrowDown' ? 1 : -1;
      setActiveIndex(index => (index + delta + options.length) % options.length);
      return;
    }

    if (e.key == 'Enter') {
      let option = options[activeIndex];
      if (open && option) {
        e.preventDefault();
        selectOption(option);
      } else {
        setOpen(false);
      }
      return;
    }

    if (e.key == 'Escape') {
      if (pendingFilter) {
        e.preventDefault();
        e.stopPropagation();
        cancelPending();
      } else if (open) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      }
      return;
    }

    if (e.key == 'Backspace' && e.currentTarget.selectionStart == 0 && e.currentTarget.selectionEnd == 0) {
      if (pendingFilter) {
        e.preventDefault();
        cancelPending();
        return;
      }

      let last = tokenStates[tokenStates.length - 1];
      if (last) {
        e.preventDefault();
        setFilterState(prev => removeFilterState(prev, last.filter.id));
      }
    }
  };

  let hasContent = !!search || tokenStates.length > 0;
  let loadingGroups = pendingFilter && asyncValues.isLoading ? [pendingFilter.label] : [];
  for (let group of suggestions) if (group.isLoading) loadingGroups.push(group.label);

  let suggestionAnchor = useMemo(
    () => ({
      current: {
        getBoundingClientRect: () => {
          let bar = barRef.current?.getBoundingClientRect();
          if (!bar) return new DOMRect();

          let inputLeft = inputRef.current?.getBoundingClientRect().left ?? bar.left;
          let width = Math.min(SUGGESTION_WIDTH, bar.width);
          let left = Math.max(bar.left, Math.min(inputLeft, bar.right - width));
          return new DOMRect(left, bar.top, bar.right - left, bar.height);
        }
      }
    }),
    []
  );

  let isInsideBar = (target: Element) => !!barRef.current?.contains(target);
  let isInsidePanelLayer = (target: Element) =>
    isInsideBar(target) || !!target.closest('[data-radix-popper-content-wrapper]');

  return (
    <>
      <Bar
        ref={barRef}
        $radius={sizing.borderRadius}
        $minHeight={sizing.height}
        onMouseDown={e => {
          if ((e.target as Element).closest('button, input')) return;
          e.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <SearchIcon size={16} />

        <Tokens>
          {tokenStates.map(({ filter, state }) => (
            <FilterToken
              key={state.id}
              filter={filter}
              state={state}
              height={tokenHeight}
              onOpen={() => openPanel(filter.id)}
              onRemove={() => setFilterState(prev => removeFilterState(prev, filter.id))}
            />
          ))}

          {pendingFilter && <PendingToken filter={pendingFilter} height={tokenHeight} />}

          <Field
            ref={inputRef}
            $fontSize={sizing.fontSize == '16px' ? '14px' : sizing.fontSize}
            value={query}
            placeholder={
              pendingFilter
                ? isListFilter(pendingFilter)
                  ? `Choose ${pendingFilter.label.toLowerCase()}...`
                  : `Enter ${pendingFilter.label.toLowerCase()}...`
                : tokenStates.length
                  ? ''
                  : (placeholder ?? 'Search or filter...')
            }
            aria-label={placeholder ?? 'Search or filter'}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={
              open && activeIndex >= 0 ? optionDomId(listId, activeIndex) : undefined
            }
            autoComplete="off"
            spellCheck={false}
            onChange={e => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => {
              setFocused(true);
              setOpen(true);
            }}
            onClick={() => setOpen(true)}
            onBlur={() => {
              setFocused(false);
              setOpen(false);
              if (pendingFilter && !pendingQuery) cancelPending();
            }}
          />
        </Tokens>

        <End style={{ height: `calc(${sizing.height} - 10px)` }}>
          {hasContent ? (
            <Tooltip content="Clear search and filters">
              <IconButton
                type="button"
                $size={iconButtonSize}
                aria-label="Clear search and filters"
                onClick={() => {
                  let tokenIds = new Set(tokenStates.map(t => t.filter.id));
                  setSearch('');
                  setFilterState(prev => prev.filter(state => !tokenIds.has(state.id)));
                  cancelPending();
                }}
              >
                <RiCloseLine size={16} />
              </IconButton>
            </Tooltip>
          ) : (
            shortcut && !focused && <Kbd aria-hidden>/</Kbd>
          )}

          {filters.length > 0 && (
            <Tooltip content="Filters">
              <IconButton
                type="button"
                $size={iconButtonSize}
                $active={panelOpen}
                aria-label={
                  activeFilterCount ? `Filters (${activeFilterCount} applied)` : 'Filters'
                }
                aria-expanded={panelOpen}
                onClick={() => {
                  if (panelOpen) return setPanelOpen(false);
                  openPanel(
                    filterState[filterState.length - 1]?.id ?? orderedFilters[0]?.id ?? ''
                  );
                }}
              >
                <RiEqualizerLine size={16} />
                {activeFilterCount > 0 && <Badge>{activeFilterCount}</Badge>}
              </IconButton>
            </Tooltip>
          )}
        </End>
      </Bar>

      {pendingFilter && isListFilter(pendingFilter) && (
        <ListValueSource
          key={pendingFilter.id}
          filter={pendingFilter as ListFilter}
          search={pendingQuery}
          filters={filterPayload}
          selected={getListValue(filterState.find(f => f.id == pendingFilter.id))}
          onChange={setAsyncValues}
        />
      )}

      <FilterPopover
        open={open && !panelOpen}
        onOpenChange={setOpen}
        anchorRef={suggestionAnchor}
        followAnchor
        autoFocus={false}
        isInside={isInsideBar}
        width={`min(${SUGGESTION_WIDTH}px, var(--radix-popover-trigger-width))`}
        label="Search suggestions"
      >
        <SuggestionList
          listId={listId}
          options={options}
          query={query}
          activeIndex={activeIndex}
          onActiveIndexChange={setActiveIndex}
          onSelect={selectOption}
          loadingGroups={loadingGroups}
          emptyMessage={
            pendingFilter
              ? isListFilter(pendingFilter)
                ? (asyncValues.empty ?? 'No matching values')
                : 'Type a value and press enter'
              : 'No matching filters'
          }
        />
      </FilterPopover>

      <FilterPopover
        open={panelOpen}
        onOpenChange={setPanelOpen}
        anchorRef={barRef}
        align="end"
        width={filters.length == 1 ? 340 : 600}
        isInside={isInsidePanelLayer}
        label="Filters"
      >
        <FilterPanel
          filters={filters}
          filterState={filterStateTuple}
          activeFilterId={panelFilterId}
          onActiveFilterChange={setPanelFilterId}
          onApplied={() => setPanelOpen(false)}
        />
      </FilterPopover>
    </>
  );
};
