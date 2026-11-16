import { Button, theme } from '@metorial/ui';
import React, { useMemo } from 'react';
import { styled } from 'styled-components';
import {
  type FilterStateTuple,
  getListValue,
  isListFilter,
  removeFilterState,
  sortFiltersForDisplay,
  upsertFilterState
} from '../model/state';
import { getFilterPayload, type TableFilter } from '../model/tableFilter';
import { FilterEditor } from './editors';

let PANEL_HEIGHT = 380;

let Layout = styled('div')<{ $compact: boolean }>`
  display: grid;
  grid-template-columns: ${p => (p.$compact ? 'minmax(0, 1fr)' : '184px minmax(0, 1fr)')};
  height: ${p => (p.$compact ? 'auto' : `${PANEL_HEIGHT}px`)};
  max-height: ${PANEL_HEIGHT}px;
  min-height: 0;
`;

let Nav = styled('nav')`
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: ${theme.colors.gray100};
  border-right: 1px solid ${theme.colors.gray300};
`;

let NavList = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 8px 6px;
  overflow-y: auto;
  flex: 1;
`;

let NavTitle = styled('div')`
  padding: 6px 8px 4px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: ${theme.colors.gray600};
`;

let NavItem = styled('button')<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  height: 30px;
  padding: 0 8px;
  border: none;
  border-radius: 7px;
  background: ${p => (p.$active ? theme.colors.gray300 : 'transparent')};
  color: ${p => (p.$active ? theme.colors.foreground : theme.colors.gray750)};
  font-size: 13px;
  font-weight: ${p => (p.$active ? 600 : 500)};
  text-align: left;
  cursor: pointer;
  transition: background 0.12s ease;

  &:hover {
    background: ${p => (p.$active ? theme.colors.gray300 : theme.colors.gray200)};
  }

  & > span:first-child {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

let AppliedBadge = styled('span')`
  flex-shrink: 0;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: ${theme.colors.blue300};
  color: ${theme.colors.blue900};
  font-size: 11px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
`;

let NavFooter = styled('div')`
  padding: 8px;
  border-top: 1px solid ${theme.colors.gray300};
`;

let Main = styled('section')`
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
`;

let Header = styled('header')`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px 10px;
  border-bottom: 1px solid ${theme.colors.gray300};
`;

let HeaderText = styled('div')`
  flex: 1;
  min-width: 0;

  h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: ${theme.colors.foreground};
  }

  p {
    margin: 2px 0 0;
    font-size: 12px;
    color: ${theme.colors.gray600};
  }
`;

let Body = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
`;

let getAppliedCount = (filter: TableFilter<any>, filterState: FilterStateTuple[0]) => {
  let state = filterState.find(f => f.id == filter.id);
  if (!state) return 0;
  return isListFilter(filter) ? getListValue(state).length : 1;
};

export let FilterPanel = ({
  filters,
  filterState: [filterState, setFilterState],
  activeFilterId,
  onActiveFilterChange,
  onApplied
}: {
  filters: TableFilter<any>[];
  filterState: FilterStateTuple;
  activeFilterId: string;
  onActiveFilterChange: (id: string) => void;
  onApplied?: () => void;
}) => {
  let ordered = useMemo(() => sortFiltersForDisplay(filters), [filters]);
  let active = ordered.find(f => f.id == activeFilterId) ?? ordered[0];
  let filterPayload = useMemo(() => getFilterPayload(filterState), [filterState]);
  let compact = ordered.length == 1;

  if (!active) return null;

  let activeState = filterState.find(f => f.id == active.id);
  let isList = isListFilter(active);

  return (
    <Layout $compact={compact}>
      {!compact && (
        <Nav aria-label="Filters">
          <NavList>
            <NavTitle>Filter by</NavTitle>

            {ordered.map(filter => {
              let count = getAppliedCount(filter, filterState);

              return (
                <NavItem
                  key={filter.id}
                  type="button"
                  $active={filter.id == active.id}
                  aria-current={filter.id == active.id}
                  onClick={() => onActiveFilterChange(filter.id)}
                >
                  <span>{filter.label}</span>
                  {count > 0 && <AppliedBadge>{isListFilter(filter) ? count : '•'}</AppliedBadge>}
                </NavItem>
              );
            })}
          </NavList>

          <NavFooter>
            <Button
              size="1"
              variant="ghost"
              fullWidth
              disabled={filterState.length == 0}
              onClick={() => setFilterState([])}
            >
              Clear All Filters
            </Button>
          </NavFooter>
        </Nav>
      )}

      <Main>
        <Header>
          <HeaderText>
            <h3>{active.label}</h3>
            <p>{active.description}</p>
          </HeaderText>

          {activeState && (
            <Button
              size="1"
              variant="ghost"
              onClick={() => setFilterState(prev => removeFilterState(prev, active.id))}
            >
              Clear
            </Button>
          )}
        </Header>

        <Body>
          <FilterEditor
            key={isList ? active.id : `${active.id}:${JSON.stringify(activeState ?? null)}`}
            filter={active}
            state={activeState}
            filters={filterPayload}
            setFilterState={setFilterState}
            maxHeight={compact ? 300 : PANEL_HEIGHT - 120}
            apply={state => {
              setFilterState(prev => upsertFilterState(prev, state));
              if (!isList) onApplied?.();
            }}
          />
        </Body>
      </Main>
    </Layout>
  );
};
