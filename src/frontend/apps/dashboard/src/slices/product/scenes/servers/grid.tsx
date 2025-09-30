import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import type { ServersListingsListQuery } from '@metorial/generated/src/mt_2025_01_01_dashboard';
import { useCurrentInstance, useServerListings } from '@metorial/state';
import { Avatar, Badge, Text } from '@metorial/ui';
import { ItemGrid } from '@metorial/ui-product';
import { RiCheckLine } from '@remixicon/react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';

let Categories = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
`;

let Category = styled.div`
  background: #f0f0f0;
  height: 26px;
  border-radius: 50px;
  padding: 0 10px;
  display: flex;
  align-items: center;
  font-size: 12px;
  font-weight: 500;
`;

export let ServersGrid = (filter: ServersListingsListQuery) => {
  let instance = useCurrentInstance();
  let servers = useServerListings(filter);
  let navigate = useNavigate();

  return renderWithLoader({ servers })(({ servers }) => (
    <>
      {servers.data.items.length > 0 && (
        <ItemGrid.Root width="300px">
          {servers.data.items.map(server => (
            <ItemGrid.Item
              key={server.id}
              entity={{ id: server.id, hasUsage: true }}
              title={server.name}
              description={
                server.description.slice(0, 100) +
                (server.description.length > 100 ? '...' : '')
              }
              height={250}
              icon={
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar
                    entity={{
                      name: server.profile?.name ?? server.vendor?.name ?? server.name,
                      photoUrl: server.imageUrl
                    }}
                    size={30}
                  />

                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    {server.profile?.isMetorial || server.isMetorial ? (
                      <Badge size="1" color="blue">
                        From Metorial
                      </Badge>
                    ) : (
                      (server.profile?.isOfficial || server.isOfficial) && (
                        <Badge size="1" color="blue">
                          Official
                        </Badge>
                      )
                    )}

                    {(server.profile?.isVerified || server.isVerified) && (
                      <Badge size="1" color="blue">
                        <RiCheckLine size={12} style={{ marginRight: 3 }} /> Verified
                      </Badge>
                    )}
                  </div>
                </div>
              }
              onClick={() =>
                navigate(
                  Paths.instance.server(
                    instance.data?.organization,
                    instance.data?.project,
                    instance.data,
                    server.server.id
                  )
                )
              }
              bottom={
                <Categories>
                  {server.categories.map(category => (
                    <Category key={category.id}>{category.name}</Category>
                  ))}
                </Categories>
              }
            />
          ))}
        </ItemGrid.Root>
      )}

      {servers.data.items.length == 0 && (
        <Text size="2" color="gray600">
          No servers found
        </Text>
      )}
    </>
  ));
};
