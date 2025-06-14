'use client';

import styled from 'styled-components';
import { Card, Carousel } from '../../../../components/cards-carousel';
import { ServerCategory, ServerCollection, ServerListing } from '../../../../state/server';

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
  servers
}: {
  group: ServerCategory | ServerCollection;
  servers: ServerListing[];
}) => {
  return (
    <CategoriesSectionWrapper>
      <CategoriesSectionHeading>{group.name}</CategoriesSectionHeading>
      <Carousel
        items={servers.map((server, index) => (
          <Card
            key={server.id}
            card={{
              category: server.vendor?.name ?? 'External',
              title: server.name,
              src: `https://avatar-cdn.metorial.com/${server.id}`
            }}
            index={index}
            href={`/marketplace/s/${server.slug}`}
          />
        ))}
      />
    </CategoriesSectionWrapper>
  );
};
