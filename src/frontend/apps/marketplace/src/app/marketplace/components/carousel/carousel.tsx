'use client';

import styled from 'styled-components';
import { Card, Carousel } from '../../../../components/cards-carousel';
import { ProviderCategory, ProviderCollection, ProviderListing } from '../../../../state/provider';

export let CategoriesSectionWrapper = styled.div`
  width: 100%;
  height: 100%;
  padding: 2.5rem 0;
  margin-bottom: 2.5rem;
`;

export let CategoriesSectionHeading = styled.h2`
  max-width: 80rem;
  padding-left: 1rem;
  margin: 0 auto 1.25rem;
  font-size: 1.25rem;
  font-weight: 600;
  color: #333;

  @media (min-width: 768px) {
    font-size: 1.875rem;
  }
`;

export let ServerCarouselWithGroup = ({
  group,
  providerListings
}: {
  group: ProviderCategory | ProviderCollection;
  providerListings: ProviderListing[];
}) => {
  return (
    <CategoriesSectionWrapper>
      <CategoriesSectionHeading>{group.name}</CategoriesSectionHeading>
      <Carousel
        items={providerListings.map((provider, index) => (
          <Card
            key={provider.id}
            card={{
              // category: server.vendor?.name ?? 'External',
              title: provider.name,
              src: `https://avatar-cdn.metorial.com/${provider.id}`
            }}
            index={index}
            href={`/marketplace/s/${provider.slug}`}
          />
        ))}
      />
    </CategoriesSectionWrapper>
  );
};
