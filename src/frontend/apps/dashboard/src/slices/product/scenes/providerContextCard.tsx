import { useProviderListings } from '@metorial/state';
import { Avatar, theme } from '@metorial/ui';
import styled from 'styled-components';

let Card = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid ${theme.colors.gray300};
  border-radius: 10px;
  background: ${theme.colors.gray100};
`;

let Content = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`;

let Title = styled.span`
  font-size: 14px;
  font-weight: 600;
  color: ${theme.colors.foreground};
  line-height: 1.25;
`;

let Meta = styled.span`
  font-size: 13px;
  color: ${theme.colors.gray700};
  line-height: 1.3;
`;

let Description = styled.span`
  font-size: 12px;
  color: ${theme.colors.gray600};
  line-height: 1.35;
`;

export let ProviderContextCard = (p: {
  providerId?: string | null;
  providerName?: string | null;
  providerImageUrl?: string | null;
  deploymentName?: string | null;
  deploymentDescription?: string | null;
}) => {
  let providerListings = useProviderListings({ orderByRank: true });
  let providerListing = providerListings.data?.items.find(
    listing => listing.provider.id === p.providerId
  );
  let providerName =
    p.providerName ?? providerListing?.name ?? p.providerId ?? p.deploymentName;
  let providerImageUrl = providerListing?.imageUrl ?? p.providerImageUrl;

  if (!providerName) return null;

  return (
    <Card>
      <Avatar
        entity={{
          name: providerName,
          imageUrl: providerImageUrl
        }}
        size={32}
        radius={8}
        noTooltip
        imageFit="contain"
      />

      <Content>
        <Title>{providerName}</Title>

        {p.deploymentName && <Meta>Deployment: {p.deploymentName}</Meta>}

        {p.deploymentDescription && <Description>{p.deploymentDescription}</Description>}
      </Content>
    </Card>
  );
};
