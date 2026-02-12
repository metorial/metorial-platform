import { renderWithLoader, renderWithPagination } from '@metorial/data-hooks';
import { useCurrentInstance, useProviders } from '@metorial/state';
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

type Provider = {
  id: string;
  name: string | null;
  slug: string | null;
  description: string | null;
  iconUrl?: string | null;
};

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

let Popular = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
`;

let PopularItem = styled.button`
  display: flex;
  align-items: center;
  padding: 10px;
  background: none;
  border: ${theme.colors.gray300} 1px solid;
  border-radius: 8px;
  text-align: left;
  gap: 10px;

  span {
    font-size: 14px;
    font-weight: 600;
    color: ${theme.colors.gray800};
  }
`;

let ProviderIcon = styled.div`
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: ${theme.colors.gray200};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  color: ${theme.colors.gray700};
`;

export let ProviderSearch = ({
  onSelect,
  stickyTop
}: {
  onSelect?: (provider: Provider) => void;
  stickyTop?: number;
}) => {
  let instance = useCurrentInstance();
  let [search, setSearch] = useState('');
  let searchDebounced = useDebounced(search, 300);

  let providers = useProviders(instance.data?.instanceId);

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

      {renderWithPagination(providers)(providers => {
        let filteredProviders = providers.data.items.filter(
          p =>
            !searchDebounced ||
            p.name?.toLowerCase().includes(searchDebounced.toLowerCase()) ||
            p.slug?.toLowerCase().includes(searchDebounced.toLowerCase()) ||
            p.description?.toLowerCase().includes(searchDebounced.toLowerCase())
        );

        if (search === '') {
          // Show popular/all providers when no search
          return (
            <>
              <Spacer size={20} />

              <Or text="Available Providers" />

              <Spacer size={20} />

              <Popular>
                {filteredProviders.slice(0, 12).map(provider => (
                  <PopularItem
                    key={provider.id}
                    onClick={() => onSelect?.(provider)}
                    type="button"
                  >
                    <ProviderIcon>
                      {(provider.name ?? provider.slug ?? 'P').charAt(0).toUpperCase()}
                    </ProviderIcon>

                    <span>{provider.name ?? provider.slug ?? 'Provider'}</span>
                  </PopularItem>
                ))}
              </Popular>

              {filteredProviders.length === 0 && (
                <Text size="1" color="gray600">
                  No providers available
                </Text>
              )}
            </>
          );
        }

        return (
          <>
            <Spacer size={10} />

            {filteredProviders.length === 0 && (
              <Text size="1" color="gray600">
                No providers found
              </Text>
            )}

            <Items>
              {filteredProviders.map(provider => (
                <ItemButton
                  key={provider.id}
                  onClick={() => onSelect?.(provider)}
                  type="button"
                >
                  <Entity.Wrapper>
                    <Entity.Content>
                      <Entity.Field
                        prefix={
                          <ProviderIcon>
                            {(provider.name ?? provider.slug ?? 'P').charAt(0).toUpperCase()}
                          </ProviderIcon>
                        }
                        title={provider.name ?? provider.slug ?? 'Provider'}
                        description={
                          provider.description
                            ? provider.description.substring(0, 100) +
                              (provider.description.length > 100 ? '...' : '')
                            : undefined
                        }
                      />
                    </Entity.Content>
                  </Entity.Wrapper>
                </ItemButton>
              ))}
            </Items>
          </>
        );
      })}
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

export let ProviderSearchField = ({
  value,
  label,
  onChange,
  size = '3'
}: {
  value?: { id: string; name: string };
  label?: string;
  onChange?: (provider: Provider) => void;
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
            {value?.name ?? (
              <span style={{ color: theme.colors.gray700 }}>Select provider</span>
            )}
          </FieldWrapper>
        }
        open={isOpen}
        onOpenChange={setIsOpen}
      >
        <Popover.Content
          style={{
            width,
            overflowY: 'auto'
          }}
        >
          <ProviderSearch
            onSelect={provider => {
              onChange?.(provider);
              setIsOpen(false);
            }}
          />
        </Popover.Content>
      </Popover.Root>
    </>
  );
};
