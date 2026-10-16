import { Title, theme } from '@metorial/ui';
import { AnimatePresence, motion } from 'framer-motion';
import styled, { keyframes } from 'styled-components';
import type { Brand } from '../state/types';

type Align = 'center' | 'start';

let chevronPulse = keyframes`
  0%, 100% {
    opacity: 0.3;
  }

  50% {
    opacity: 1;
  }
`;

let Wrapper = styled.div<{ $align: Align }>`
  display: flex;
  flex-direction: column;
  align-items: ${p => (p.$align === 'center' ? 'center' : 'flex-start')};
  gap: 16px;
`;

let IconsRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

let ProviderIconsRow = styled(IconsRow)`
  overflow: hidden;
`;

let Icon = styled.img`
  width: 48px;
  height: 48px;
  border-radius: 12px;
  object-fit: contain;
  background: ${theme.colors.background};
`;

let Chevrons = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
  color: ${theme.colors.gray600};
`;

let ChevronSvg = styled.svg<{ $delay: number }>`
  animation: ${chevronPulse} 1.5s ease-in-out infinite;
  animation-delay: ${p => p.$delay}s;
`;

let HeaderTitle = styled(Title)<{ $align: Align }>`
  text-align: ${p => (p.$align === 'center' ? 'center' : 'left')};
  text-wrap: balance;
`;

let Chevron = ({ delay }: { delay: number }) => (
  <ChevronSvg $delay={delay} width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path
      d="M6 4L10 8L6 12"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </ChevronSvg>
);

export let BrandHeader = ({
  brand,
  providerName,
  providerImageUrl,
  align,
  title
}: {
  brand: Brand;
  providerName?: string | null;
  providerImageUrl?: string | null;
  align: Align;
  title?: string;
}) => (
  <Wrapper $align={align}>
    <IconsRow>
      <Icon src={brand.imageUrl} alt={brand.name} />

      <AnimatePresence>
        {providerImageUrl && (
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
          >
            <ProviderIconsRow>
              <Chevrons>
                <Chevron delay={0} />
                <Chevron delay={0.3} />
                <Chevron delay={0.6} />
              </Chevrons>

              <Icon src={providerImageUrl} alt={providerName ?? ''} />
            </ProviderIconsRow>
          </motion.div>
        )}
      </AnimatePresence>
    </IconsRow>

    <HeaderTitle size="5" weight="bold" $align={align}>
      {title ?? (providerName ? `Connect to ${providerName}` : 'Choose a provider')}
    </HeaderTitle>
  </Wrapper>
);
