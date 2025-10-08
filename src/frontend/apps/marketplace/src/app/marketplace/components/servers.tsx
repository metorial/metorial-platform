'use client';

import { Text } from '@metorial/ui';
import styled from 'styled-components';
import { Card } from '../../../components/cards-carousel';
import { ServerListing } from '../../../state/server';

let Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 30px;

  max-width: 80rem;
  margin: 0 auto 2.5rem;
`;

let CardWrapper = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
`;

let EmptyState = styled.div`
  display: flex;
  justify-content: center;
  text-align: center;
  max-width: 80rem;
  margin: 0 auto;
  padding: 2.5rem;
`;

export let LandingServers = ({ servers }: { servers: ServerListing[] }) => {
  return (
    <>
      {!!servers.length && (
        <Grid>
          {servers.map((server, index) => (
            <CardWrapper key={server.id}>
              <Card
                card={{
                  category: server.vendor?.name ?? server.profile?.name ?? 'External',
                  title: server.name,
                  src: `https://avatar-cdn.metorial.com/${server.id}`
                }}
                index={index}
                href={`/marketplace/s/${server.slug}`}
              />
            </CardWrapper>
          ))}
        </Grid>
      )}

      {servers.length === 0 && (
        <EmptyState>
          <Text size="3" weight="medium">
            No MCP servers in the Metorial catalog match your search. Try searching for a
            different server or vendor.
          </Text>
        </EmptyState>
      )}
    </>
  );
};
