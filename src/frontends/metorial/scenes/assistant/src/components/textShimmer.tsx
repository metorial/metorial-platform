import React from 'react';
import styled, { keyframes } from 'styled-components';

let shimmer = keyframes`
  0% {
    background-position: -200% 0;
  }

  100% {
    background-position: 200% 0;
  }
`;

let BaseText = styled.span`
  display: inline-block;
  font-size: 13px;
  color: #999;
`;

let ShimmerText = styled(BaseText)`
  display: inline-block;
  position: relative;
  color: #999;
`;

let ShimmerOverlay = styled(BaseText)`
  position: absolute;
  inset: 0;
  color: transparent;
  background-image: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0) 0%,
    rgba(255, 255, 255, 0) 40%,
    rgba(255, 255, 255, 0.95) 50%,
    rgba(255, 255, 255, 0) 60%,
    rgba(255, 255, 255, 0) 100%
  );
  background-size: 200% 100%;
  background-repeat: no-repeat;
  background-clip: text;
  -webkit-background-clip: text;
  animation: ${shimmer} 2s linear infinite;
  pointer-events: none;
`;

export let TextShimmer = (p: { children: React.ReactNode; className?: string }) => {
  return (
    <ShimmerText className={p.className}>
      {p.children}
      <ShimmerOverlay aria-hidden="true">{p.children}</ShimmerOverlay>
    </ShimmerText>
  );
};
