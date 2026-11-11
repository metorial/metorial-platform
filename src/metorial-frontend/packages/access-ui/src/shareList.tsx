import {
  Combobox,
  Text,
  theme,
  type ComboboxItemData,
  type ComboboxProviderArgs,
  type ComboboxProviderResult
} from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import React, { useState } from 'react';
import styled from 'styled-components';
import { AccessList } from './accessList';

let AddBar = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px var(--access-inline, 16px);
  border-bottom: 1px solid ${theme.colors.gray300};

  & > :first-child {
    flex: 1;
    min-width: 0;
  }
`;

let Summary = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px 18px;
  padding: 10px var(--access-inline, 16px);
  font-size: 13px;
  color: ${theme.colors.gray700};
  border-bottom: 1px solid ${theme.colors.gray300};
  background: ${theme.colors.gray100};

  b {
    color: ${theme.colors.foreground};
    font-weight: 600;
  }
`;

export let ShareList = <TData,>(p: {
  title: React.ReactNode;
  description?: React.ReactNode;
  rightActions?: React.ReactNode;
  addPlaceholder?: string;
  addSuffix?: React.ReactNode;
  provider: (args: ComboboxProviderArgs<TData>) => ComboboxProviderResult<TData>;
  onAdd: (item: ComboboxItemData<TData>) => void | Promise<void>;
  renderItem?: (item: ComboboxItemData<TData>) => React.ReactNode;
  disabled?: boolean;
  summary?: React.ReactNode[];
  children: React.ReactNode;
}) => {
  let [resetKey, setResetKey] = useState(0);

  return (
    <Box noPadding title={p.title} description={p.description} rightActions={p.rightActions}>
      <AddBar>
        <div>
          <Combobox<TData>
            key={resetKey}
            label="Add groups or people"
            hideLabel
            size="2"
            placeholder={p.addPlaceholder ?? 'Add groups or people…'}
            disabled={p.disabled}
            value={null}
            provider={p.provider}
            renderItem={p.renderItem}
            onChange={async (_, item) => {
              if (!item) return;
              setResetKey(k => k + 1);
              await p.onAdd(item);
            }}
          />
        </div>
        {p.addSuffix}
      </AddBar>

      {p.summary?.length ? (
        <Summary>
          {p.summary.map((part, i) => (
            <span key={i}>{part}</span>
          ))}
        </Summary>
      ) : null}

      <AccessList>{p.children}</AccessList>
    </Box>
  );
};

export let ShareListHint = (p: { children: React.ReactNode }) => (
  <Text size="1" color="gray600">
    {p.children}
  </Text>
);
