import { Text, theme } from '@metorial/ui';
import React from 'react';
import styled from 'styled-components';

let Wrapper = styled.div<{ $size: number; $radius: number }>`
  width: ${p => p.$size}px;
  height: ${p => p.$size}px;
  border-radius: ${p => p.$radius}px;
  background: ${theme.colors.gray200};
  border: 1px solid ${theme.colors.gray400};
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
`;

let Img = styled.img`
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
`;

export let ProviderImage = ({
  imageUrl,
  alt,
  size = 24,
  radius
}: {
  imageUrl?: string | null;
  alt: string;
  size?: number;
  radius?: number;
}) => {
  let resolvedRadius = radius ?? Math.round(size / 4);

  if (!imageUrl) {
    return (
      <Wrapper $size={size} $radius={resolvedRadius}>
        <Text size="1" weight="strong" color="gray600">
          {alt.slice(0, 1).toUpperCase()}
        </Text>
      </Wrapper>
    );
  }

  return (
    <Wrapper $size={size} $radius={resolvedRadius}>
      <Img src={imageUrl} alt={alt} />
    </Wrapper>
  );
};
