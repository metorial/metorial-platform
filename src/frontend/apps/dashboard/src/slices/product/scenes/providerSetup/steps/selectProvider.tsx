import { renderWithPagination } from '@metorial/data-hooks';
import { useProviders } from '@metorial/state';
import { Button, Flex, Input, Spacer, Text, theme } from '@metorial/ui';
import { useState } from 'react';
import styled from 'styled-components';
import { useDebounced } from '../../../../../hooks/useDebounced';
import { useWizard } from '../index';

let Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 15px;
`;

let ProviderCard = styled.button`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 20px;
  background: white;
  border: 1px solid ${theme.colors.gray300};
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;

  &:hover {
    border-color: ${theme.colors.gray500};
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }

  &:focus {
    outline: none;
    border-color: ${theme.colors.gray700};
  }

  &[data-selected='true'] {
    border-color: ${theme.colors.gray900};
    background: ${theme.colors.gray100};
  }
`;

let ProviderIcon = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: ${theme.colors.gray200};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 600;
  color: ${theme.colors.gray700};
  margin-bottom: 12px;
`;

export let SelectProviderStep = ({ instanceId }: { instanceId: string }) => {
  let { state, setProviderId } = useWizard();
  let [search, setSearch] = useState('');
  let searchDebounced = useDebounced(search, 300);
  let [selectedId, setSelectedId] = useState<string | null>(state.providerId);
  let [selectedName, setSelectedName] = useState<string | null>(state.providerName);

  let providers = useProviders(instanceId);

  let handleSelect = (id: string, name: string) => {
    setSelectedId(id);
    setSelectedName(name);
  };

  let handleContinue = () => {
    if (selectedId && selectedName) {
      setProviderId(selectedId, selectedName);
    }
  };

  return renderWithPagination(providers)(providers => {
    let filteredProviders = providers.data.items.filter(
      p =>
        !searchDebounced ||
        p.name?.toLowerCase().includes(searchDebounced.toLowerCase()) ||
        p.slug?.toLowerCase().includes(searchDebounced.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchDebounced.toLowerCase())
    );

    return (
      <Flex direction="column" gap={20}>
        <Input
          label="Search"
          hideLabel
          placeholder="Search for providers..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <Grid>
          {filteredProviders.map(provider => (
            <ProviderCard
              key={provider.id}
              type="button"
              onClick={() => handleSelect(provider.id, provider.name ?? provider.slug ?? 'Provider')}
              data-selected={selectedId === provider.id}
            >
              <ProviderIcon>
                {(provider.name ?? provider.slug ?? 'P').charAt(0).toUpperCase()}
              </ProviderIcon>
              <Text size="2" weight="strong">
                {provider.name ?? <span style={{ color: theme.colors.gray600 }}>Unnamed</span>}
              </Text>
              {provider.slug && (
                <Text size="1" color="gray600">
                  {provider.slug}
                </Text>
              )}
              {provider.description && (
                <>
                  <Spacer size={8} />
                  <Text size="1" color="gray600">
                    {provider.description.slice(0, 100)}
                    {provider.description.length > 100 ? '...' : ''}
                  </Text>
                </>
              )}
            </ProviderCard>
          ))}
        </Grid>

        {filteredProviders.length === 0 && (
          <Text size="2" color="gray600" align="center">
            No providers found matching your search.
          </Text>
        )}

        <Spacer size={10} />

        <Flex justify="end">
          <Button onClick={handleContinue} disabled={!selectedId}>
            Continue
          </Button>
        </Flex>
      </Flex>
    );
  });
};
