'use client';

import { Datalist, Spacer, theme } from '@metorial/ui';
import styled from 'styled-components';
import { ServerListing } from '../../../../../../state/server';

let Wrapper = styled.aside`
  height: 100%;

  @media (max-width: 800px) {
    display: none;
  }
`;

export let ServerAside = ({ server }: { server: ServerListing }) => {
  return (
    <Wrapper>
      {/* <DeployBox server={server} /> */}

      <Spacer size={20} />

      <Datalist
        variant="large"
        items={[
          {
            label: 'Repository',
            value: (
              <a
                href={server.repository?.providerUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {server.repository?.identifier.replace('github.com/', '')}
              </a>
            )
          },
          {
            label: 'License',
            value: server.repository?.licenseName ?? 'Unknown'
          },
          {
            label: 'Stars',
            value: server.repository?.starCount ?? '0'
          },
          {
            label: 'Vendor',
            value: server.vendor?.name
          },
          {
            label: 'Hosted on Metorial',
            value: server.isHostable ? 'Yes' : 'No'
          },
          {
            label: 'Categories',
            value: server.categories.map((category, i) => (
              <span key={category.id}>
                {i > 0 && <span style={{ color: theme.colors.gray600 }}>, </span>}

                <a
                  key={category.id}
                  href={`/servers?category_ids=${category.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'inherit' }}
                >
                  {category.name}
                </a>
              </span>
            ))
          }
        ]}
      />
    </Wrapper>
  );
};
