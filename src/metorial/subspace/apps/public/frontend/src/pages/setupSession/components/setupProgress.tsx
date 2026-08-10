import { Flex, Text, Title, theme } from '@metorial/ui';
import { RiCheckLine } from '@remixicon/react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';
import styled, { keyframes } from 'styled-components';
import type { Brand } from '../types';

let completedColor = '#10b981';
let inactiveColor = '#e5e5e5';
let activeColor = '#1a1a1a';
let mutedTextColor = '#999';

let chevronPulse = keyframes`
  0%, 100% {
    opacity: 0.3;
  }
  50% {
    opacity: 1;
  }
`;

let HeaderWrapper = styled.div<{ $align: 'center' | 'start' }>`
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

let BrandIcon = styled.img`
  width: 48px;
  height: 48px;
  border-radius: 12px;
  object-fit: contain;
  background: white;
`;

let ProviderIcon = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
`;

let Chevrons = styled.div<{ $align: 'center' | 'start' }>`
  display: flex;
  align-items: center;
  gap: 2px;
  color: ${p => (p.$align === 'center' ? theme.colors.gray600 : 'rgba(0, 0, 0, 0.45)')};
`;

let ChevronSvg = styled.svg<{ $delay: number }>`
  animation: ${chevronPulse} 1.5s ease-in-out infinite;
  animation-delay: ${p => p.$delay}s;
`;

let HeaderText = styled.div<{ $align: 'center' | 'start' }>`
  display: flex;
  flex-direction: column;
  align-items: ${p => (p.$align === 'center' ? 'center' : 'flex-start')};
  text-align: ${p => (p.$align === 'center' ? 'center' : 'left')};
`;

let HeaderTitle = styled(Title)`
  text-wrap: balance;
`;

let StepIndicator = styled(Flex)<{ $size: 'sm' | 'md' }>`
  padding: ${p => (p.$size === 'sm' ? '16px 32px' : '0')};
  margin-bottom: ${p => (p.$size === 'sm' ? '0' : '32px')};

  @media (max-width: 640px) {
    margin-bottom: ${p => (p.$size === 'sm' ? '0' : '24px')};
  }
`;

let StepLabel = styled(Text)<{ $isCompleted: boolean; $isActive: boolean }>`
  white-space: nowrap;
  color: ${p => (p.$isCompleted ? completedColor : p.$isActive ? activeColor : mutedTextColor)};

  @media (max-width: 480px) {
    display: none;
  }
`;

let StepConnector = styled.div<{ $isCompleted: boolean }>`
  flex: 1;
  height: 2px;
  margin: 0 12px;
  background: ${p => (p.$isCompleted ? completedColor : inactiveColor)};
  transition: background 0.2s;

  @media (max-width: 480px) {
    margin: 0 8px;
  }
`;

let StepCircle = styled.div<{
  $isCompleted: boolean;
  $isActive: boolean;
  $size: 'sm' | 'md';
}>`
  width: ${p => (p.$size === 'sm' ? 24 : 28)}px;
  height: ${p => (p.$size === 'sm' ? 24 : 28)}px;
  border-radius: 50%;
  font-size: ${p => (p.$size === 'sm' ? 12 : 13)}px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  background: ${p =>
    p.$isCompleted ? completedColor : p.$isActive ? activeColor : inactiveColor};
  color: ${p => (p.$isCompleted || p.$isActive ? 'white' : mutedTextColor)};
`;

let ChevronIcon = ({ delay = 0 }: { delay?: number }) => (
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

interface SetupBrandHeaderProps {
  brand: Brand;
  providerName?: string | null;
  providerImageUrl?: string | null;
  align?: 'center' | 'start';
  title?: string;
}

export let SetupBrandHeader = ({
  brand,
  providerName,
  providerImageUrl,
  align = 'center',
  title
}: SetupBrandHeaderProps) => {
  return (
    <HeaderWrapper $align={align}>
      <IconsRow>
        <BrandIcon src={brand.imageUrl} alt={brand.name} />

        <AnimatePresence>
          {providerImageUrl && (
            <motion.div initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }}>
              <IconsRow style={{ overflow: 'hidden' }}>
                <Chevrons $align={align}>
                  <ChevronIcon delay={0} />
                  <ChevronIcon delay={0.3} />
                  <ChevronIcon delay={0.6} />
                </Chevrons>
                <ProviderIcon
                  style={{
                    background: `url(${providerImageUrl}) center/contain no-repeat`
                  }}
                />
              </IconsRow>
            </motion.div>
          )}
        </AnimatePresence>
      </IconsRow>

      <HeaderText $align={align}>
        <HeaderTitle size="5" weight="bold">
          {title ?? (providerName ? `Connect to ${providerName}` : 'Choose a provider')}
        </HeaderTitle>
      </HeaderText>
    </HeaderWrapper>
  );
};

interface SetupProgressIndicatorProps {
  currentStep: number;
  stepLabels: string[];
  size?: 'sm' | 'md';
  className?: string;
}

export let SetupProgressIndicator = ({
  currentStep,
  stepLabels,
  size = 'md',
  className
}: SetupProgressIndicatorProps) => {
  if (stepLabels.length <= 1) return null;

  return (
    <StepIndicator align="center" $size={size} className={className}>
      {stepLabels.map((label, index) => {
        let isActive = index === currentStep;
        let isCompleted = index < currentStep;
        let isLast = index === stepLabels.length - 1;

        return (
          <Flex key={label} align="center" style={{ flex: isLast ? 0 : 1 }}>
            <Flex align="center" gap={8}>
              <StepCircle $isCompleted={isCompleted} $isActive={isActive} $size={size}>
                {isCompleted ? <RiCheckLine size={size === 'sm' ? 12 : 14} /> : index + 1}
              </StepCircle>
              <StepLabel size="1" weight="medium" $isCompleted={isCompleted} $isActive={isActive}>
                {label}
              </StepLabel>
            </Flex>
            {!isLast && <StepConnector $isCompleted={isCompleted} />}
          </Flex>
        );
      })}
    </StepIndicator>
  );
};

interface SetupProgressFrameProps {
  progress?: ReactNode;
  children: ReactNode;
}

export let SetupProgressFrame = ({ progress, children }: SetupProgressFrameProps) => {
  return (
    <>
      {progress}
      <div>{children}</div>
    </>
  );
};
