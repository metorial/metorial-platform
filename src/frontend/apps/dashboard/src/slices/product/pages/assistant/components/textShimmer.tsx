import { theme } from '@metorial/ui';
import React from 'react';
import styled, { keyframes } from 'styled-components';

let shimmer = keyframes`
  0% {
    background-position: 200% 0;
  }

  100% {
    background-position: -200% 0;
  }
`;

let ShimmerText = styled.span`
  color: transparent;
  background-image: linear-gradient(
    90deg,
    ${theme.colors.gray700} 0%,
    ${theme.colors.foreground} 50%,
    ${theme.colors.gray700} 100%
  );
  background-size: 200% 100%;
  background-clip: text;
  -webkit-background-clip: text;
  animation: ${shimmer} 1.4s linear infinite;
`;

export let TextShimmer = (p: { children: React.ReactNode; className?: string }) => {
  return <ShimmerText className={p.className}>{p.children}</ShimmerText>;
};
