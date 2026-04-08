import { Spacer, Text, Title } from '@metorial/ui';
import { AnimatePresence, motion } from 'framer-motion';
import React from 'react';
import { keyframes, styled } from 'styled-components';
import type { Brand } from '../types';

let AnimatedInner = styled(motion.div)`
  display: flex;
  flex-direction: column;
  justify-content: center;
`;

let ProviderHeader = styled.div`
  display: flex;
  flex-direction: column;
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

let chevronPulse = keyframes`
  0%, 100% {
    opacity: 0.3;
  }
  50% {
    opacity: 1;
  }
`;

let Chevrons = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
  color: rgba(0, 0, 0, 0.45);
`;

let ChevronSvg = styled.svg<{ $delay: number }>`
  animation: ${chevronPulse} 1.5s ease-in-out infinite;
  animation-delay: ${p => p.$delay}s;
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

let ProviderIcon = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
`;

let ProviderHeaderText = styled(Title)`
  text-wrap: balance;
`;

let isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

export let SetupLayout = ({
  children,
  main,
  brand,
  providerName,
  providerImageUrl,
  animation = 'scale',
  duration = 0.4
}: {
  children: React.ReactNode;

  backgroundUrl?: string;

  main?: {
    title: string;
    description?: string;
  };
  brand?: Brand;
  providerName?: string | null;
  providerImageUrl?: string | null;

  animation?: 'scale' | 'fade';
  duration?: number;
}) => {
  return (
    <InnerLayout>
      <AnimatePresence>
        {main && (
          <AnimatedInner
            initial={{
              opacity: 0,
              scale: animation == 'scale' ? 0.9 : 1,
              y: animation == 'scale' ? 0 : 20,
              filter: isSafari ? undefined : 'blur(5px)'
            }}
            animate={{
              opacity: 1,
              scale: animation == 'scale' ? 1 : 1,
              y: animation == 'scale' ? 0 : 0,
              filter: isSafari ? undefined : 'blur(0px)'
            }}
            exit={{
              opacity: 0,
              scale: animation == 'scale' ? 1.2 : 1,
              y: animation == 'scale' ? 0 : -20,
              filter: isSafari ? undefined : 'blur(5px)'
            }}
            transition={{ duration, ease: 'anticipate' }}
          >
            {brand ? (
              <>
                <ProviderHeader>
                  <IconsRow>
                    <BrandIcon src={brand.imageUrl} alt={brand.name} />
                    {providerImageUrl ? (
                      <>
                        <Chevrons>
                          <ChevronIcon delay={0} />
                          <ChevronIcon delay={0.3} />
                          <ChevronIcon delay={0.6} />
                        </Chevrons>
                        <ProviderIcon
                          style={{
                            background: `url(${providerImageUrl}) center/contain no-repeat`
                          }}
                        />
                      </>
                    ) : null}
                  </IconsRow>

                  <ProviderHeaderText size="5" weight="bold">
                    {providerName ? `Connect to ${providerName}` : 'Choose a provider'}
                  </ProviderHeaderText>
                </ProviderHeader>
              </>
            ) : (
              <Title as="h1" size="5" weight="bold">
                {main.title}
              </Title>
            )}

            {main.description && (
              <>
                <Spacer size={5} />
                <Text size="3" color="gray700" weight="medium">
                  {main.description}
                </Text>
              </>
            )}
            <Spacer size={25} />

            {children}
          </AnimatedInner>
        )}
      </AnimatePresence>
    </InnerLayout>
  );
};

let Wrapper = styled.div`
  background: #dcc425;
  height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
`;

let Box = styled.div`
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(15px);

  /* important: Box should not be the scroll container */
  overflow: hidden;

  display: flex;
  flex-direction: column;

  @media (max-width: 800px) {
    width: min(600px, calc(100dvw - 40px));
    height: min(700px, 70dvh);
    border-radius: 10px;
  }

  @media (min-width: 800px) {
    position: fixed;
    top: 0;
    left: 0;
    height: 100dvh;
    width: 600px;
    max-width: 70dvw;
  }

  @media (max-width: 1000px) {
    background: white;

    .aside,
    hr {
      display: none;
    }
  }
`;

let Inner = styled.div`
  display: flex;

  /* critical for overflow inside flex children */
  height: 100%;
  min-height: 0;
  min-width: 0;
`;

let Side = styled.section`
  display: flex;
  flex-direction: column;

  width: 100%;

  overflow: auto;
  min-height: 0;
  min-width: 0;

  -webkit-overflow-scrolling: touch;

  &.padded {
    padding: 50px;

    @media (max-width: 800px) {
      padding: 40px;
    }
  }
`;

let Content = styled.div`
  margin: auto 0; /* vertical centering when content is small */
`;

let InnerLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <Wrapper>
      <Box>
        <Inner>
          <Side style={{ background: 'rgba(255, 255, 255, 1)' }} className="padded">
            <Content>{children}</Content>
          </Side>
        </Inner>
      </Box>
    </Wrapper>
  );
};
