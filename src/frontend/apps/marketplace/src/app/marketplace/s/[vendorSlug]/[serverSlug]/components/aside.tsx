'use client';

import { Datalist, theme } from '@metorial/ui';
import styled from 'styled-components';
import { ServerListing } from '../../../../../../state/server';

let Wrapper = styled.aside`
  height: 100%;
  flex-grow: 1;

  @media (max-width: 800px) {
    display: none;
  }
`;

export let ServerAside = ({ server }: { server: ServerListing }) => {
  return (
    <Wrapper>
      <Datalist
        variant="large"
        items={[
          ...(server.vendor
            ? [
                {
                  label: 'Created by',
                  value: server.vendor.name
                }
              ]
            : []),
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
                  href={`/marketplace/servers?category_ids=${category.slug}`}
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
