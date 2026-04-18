import * as RadixToggleGroup from '@radix-ui/react-toggle-group';
import { Input, RenderDate, Text, theme } from '@metorial/ui';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { useDebounced } from '../../../../hooks/useDebounced';

export type CallbackDeploymentPickerItem = {
  id: string;
  name: string | null;
  createdAt: Date | string;
};

let PickerBox = styled.div`
  display: flex;
  flex-direction: column;
  gap: 7px;
  width: 100%;
`;

let Shell = styled.div`
  border-radius: 20px;
  background: ${theme.colors.background};
  box-shadow: inset 0 0 0 1px ${theme.colors.gray300};
  overflow: hidden;
  width: 100%;
`;

let SearchHeader = styled.div`
  position: sticky;
  top: 0;
  z-index: 3;
  padding: 10px 10px;
  background: ${theme.colors.background};
  border-bottom: 1px solid ${theme.colors.gray300};
`;

let ScrollArea = styled.div`
  max-height: calc(100vh - 420px);
  min-height: 120px;
  overflow: auto;
`;

let DeploymentsRoot = styled(RadixToggleGroup.Root)`
  display: flex;
  flex-direction: column;
  width: 100%;
  border: 0;
  background: transparent;
`;

let DeploymentItem = styled(RadixToggleGroup.Item)`
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr) auto;
  column-gap: 14px;
  align-items: center;
  width: 100%;
  position: relative;
  text-align: left;
  border: 0;
  border-radius: 0;
  background: transparent;
  padding: 14px 18px;
  cursor: pointer;
  outline: none;
  box-shadow: none;
  transition:
    background 0.18s ease,
    box-shadow 0.18s ease;

  & + & {
    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 1px;
      background: ${theme.colors.gray300};
    }
  }

  &:hover {
    background: ${theme.colors.gray100};
  }

  &:focus-visible {
    outline: none;
  }

  &[data-state='on'] {
    position: relative;
    z-index: 1;
    background: ${theme.colors.gray200};
    box-shadow: inset 0 0 0 1px ${theme.colors.gray300};
  }

  &[data-state='on']::before {
    opacity: 0;
  }

  &[data-state='on'] + &::before {
    opacity: 0;
  }
`;

let Indicator = styled.span`
  width: 16px;
  height: 16px;
  border-radius: 999px;
  border: 1.5px solid ${theme.colors.gray500};
  background: ${theme.colors.background};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition:
    border-color 0.18s ease,
    background 0.18s ease;

  &::after {
    content: '';
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: ${theme.colors.primary};
    opacity: 0;
    transform: scale(0.6);
    transition:
      opacity 0.18s ease,
      transform 0.18s ease;
  }

  ${DeploymentItem}[data-state='on'] & {
    border-color: ${theme.colors.primary};
  }

  ${DeploymentItem}[data-state='on'] &::after {
    opacity: 1;
    transform: scale(1);
  }
`;

let Content = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`;

let TitleLine = styled.div`
  font-size: 14px;
  font-weight: 600;
  line-height: 1.2;
  color: ${theme.colors.gray900};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

let Subtitle = styled.div`
  font-size: 12px;
  line-height: 1.35;
  color: ${theme.colors.gray600};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-variant-numeric: tabular-nums;
`;

let Timestamp = styled.div`
  font-size: 12px;
  color: ${theme.colors.gray600};
  white-space: nowrap;
  padding-left: 14px;
`;

let EmptyState = styled.div`
  padding: 28px 20px;
  text-align: center;
`;

let shortenId = (id: string) => {
  if (id.length <= 16) return id;
  return `${id.slice(0, 10)}...${id.slice(-4)}`;
};

export let CallbackDeploymentPicker = (p: {
  items: CallbackDeploymentPickerItem[];
  value: string | undefined;
  onChange: (id: string) => void;
  searchable?: boolean;
  ariaLabel?: string;
  focusOnMount?: boolean;
}) => {
  let id = useId();
  let labelId = `${id}-label`;
  let [search, setSearch] = useState('');
  let searchDebounced = useDebounced(search, 200);
  let itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  let hasAutoFocused = useRef(false);

  let filteredItems = useMemo(() => {
    let query = searchDebounced.trim().toLowerCase();
    if (!query) return p.items;

    return p.items.filter(item => {
      let title = (item.name ?? '').toLowerCase();
      return title.includes(query) || item.id.toLowerCase().includes(query);
    });
  }, [p.items, searchDebounced]);

  useEffect(() => {
    if (!p.focusOnMount) return;
    if (hasAutoFocused.current) return;

    let targetId = p.value || filteredItems[0]?.id;
    if (!targetId) return;

    let frame = requestAnimationFrame(() => {
      itemRefs.current[targetId]?.focus();
      hasAutoFocused.current = true;
    });

    return () => cancelAnimationFrame(frame);
  }, [p.focusOnMount, p.value, filteredItems]);

  return (
    <PickerBox>
      <Shell>
        {p.searchable && (
          <SearchHeader>
            <Input
              label="Search deployments"
              hideLabel
              size="2"
              placeholder="Search deployments..."
              value={search}
              onInput={setSearch}
            />
          </SearchHeader>
        )}

        <ScrollArea>
          {filteredItems.length === 0 ? (
            <EmptyState>
              <Text size="2" color="gray600">
                {searchDebounced.trim()
                  ? 'No deployments match your search.'
                  : 'No deployments found.'}
              </Text>
            </EmptyState>
          ) : (
            <DeploymentsRoot
              type="single"
              orientation="vertical"
              value={p.value ?? ''}
              onValueChange={nextValue => {
                if (!nextValue || nextValue == p.value) return;
                p.onChange(nextValue);
              }}
              onKeyDownCapture={e => {
                if (e.key !== 'Enter') return;
                e.preventDefault();

                let form = (e.target as HTMLElement).closest('form');
                requestAnimationFrame(() => {
                  form?.requestSubmit();
                });
              }}
              aria-label={p.ariaLabel ?? 'Select a deployment'}
              aria-labelledby={labelId}
            >
              {filteredItems.map(item => (
                <DeploymentItem
                  key={item.id}
                  value={item.id}
                  ref={element => {
                    itemRefs.current[item.id] = element;
                  }}
                  onFocus={() => {
                    if (p.value == item.id) return;
                    p.onChange(item.id);
                  }}
                >
                  <Indicator aria-hidden />
                  <Content>
                    <TitleLine>{item.name?.trim() || 'Unnamed deployment'}</TitleLine>
                    <Subtitle>{shortenId(item.id)}</Subtitle>
                  </Content>
                  <Timestamp>
                    <RenderDate date={item.createdAt} />
                  </Timestamp>
                </DeploymentItem>
              ))}
            </DeploymentsRoot>
          )}
        </ScrollArea>
      </Shell>
    </PickerBox>
  );
};
