import { theme } from '@metorial/ui';
import { RiCloseLine } from '@remixicon/react';
import React from 'react';
import { styled } from 'styled-components';
import { useEntityFilterLabels } from '../model/entityFilter';
import { getFilterText, summarizeLabels } from '../model/state';
import type { TableFilter, TableFilterState } from '../model/tableFilter';

let mono = `'JetBrains Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace`;

let TokenRoot = styled('span')<{ $height: string }>`
  position: relative;
  flex-shrink: 0;
  max-width: 280px;
  height: ${p => p.$height};
  display: inline-flex;
  align-items: stretch;
  border-radius: 7px;
  overflow: hidden;
  font-family: ${mono};
  font-size: 12.5px;
  line-height: 1;
  user-select: none;

  &:hover button[data-remove],
  &:focus-within button[data-remove] {
    opacity: 1;
  }
`;

let TokenPart = styled('button')`
  display: inline-flex;
  align-items: center;
  border: none;
  margin: 0;
  font: inherit;
  cursor: pointer;
  white-space: nowrap;
`;

let TokenKey = styled(TokenPart)`
  padding: 0 7px 0 8px;
  background: ${theme.colors.gray300};
  color: ${theme.colors.gray700};
`;

let TokenValue = styled(TokenPart)`
  min-width: 0;
  padding: 0 8px;
  background: ${theme.colors.blue300};
  color: ${theme.colors.indigo900};
  font-weight: 600;

  span {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &:hover {
    background: ${theme.colors.blue400};
  }
`;

let TokenRemove = styled('button')`
  position: absolute;
  right: 3px;
  top: 50%;
  transform: translateY(-50%);
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  border-radius: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${theme.colors.blue400};
  color: ${theme.colors.indigo900};
  opacity: 0;
  cursor: pointer;
  transition: opacity 0.12s ease;

  &:hover {
    background: ${theme.colors.blue500};
  }
`;

let PendingKey = styled(TokenKey)`
  border-radius: 7px 0 0 7px;
  background: ${theme.colors.gray350};
  cursor: default;
`;

let noIds: string[] = [];

export let useFilterText = (filter: TableFilter<any>, state: TableFilterState) => {
  let labels = useEntityFilterLabels(filter, state.type == 'entity' ? state.value : noIds);
  if (state.type == 'entity') return summarizeLabels(labels);
  return getFilterText(filter, state);
};

export let tokenKey = (filter: TableFilter<any>) => filter.label.toLowerCase();

export let FilterToken = ({
  filter,
  state,
  height,
  onOpen,
  onRemove
}: {
  filter: TableFilter<any>;
  state: TableFilterState;
  height: string;
  onOpen: () => void;
  onRemove: () => void;
}) => {
  let text = useFilterText(filter, state);

  return (
    <TokenRoot $height={height} data-filter-token>
      <TokenKey type="button" tabIndex={-1} onClick={onOpen}>
        {tokenKey(filter)}
      </TokenKey>

      <TokenValue type="button" title={text} onClick={onOpen} aria-label={`${filter.label}: ${text}. Edit filter`}>
        <span>{text}</span>
      </TokenValue>

      <TokenRemove
        type="button"
        data-remove
        aria-label={`Remove ${filter.label} filter`}
        onClick={e => {
          e.stopPropagation();
          onRemove();
        }}
      >
        <RiCloseLine size={13} />
      </TokenRemove>
    </TokenRoot>
  );
};

export let PendingToken = ({ filter, height }: { filter: TableFilter<any>; height: string }) => (
  <TokenRoot $height={height}>
    <PendingKey as="span">{tokenKey(filter)}</PendingKey>
  </TokenRoot>
);
