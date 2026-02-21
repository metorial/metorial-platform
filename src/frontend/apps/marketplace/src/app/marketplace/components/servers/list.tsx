'use client';

import { styled } from 'styled-components';
import { ProviderListing } from '../../../../state/provider';
import { ProviderEntry } from './entry';

let Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;

  @media (min-width: 800px) {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  }
`;

export let ProviderList = ({ providerListings }: { providerListings: ProviderListing[] }) => {
  return (
    <Wrapper>
      {providerListings.map(providerListing => (
        <ProviderEntry key={providerListing.id} providerListing={providerListing} />
      ))}
    </Wrapper>
  );
};
