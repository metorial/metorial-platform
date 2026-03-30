import { Button, Flex, Text, theme } from '@metorial/ui';
import styled from 'styled-components';
import type { ProviderSearchItem } from '../types';

interface ProviderSelectionStepProps {
  providers: ProviderSearchItem[];
  onSelect: (providerId: string) => Promise<unknown>;
  isSubmitting: boolean;
}

let Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
`;

let ProviderCard = styled.button`
  width: 100%;
  border: 1px solid ${theme.colors.gray300};
  border-radius: 12px;
  background: white;
  text-align: left;
  padding: 14px;
  transition:
    border-color 0.2s ease,
    transform 0.2s ease;

  &:hover {
    border-color: ${theme.colors.gray600};
    transform: translateY(-1px);
  }
`;

let ProviderIcon = styled.div<{ $image?: string | null }>`
  width: 40px;
  height: 40px;
  border-radius: 10px;
  margin-bottom: 10px;
  background: ${p =>
    p.$image
      ? `url(${p.$image}) center/contain no-repeat, white`
      : 'linear-gradient(135deg, #111827, #374151)'};
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
`;

export let ProviderSelectionStep = ({
  providers,
  onSelect,
  isSubmitting
}: ProviderSelectionStepProps) => {
  return (
    <Flex direction="column" gap={18}>
      <Grid>
        {providers.map(provider => (
          <ProviderCard
            key={provider.id}
            type="button"
            disabled={isSubmitting}
            onClick={() => onSelect(provider.providerId)}
          >
            <ProviderIcon $image={provider.imageUrl}>
              {!provider.imageUrl ? provider.name.charAt(0).toUpperCase() : ''}
            </ProviderIcon>
            <Text size="2" weight="medium">
              {provider.name}
            </Text>
          </ProviderCard>
        ))}
      </Grid>

      {providers.length === 0 && (
        <Text size="2" color="gray600">
          No providers match your search.
        </Text>
      )}

      {isSubmitting && (
        <Button loading size="2">
          Selecting provider
        </Button>
      )}
    </Flex>
  );
};
