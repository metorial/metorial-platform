'use client';

import { Datalist, theme } from '@metorial/ui';
import styled from 'styled-components';
import { ProviderListing } from '../../../../../../state/provider';

let Wrapper = styled.aside`
  height: 100%;
  flex-grow: 1;

  @media (max-width: 800px) {
    display: none;
  }
`;

export let ProviderAside = ({ providerListing }: { providerListing: ProviderListing }) => {
  return (
    <Wrapper>
      <Datalist
        variant="large"
        items={[
          ...(providerListing.vendor
            ? [
                {
                  label: 'Created by',
                  value: providerListing.vendor.name
                }
              ]
            : []),
          {
            label: 'Hosted on Metorial',
            value: providerListing.isHostable ? 'Yes' : 'No'
          },
          {
            label: 'Categories',
            value: providerListing.categories.map((category, i) => (
              <span key={category.id}>
                {i > 0 && <span style={{ color: theme.colors.gray600 }}>, </span>}

                <a
                  key={category.id}
                  href={`/marketplace/providers?category_ids=${category.slug}`}
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
