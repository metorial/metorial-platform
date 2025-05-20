'use client';

import { Entity, RenderDate, Text } from '@metorial/ui';
import styled from 'styled-components';
import { ServerListing, ServerVersion } from '../../../../../../state/server';

let Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 15px;
`;

export let VersionsPageClient = ({
  server,
  versions
}: {
  server: ServerListing;
  versions: ServerVersion[];
}) => {
  return (
    <Wrapper>
      {versions.length === 0 && (
        <Text>Metorial has not found any versions for this server.</Text>
      )}

      {versions.map(version => (
        <Entity.Wrapper key={version.id}>
          <Entity.Content>
            <Entity.Field title={version.identifier.slice(0, 20)} />
            <Entity.Field title="Added" value={<RenderDate date={version.createdAt} />} />
          </Entity.Content>
        </Entity.Wrapper>
      ))}
    </Wrapper>
  );
};
