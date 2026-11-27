import { RiCloseLine } from '@remixicon/react';
import { getControlSize, theme } from '@metorial/ui';
import React from 'react';
import styled from 'styled-components';
import { isSelectionReady } from './selection';
import type { PickerSelection } from './types';

let chipSize = getControlSize('1');

let Tray = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 62px;
  overflow-y: auto;
`;

let Chip = styled.span<{ $tone: 'default' | 'needs' | 'failed' }>`
  display: inline-flex;
  align-items: center;
  gap: 2px;
  max-width: 220px;
  height: ${chipSize.height};
  padding: 0 2px 0 4px;
  border-radius: ${chipSize.borderRadius};
  font-size: ${chipSize.fontSize};
  font-weight: 500;
  border: 1px solid
    ${p =>
      p.$tone == 'failed'
        ? theme.colors.red500
        : p.$tone == 'needs'
          ? theme.colors.orange500
          : theme.colors.gray400};
  background: ${p =>
    p.$tone == 'failed'
      ? theme.colors.red200
      : p.$tone == 'needs'
        ? theme.colors.orange200
        : theme.colors.background};
  color: ${p =>
    p.$tone == 'failed'
      ? theme.colors.red900
      : p.$tone == 'needs'
        ? theme.colors.orange900
        : theme.colors.foreground};
`;

let ChipMain = styled.button.attrs({ type: 'button' })`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 0 2px;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;

  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

let ChipRemove = styled.button.attrs({ type: 'button' })`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: ${theme.colors.gray600};
  cursor: pointer;

  &:hover {
    background: ${theme.colors.gray300};
    color: ${theme.colors.foreground};
  }
`;

export let PickerSelectionTray = <V,>(p: {
  selected: PickerSelection<V>[];
  failedKeys: string[];
  onJump: (key: string) => void;
  onRemove: (key: string) => void;
}) => {
  if (!p.selected.length) return null;

  return (
    <Tray aria-label="Selected">
      {p.selected.map(selection => {
        let { item } = selection;
        let tone: 'default' | 'needs' | 'failed' = p.failedKeys.includes(item.key)
          ? 'failed'
          : isSelectionReady(selection)
            ? 'default'
            : 'needs';

        return (
          <Chip key={item.key} $tone={tone}>
            <ChipMain title={item.title} onClick={() => p.onJump(item.key)}>
              {item.icon(18)}
              <span>{item.title}</span>
            </ChipMain>

            <ChipRemove
              aria-label={`Remove ${item.title}`}
              title={`Remove ${item.title}`}
              onClick={() => p.onRemove(item.key)}
            >
              <RiCloseLine size={12} />
            </ChipRemove>
          </Chip>
        );
      })}
    </Tray>
  );
};
