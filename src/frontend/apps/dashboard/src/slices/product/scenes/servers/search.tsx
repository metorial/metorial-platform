import { ServersListingsGetOutput } from '@metorial/core/src/mt_2025_01_01_dashboard';
import { useServerListings } from '@metorial/state';
import {
  Badge,
  ButtonSize,
  Entity,
  getButtonSize,
  Input,
  InputLabel,
  Popover,
  Spacer,
  Text,
  theme
} from '@metorial/ui';
import { useState } from 'react';
import { useMeasure } from 'react-use';
import styled from 'styled-components';
import { useDebounced } from '../../../../hooks/useDebounced';

let Wrapper = styled.div``;

let Items = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

let ItemButton = styled.button`
  display: flex;
  padding: 0;
  border: none;
  background: none;
  text-align: left;
  width: 100%;
  flex-direction: column;
`;

export let ServerSearch = ({
  onSelect
}: {
  onSelect?: (server: ServersListingsGetOutput) => void;
}) => {
  let [search, setSearch] = useState('');
  let searchDebounced = useDebounced(search, 500);
  let server = useServerListings({
    search: searchDebounced,
    limit: 10
  });

  return (
    <Wrapper>
      <div style={{ position: 'sticky', top: 0, zIndex: 1 }}>
        <Input
          label="Search"
          hideLabel
          placeholder="Search for servers"
          value={search}
          onInput={v => setSearch(v)}
        />
      </div>

      <Spacer size={10} />

      {server.data?.items.length === 0 && (
        <Text size="1" color="gray600">
          No servers found
        </Text>
      )}

      <Items>
        {server.data?.items.map(server => (
          <ItemButton key={server.id} onClick={() => onSelect?.(server)}>
            <Entity.Wrapper>
              <Entity.Content>
                <Entity.Field
                  prefix={
                    server.isOfficial ? (
                      <Badge size="1" color="blue">
                        Official
                      </Badge>
                    ) : undefined
                  }
                  title={[server.vendor?.name, server.name].filter(Boolean).join(' / ')}
                  description={
                    server.description.substring(0, 100) +
                    (server.description.length > 100 ? '...' : '')
                  }
                />
              </Entity.Content>
            </Entity.Wrapper>
          </ItemButton>
        ))}
      </Items>
    </Wrapper>
  );
};

let FieldWrapper = styled.div`
  display: flex;
  outline: 1px solid transparent;
  background: ${theme.colors.gray300};
  color: ${theme.colors.foreground};
  outline: none;
  width: 100%;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  transition: all 0.3s ease;
  border: none;
  font-weight: 500;
  flex-shrink: 0;

  &:focus-within,
  &:focus {
    background: ${theme.colors.gray300};
    outline: 1px solid ${theme.colors.gray600};
  }
`;

export let ServerSearchField = ({
  value,
  label,
  onChange,
  size = '3'
}: {
  value?: { id: string; name: string };
  label?: string;
  onChange?: (server: ServersListingsGetOutput) => void;
  size?: ButtonSize;
}) => {
  let sizeStyles = getButtonSize(size);

  let [isOpen, setIsOpen] = useState(false);

  let [ref, { width }] = useMeasure();

  return (
    <>
      {label && <InputLabel>{label}</InputLabel>}

      <Popover.Root
        trigger={
          <FieldWrapper style={sizeStyles} ref={ref as any}>
            {value?.name ?? <span style={{ color: theme.colors.gray700 }}>Select server</span>}
          </FieldWrapper>
        }
        open={isOpen}
        onOpenChange={setIsOpen}
      >
        <Popover.Content
          style={{
            width,
            maxHeight: '400px',
            overflowY: 'auto'
          }}
        >
          <ServerSearch
            onSelect={server => {
              onChange?.(server);
              setIsOpen(false);
            }}
          />
        </Popover.Content>
      </Popover.Root>
    </>
  );
};
