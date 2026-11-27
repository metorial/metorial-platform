import { renderWithPagination, type useMutation } from '@metorial/data-hooks';
import { Avatar, Flex, Input, Spinner, Text, theme } from '@metorial/ui';
import { useDebounced } from '@metorial/use-debounced';
import { useState } from 'react';
import styled from 'styled-components';
import { StepContainer } from '../../../components/stepContainer';
import type { ProviderListing, SessionCredentials } from '../../../state/types';
import { useProviderSearch } from '../../../state/useProviderSearch';

let PAGE_SIZE = 12;
let SEARCH_DEBOUNCE_MS = 300;

let Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
`;

let ProviderCard = styled.button`
  width: 100%;
  border: 1px solid ${theme.colors.gray300};
  border-radius: 12px;
  background: ${theme.colors.background};
  text-align: left;
  padding: 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  transition:
    border-color 0.2s ease,
    transform 0.2s ease;

  &:hover {
    border-color: ${theme.colors.gray600};
    transform: translateY(-1px);
  }
`;

let ProviderGrid = ({
  providers,
  selectProvider
}: {
  providers: ProviderListing[];
  selectProvider: ReturnType<typeof useMutation<string, void>>;
}) => (
  <Flex direction="column" gap={18}>
    <Grid>
      {providers.map(provider => (
        <ProviderCard
          key={provider.id}
          type="button"
          disabled={selectProvider.isLoading}
          onClick={() => selectProvider.mutate(provider.providerId)}
        >
          <Avatar entity={{ name: provider.name, imageUrl: provider.imageUrl }} size={30} />

          <Text size="2" weight="medium">
            {provider.name}
          </Text>
        </ProviderCard>
      ))}
    </Grid>

    {!providers.length && (
      <Text size="2" color="gray600">
        No providers match your search.
      </Text>
    )}

    {selectProvider.isLoading && (
      <Flex align="center" gap={8}>
        <Spinner size={16} />
        <Text size="2" color="gray600">
          Selecting provider...
        </Text>
      </Flex>
    )}

    <selectProvider.RenderError />
  </Flex>
);

export let ProviderStep = ({
  credentials,
  selectProvider
}: {
  credentials: SessionCredentials;
  selectProvider: ReturnType<typeof useMutation<string, void>>;
}) => {
  let [search, setSearch] = useState('');
  let debouncedSearch = useDebounced(search, SEARCH_DEBOUNCE_MS);

  let providers = useProviderSearch(credentials, {
    search: debouncedSearch.trim() || undefined,
    limit: PAGE_SIZE
  });

  return (
    <StepContainer>
      <Flex direction="column" gap={18}>
        <div>
          <Text size="4" weight="strong">
            Choose a provider
          </Text>

          <Text size="2" color="gray600">
            Select the provider you want to connect for this setup session.
          </Text>
        </div>

        <Input
          label="Search providers"
          hideLabel
          placeholder="Search providers"
          value={search}
          onInput={setSearch}
        />

        {renderWithPagination(providers)(res => (
          <ProviderGrid providers={res.data.items} selectProvider={selectProvider} />
        ))}
      </Flex>
    </StepContainer>
  );
};
