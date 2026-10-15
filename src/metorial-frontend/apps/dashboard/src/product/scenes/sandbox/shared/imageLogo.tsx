import { theme } from '@metorial/ui';
import { ProviderImage } from '@metorial/ui-product';
import { RiBox3Line } from '@remixicon/react';
import styled from 'styled-components';
import { detectImageLogo } from '../lib/imageLogo';

let FallbackTile = styled.div<{ $size: number; $radius: number }>`
  width: ${p => p.$size}px;
  height: ${p => p.$size}px;
  border-radius: ${p => p.$radius}px;
  background: ${theme.colors.gray200};
  border: 1px solid ${theme.colors.gray400};
  color: ${theme.colors.gray600};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;

export let SandboxImageLogo = ({
  image,
  size = 24,
  radius
}: {
  image: string | { name?: string | null; identifier?: string | null } | null | undefined;
  size?: number;
  radius?: number;
}) => {
  let logo = detectImageLogo(image);
  let resolvedRadius = radius ?? Math.round(size / 4);

  if (logo) {
    return (
      <ProviderImage imageUrl={logo.url} alt={logo.name} size={size} radius={resolvedRadius} />
    );
  }

  return (
    <FallbackTile $size={size} $radius={resolvedRadius} aria-hidden>
      <RiBox3Line size={Math.max(12, Math.round(size * 0.55))} />
    </FallbackTile>
  );
};
