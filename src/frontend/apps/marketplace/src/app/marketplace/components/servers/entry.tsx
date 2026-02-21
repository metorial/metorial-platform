'use client';

import { theme } from '@metorial/ui';
import Link from 'next/link';
import { styled } from 'styled-components';
import { ProviderListing } from '../../../../state/provider';
import { RenderMarkdown } from './markdown';

let Wrapper = styled(Link)`
  display: flex;
  flex-direction: column;
  border-radius: 7px;
  overflow: hidden;
  height: 100%;
  background: white;
  position: relative;
  z-index: 2;
  transition: all 0.3s ease;
  padding: 0;
  cursor: pointer;
  text-align: left;
  color: #333;

  &:hover,
  &:focus {
    box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.1);
    border-color: ${theme.colors.primary};
    transform: translateY(-2px) scale(1.01);
  }
`;

let Content = styled.div`
  display: flex;
  flex-direction: column;
  padding: 20px;
  gap: 10px;

  border: solid 1px #eaeaea;
  border-bottom-left-radius: 7px;
  border-bottom-right-radius: 7px;
  border-top: none;

  flex-grow: 1;
`;

let Title = styled.h2`
  font-size: 16px;
  font-weight: 600;
  line-height: 1.5;
`;

let Excerpt = styled.div`
  font-size: 12px;
  font-weight: 500;
  opacity: 0.6;
`;

let ImageOuter = styled.figure`
  width: 100%;
  height: 200px;
  overflow: hidden;
  position: relative;

  svg {
    width: 100%;
  }

  @media screen and (min-width: 768px) {
    &.featured {
      height: 400px;
    }
  }
`;

let Figcaption = styled.figcaption`
  position: absolute;
  bottom: 20px;
  left: 20px;
  background: rgba(0, 0, 0, 0.8);
  padding: 3px 10px 3px 3px;
  display: flex;
  align-items: center;
  gap: 10px;
  border-radius: 5px;
  max-width: calc(100% - 40px);

  span {
    font-size: 12px;
    font-weight: 500;
    color: #ddd;
  }
`;

let FigAvatar = styled.img`
  width: 24px;
  height: 24px;
  border-radius: 4px;
`;

export let ProviderEntry = ({ providerListing }: { providerListing: ProviderListing }) => {
  return (
    <Wrapper
      onClick={() => {
        if (typeof window == 'undefined') return;
      }}
      href={`/marketplace/s/${providerListing.slug}`}
      prefetch={false}
    >
      <ImageOuter
        style={{
          backgroundImage: `url(https://avatar-cdn.metorial.com/${providerListing.id})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        {providerListing.isMetorial ? (
          <Figcaption>
            <FigAvatar
              src={
                providerListing.imageUrl ??
                providerListing.vendor?.imageUrl ??
                `https://avatar-cdn.metorial.com/vendor_${providerListing.id}`
              }
              alt={providerListing.vendor?.name ?? providerListing.name}
            />
            <span>Official</span>
          </Figcaption>
        ) : (
          <Figcaption>
            <FigAvatar
              src={
                providerListing.imageUrl ??
                providerListing.vendor?.imageUrl ??
                `https://avatar-cdn.metorial.com/vendor_${providerListing.id}`
              }
              alt={providerListing.vendor?.name ?? providerListing.name}
            />
            <span>{providerListing.vendor?.name ?? providerListing.slug.split('/').join(' / ')}</span>
          </Figcaption>
        )}
      </ImageOuter>

      <Content>
        <Title>{providerListing.name}</Title>

        {providerListing.description && (
          <Excerpt>
            <RenderMarkdown text={providerListing.description} mode="no-formatting" />
          </Excerpt>
        )}
      </Content>
    </Wrapper>
  );
};
