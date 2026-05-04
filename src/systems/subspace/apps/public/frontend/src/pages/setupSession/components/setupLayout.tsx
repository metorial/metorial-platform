import { Spacer, Title } from '@metorial/ui';
import { AnimatePresence, motion } from 'framer-motion';
import React from 'react';
import { styled } from 'styled-components';
import { SecuredByFooter } from './stepLayout';
import { SetupBrandHeader } from './setupProgress';
import type { Brand } from '../types';

let AnimatedInner = styled(motion.div)`
  display: flex;
  flex-direction: column;
  justify-content: center;
`;

let isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

export let SetupLayout = ({
  children,
  main,
  brand,
  providerName,
  providerImageUrl,
  isWhitelabel,
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
  isWhitelabel?: boolean;

  animation?: 'scale' | 'fade';
  duration?: number;
}) => {
  return (
    <InnerLayout isWhitelabel={isWhitelabel}>
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
              <SetupBrandHeader
                brand={brand}
                providerName={providerName}
                providerImageUrl={providerImageUrl}
                align="start"
              />
            ) : (
              <Title as="h1" size="5" weight="bold">
                {main.title}
              </Title>
            )}

            {/* {main.description && (
              <>
                <Spacer size={5} />
                <Text size="3" color="gray700" weight="medium">
                  {main.description}
                </Text>
              </>
            )} */}
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

let Footer = styled.div`
  display: flex;
  justify-content: center;
  padding-top: 24px;
`;

let InnerLayout = ({
  children,
  isWhitelabel
}: {
  children: React.ReactNode;
  isWhitelabel?: boolean;
}) => {
  return (
    <Wrapper>
      <Box>
        <Inner>
          <Side style={{ background: 'rgba(255, 255, 255, 1)' }} className="padded">
            <Content>{children}</Content>
            {!isWhitelabel && (
              <Footer>
                <SecuredByFooter isMetorialElement logoSize={16} />
              </Footer>
            )}
          </Side>
        </Inner>
      </Box>
    </Wrapper>
  );
};
