'use client';

import { useIsSSR } from '@looped/hooks';
import { Button, CenteredSpinner, Entity, RenderDate, Text } from '@metorial/ui';
import Link from 'next/link';
import styled from 'styled-components';
import { ServerListing, ServerVersion } from '../../../../../../state/server';

let Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 15px;
`;

export let VersionsPageClient = ({
  server,
  versions,
  pagination
}: {
  server: ServerListing;
  versions: ServerVersion[];
  pagination: {
    hasMoreAfter?: boolean;
    hasMoreBefore?: boolean;
  };
}) => {
  let isServer = useIsSSR();

  if (isServer) return <CenteredSpinner />;

  return (
    <>
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

      <div
        style={{
          display: 'flex',
          gap: 15,
          justifyContent: 'flex-end',
          marginTop: 15
        }}
      >
        {pagination.hasMoreBefore && (
          <Link href={`/s/${server.slug}/versions?before=${versions[0]?.id}`}>
            <Button variant="outline" as="span" size="1">
              Previous
            </Button>
          </Link>
        )}

        {pagination.hasMoreAfter && (
          <Link href={`/s/${server.slug}/versions?after=${versions[versions.length - 1]?.id}`}>
            <Button variant="outline" as="span" size="1">
              Next
            </Button>
          </Link>
        )}
      </div>
    </>
  );
};
