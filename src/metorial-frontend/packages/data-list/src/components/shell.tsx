import { usePaginationSearchParamsEnabled } from '@metorial/data-hooks';
import { FilterToolbar } from '@metorial/filter-bar';
import { Button, CenteredSpinner, Error, Spacer, Text, theme, useIsGroup } from '@metorial/ui';
import { AnimatePresence, motion } from 'framer-motion';
import React, { memo as reactMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { styled } from 'styled-components';
import type { DataListConfig } from '../config';
import { useDataListController, type DataListController } from '../controller';
import type { DataListCommonProps } from '../types';
import { Columns } from './columnPicker';
import { DataListGridLayout } from './gridLayout';
import { DataListLayoutSwitcher } from './layoutSwitcher';
import { DataListListLayout } from './listLayout';
import { DataListTableLayout } from './tableLayout';

let Wrapper = styled('div')`
  display: flex;
  flex-direction: column;
  width: 100%;
  flex-grow: 1;
`;

let Header = styled('header')`
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: 10px;
`;

let Body = styled('div')`
  position: relative;
  flex-grow: 1;
`;

let BodyFrame = styled('div')<{ $framed: boolean }>`
  ${p =>
    p.$framed
      ? `
    display: flex;
    flex-direction: column;
    margin-top: 10px;
    border: 1px solid ${theme.colors.gray400};
    border-radius: 10px;
    background: ${theme.colors.background};
    box-shadow: ${theme.shadows.small};
    overflow: hidden;

    thead th {
      background: ${theme.colors.gray100};
      border-top: 1px solid ${theme.colors.gray300};
      border-bottom-width: 1px;
    }
  `
      : `
    display: contents;
  `}
`;

let Footer = styled('footer')`
  display: flex;
  justify-content: space-between;
  width: 100%;
  align-items: center;
`;

let ActionBarWrapper = styled('div')`
  position: fixed;
  bottom: 60px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  pointer-events: none;
`;

let ActionBar = styled(motion.div)`
  background: ${theme.colors.foreground};
  border: 1px solid ${theme.colors.gray300};
  padding: 12px 20px;
  border-radius: 100px;
  max-width: 500px;
  overflow-x: auto;
  box-shadow: ${theme.shadows.small};
  display: flex;
  gap: 10px;
  align-items: center;
  pointer-events: auto;
`;

let CenteredMessage = styled('div')`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 40px 20px;
`;

let getEmptyMessage = (controller: DataListController) => {
  let { props, state, hasActiveFilters, hasActiveSearch } = controller;
  let empty = props.emptyState;

  if (state.hasMoreBefore) return 'You have reached the end of this list';

  let fallback = 'No items found matching your criteria';

  if (hasActiveSearch) {
    return (
      (typeof empty == 'object' ? (empty.search ?? empty.filtered) : undefined) ?? fallback
    );
  }

  if (hasActiveFilters) {
    return (typeof empty == 'object' ? empty.filtered : undefined) ?? fallback;
  }

  if (typeof empty == 'string') return empty;
  if (typeof empty == 'object' && typeof empty.initial == 'string') return empty.initial;

  return fallback;
};

let getInitialEmptyComponent = (empty: DataListCommonProps['emptyState']) => {
  if (typeof empty == 'function') return empty;
  if (typeof empty == 'object' && typeof empty.initial == 'function') return empty.initial;
  return undefined;
};

let DataListBody = ({
  controller,
  emptyMessage,
  sidePadding
}: {
  controller: DataListController;
  emptyMessage: string;
  sidePadding?: number;
}) => {
  let layout = controller.activeLayout;
  if (!layout) return null;

  if (layout.kind == 'table') {
    return (
      <DataListTableLayout
        controller={controller}
        emptyMessage={emptyMessage}
        sidePadding={sidePadding}
      />
    );
  }

  if (controller.items.length == 0) {
    return (
      <CenteredMessage>
        <Text size="1" color="gray800" align="center">
          {emptyMessage}
        </Text>
      </CenteredMessage>
    );
  }

  if (layout.kind == 'grid') return <DataListGridLayout controller={controller} />;
  if (layout.kind == 'list') return <DataListListLayout controller={controller} />;

  return (
    <>
      {layout.custom?.render({
        items: controller.items,
        getItemProps: controller.getItemProps,
        selectedIds: controller.selectedItems,
        isLoading: controller.state.isLoading
      })}
    </>
  );
};

export let DataListComponent = reactMemo(
  (inputProps: {
    config: DataListConfig;
    props: Record<string, any> & DataListCommonProps;
  }) => {
    let { config, props } = inputProps;
    let controller = useDataListController(config, props);

    let {
      state,
      variant,
      filters,
      filterState,
      search,
      setSearch,
      debouncedSearch,
      filterPayload,
      selectedItems,
      setSelectedItems,
      bulkEntries,
      runningBulkActionId,
      setRunningBulkActionId,
      layoutOptions,
      activeLayout,
      isTable,
      isFullLoading
    } = controller;

    let isGroup = useIsGroup();
    let isPreview = variant == 'preview';
    let sidePadding = isGroup ? 10 : (props.sidePadding ?? (props.framed ? 12 : undefined));

    let paginationSearchParamsEnabled = usePaginationSearchParamsEnabled();
    let [, setSearchParams] = useSearchParams();

    let hasHeader =
      !isPreview &&
      !props.hideToolbar &&
      (!!props.toolbarEnd ||
        !!config.search ||
        !!config.headerActions ||
        !!props.headerActions ||
        filters.length > 0 ||
        layoutOptions.length > 1 ||
        (config.customizable && isTable));

    let setCursor = (key: 'before' | 'after', value: string) => {
      if (!paginationSearchParamsEnabled) return;

      setSearchParams(
        current => {
          let next = new URLSearchParams(current);
          next.set(key, value);
          next.delete(key == 'before' ? 'after' : 'before');
          return next;
        },
        { replace: true }
      );
    };

    let goToPreviousPage = () => {
      let firstItem = state.items[0];
      if (!firstItem) return;

      setCursor('before', firstItem.id);
      state.loadPrevious();
    };

    let goToNextPage = () => {
      let lastItem = state.items[state.items.length - 1];
      if (!lastItem) return;

      setCursor('after', lastItem.id);
      state.loadNext();
    };

    let InitialEmpty = getInitialEmptyComponent(props.emptyState);

    if (
      InitialEmpty &&
      state.items.length == 0 &&
      !controller.hasActiveFilters &&
      !controller.hasActiveSearch &&
      !state.isLoading &&
      !state.error &&
      !state.hasMoreBefore
    ) {
      return (
        <Wrapper>
          <InitialEmpty />
        </Wrapper>
      );
    }

    let headerActions = props.headerActions ?? config.headerActions;
    let hasBar = !!config.search || filters.length > 0;
    let columnPicker =
      config.customizable && isTable ? (
        <Columns columns={config.columns} layoutObserver={config.layoutObserver} />
      ) : null;

    return (
      <Wrapper>
        {hasHeader && (
          <Header
            style={{
              paddingLeft: props.framed ? undefined : sidePadding,
              paddingRight: props.framed ? undefined : sidePadding,
              paddingTop: isGroup ? 10 : 0
            }}
          >
            <FilterToolbar
              filters={filters}
              filterState={filterState}
              searchState={config.search ? [search, setSearch] : undefined}
              placeholder={
                config.search?.placeholder ?? (filters.length ? 'Filter...' : undefined)
              }
              barEnd={hasBar ? columnPicker : undefined}
              end={
                <>
                  {props.toolbarEnd}

                  <DataListLayoutSwitcher
                    options={layoutOptions}
                    value={activeLayout?.id ?? ''}
                    onChange={controller.setViewId}
                  />

                  {!hasBar && columnPicker}

                  {headerActions &&
                    headerActions({ filter: filterPayload, search: debouncedSearch })}
                </>
              }
            />
          </Header>
        )}

        <BodyFrame $framed={!!props.framed}>
          {props.topContent}

          {isFullLoading && (
            <div style={{ padding: '10px 0px' }}>
              <CenteredSpinner />
            </div>
          )}

          {state.error && (
            <>
              <Spacer height={10} />
              <Error>
                {state.error.data?.message ?? state.error.message ?? 'An error occurred'}
              </Error>
            </>
          )}

          {!isFullLoading && !state.error && (
            <>
              <Body
                style={{
                  opacity: state.isLoading ? 0.3 : 1,
                  transition: 'opacity 0.2s'
                }}
              >
                <AnimatePresence>
                  {state.isLoading && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1
                      }}
                    >
                      <CenteredSpinner />
                    </motion.div>
                  )}
                </AnimatePresence>

                <DataListBody
                  controller={controller}
                  emptyMessage={getEmptyMessage(controller)}
                  sidePadding={sidePadding}
                />
              </Body>

              {isPreview && props.viewAllHref && (
                <Footer style={{ padding: '10px 0px', justifyContent: 'flex-end' }}>
                  <Link to={props.viewAllHref}>
                    <Button as="span" size="1" variant="outline">
                      View All
                    </Button>
                  </Link>
                </Footer>
              )}

              {!isPreview && config.hasPagination && (
                <Footer
                  style={{
                    padding: `10px ${sidePadding ? sidePadding + 5 : 0}px`,
                    borderTop: isGroup ? `1px solid ${theme.colors.gray300}` : 'none'
                  }}
                >
                  <Text size="1" color="gray700" weight="medium">
                    Showing {state.items.length} item{state.items.length == 1 ? '' : 's'}
                  </Text>

                  <div style={{ display: 'flex', gap: 5 }}>
                    <Button
                      size="1"
                      variant="outline"
                      disabled={!state.hasMoreBefore}
                      onClick={goToPreviousPage}
                    >
                      Previous
                    </Button>

                    <Button
                      size="1"
                      variant="outline"
                      disabled={!state.hasMoreAfter}
                      onClick={goToNextPage}
                    >
                      Next
                    </Button>
                  </div>
                </Footer>
              )}

              {isTable && (
                <ActionBarWrapper>
                  <AnimatePresence>
                    {selectedItems.length > 0 && bulkEntries.length > 0 && (
                      <ActionBar
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        transition={{ duration: 0.4, type: 'spring', bounce: 0.35 }}
                      >
                        <Text size="1" color="gray400" weight="medium">
                          <strong>{selectedItems.length}</strong>{' '}
                          {selectedItems.length == 1 ? 'item' : 'items'} selected
                        </Text>

                        {bulkEntries.map(entry => (
                          <Button
                            key={entry.id}
                            onClick={async () => {
                              let selected = state.items.filter(i =>
                                selectedItems.includes(i.id)
                              );

                              if (entry.disabled) {
                                selected = selected.filter(row => !entry.disabled!(row));
                              }

                              if (selected.length == 0) return;

                              setRunningBulkActionId(entry.id);

                              try {
                                await entry.run(selected);
                                setSelectedItems([]);
                              } finally {
                                setRunningBulkActionId(current =>
                                  current == entry.id ? null : current
                                );
                              }
                            }}
                            size="1"
                            loading={runningBulkActionId == entry.id}
                            disabled={runningBulkActionId !== null}
                          >
                            {entry.label}
                          </Button>
                        ))}

                        <Button
                          onClick={() => setSelectedItems([])}
                          size="1"
                          disabled={runningBulkActionId !== null}
                        >
                          Clear selection
                        </Button>
                      </ActionBar>
                    )}
                  </AnimatePresence>
                </ActionBarWrapper>
              )}
            </>
          )}
        </BodyFrame>
      </Wrapper>
    );
  }
);
