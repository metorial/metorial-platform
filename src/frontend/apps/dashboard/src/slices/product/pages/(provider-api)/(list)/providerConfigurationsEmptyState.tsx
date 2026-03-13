import { Button, Text, theme } from '@metorial/ui';
import styled from 'styled-components';

let Wrapper = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 10px;
`;

let Card = styled.div`
  width: 100%;
  max-width: 680px;
  padding: 32px;
  border-radius: 18px;
  border: 1px solid ${theme.colors.gray400};
  background:
    linear-gradient(180deg, ${theme.colors.gray200} 0%, ${theme.colors.background} 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  text-align: center;
`;

let ActionRow = styled.div`
  margin-top: 8px;
`;

export let ProviderConfigurationsEmptyState = ({
  title,
  description,
  actionLabel,
  onAction
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) => {
  return (
    <Wrapper>
      <Card>
        <Text size="4" weight="strong">
          {title}
        </Text>

        <Text size="2" color="gray600" style={{ maxWidth: 520 }}>
          {description}
        </Text>

        <ActionRow>
          <Button size="2" onClick={onAction}>
            {actionLabel}
          </Button>
        </ActionRow>
      </Card>
    </Wrapper>
  );
};
