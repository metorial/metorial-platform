import { DashboardInstanceProviderListingsGetOutput } from '@metorial/dashboard-sdk';
import { renderWithLoader } from '@metorial/data-hooks';
import { useProviderListings } from '@metorial/state';
import {
  Avatar,
  ButtonSize,
  Entity,
  getButtonSize,
  Input,
  InputLabel,
  Or,
  Popover,
  Spacer,
  Text,
  theme
} from '@metorial/ui';
import { useState } from 'react';
import { useMeasure } from 'react-use';
import styled from 'styled-components';
import { useDebounced } from '../../../../hooks/useDebounced';
import { SmallItemGrid } from '../shared/smallItemGrid';

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
  onSelect,
  stickyTop
}: {
  onSelect?: (server: DashboardInstanceProviderListingsGetOutput) => void;
  stickyTop?: number;
}) => {
  let [search, setSearch] = useState('');
  let searchDebounced = useDebounced(search, 500);
  let server = useProviderListings(
    !search.length
      ? null
      : {
          search: searchDebounced,
          limit: 10
        }
  );

  let allServers = useProviderListings({
    limit: 30
  });

  return (
    <Wrapper>
      <div style={{ position: 'sticky', top: stickyTop ?? 0, zIndex: 1 }}>
        <Input
          label="Search"
          hideLabel
          placeholder="Search for providers"
          value={search}
          onInput={v => setSearch(v)}
        />
      </div>

      {search == '' ? (
        <>
          <Spacer size={20} />
          <Or text="Providers" />
          <Spacer size={10} />

          {renderWithLoader({ allServers })(({ allServers }) => (
            <SmallItemGrid
              items={allServers.data.items.map(server => ({
                id: server.id,
                label: server.name ?? 'Unnamed',
                onSelect: () => onSelect?.(server)
              }))}
            />
          ))}
        </>
      ) : (
        <>
          <Spacer size={10} />

          {server.data?.items.length === 0 && (
            <Text size="1" color="gray600">
              No servers found
            </Text>
          )}

          <Items>
            {server.data?.items.map(server => (
              <ItemButton key={server.id} onClick={() => onSelect?.(server)} type="button">
                <Entity.Wrapper>
                  <Entity.Content>
                    <Entity.Field
                      prefix={
                        // server.isOfficial ? (
                        //   <Badge size="1" color="blue">
                        //     Official
                        //   </Badge>
                        // ) : undefined

                        <Avatar entity={server} />
                      }
                      title={server.name}
                      description={
                        server.description
                          ? server.description.substring(0, 100) +
                            (server.description.length > 100 ? '...' : '')
                          : undefined
                      }
                    />
                  </Entity.Content>
                </Entity.Wrapper>
              </ItemButton>
            ))}
          </Items>
        </>
      )}
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
  onChange?: (server: DashboardInstanceProviderListingsGetOutput) => void;
  size?: ButtonSize;
}) => {
  let sizeStyles = getButtonSize(size);

  let [isOpen, setIsOpen] = useState(false);

  let [ref, { width }] = useMeasure<HTMLDivElement>();

  return (
    <>
      {label && <InputLabel>{label}</InputLabel>}

      <Popover.Root
        trigger={
          <FieldWrapper style={sizeStyles} ref={ref}>
            {value?.name ?? <span style={{ color: theme.colors.gray700 }}>Select server</span>}
          </FieldWrapper>
        }
        open={isOpen}
        onOpenChange={setIsOpen}
      >
        <Popover.Content
          style={{
            width,
            // maxHeight: '400px',
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
