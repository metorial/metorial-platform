'use client';

import { useIsSSR } from '@looped/hooks';
import { Button, CenteredSpinner, Entity, RenderDate, Text } from '@metorial/ui';
import Link from 'next/link';
import styled from 'styled-components';
import { ProviderListing, ProviderVersion } from '../../../../../../state/provider';

let Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 15px;
`;

export let VersionsPageClient = ({
  providerListing,
  versions,
  pagination
}: {
  providerListing: ProviderListing;
  versions: ProviderVersion[];
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
              <Entity.Field
                title="Added"
                value={<RenderDate date={version.createdAt ?? undefined} />}
              />
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
          <Link
            prefetch={false}
            href={`/marketplace/s/${providerListing.slug}/versions?before=${versions[0]?.id}`}
          >
            <Button variant="outline" as="span" size="1">
              Previous
            </Button>
          </Link>
        )}

        {pagination.hasMoreAfter && (
          <Link
            prefetch={false}
            href={`/marketplace/s/${providerListing.slug}/versions?after=${versions[versions.length - 1]?.id}`}
          >
            <Button variant="outline" as="span" size="1">
              Next
            </Button>
          </Link>
        )}
      </div>
    </>
  );
};
