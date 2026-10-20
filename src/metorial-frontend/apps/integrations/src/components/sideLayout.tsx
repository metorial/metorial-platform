import { Spacer, theme } from '@metorial/ui';
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import styled from 'styled-components';
import type { Brand } from '../state/types';
import { BrandHeader } from './brandHeader';
import { SecuredByFooter } from './securedByFooter';

let isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

let Wrapper = styled.div`
  background: ${theme.colors.gray300};
  height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
`;

let Panel = styled.div`
  box-shadow: ${theme.shadows.medium};
  background: ${theme.colors.background};
  overflow: hidden;
  display: flex;

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
`;

let Scroller = styled.section`
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: 0;
  min-width: 0;
  overflow: auto;
  padding: 50px;
  -webkit-overflow-scrolling: touch;

  @media (max-width: 800px) {
    padding: 40px;
  }
`;

let Content = styled(motion.div)`
  display: flex;
  flex-direction: column;
  justify-content: center;
  margin: auto 0;
`;

let Footer = styled.div`
  display: flex;
  justify-content: center;
  padding-top: 24px;
`;

export let SideLayout = ({
  brand,
  providerName,
  providerImageUrl,
  isWhitelabel,
  hideBrand,
  children
}: {
  brand: Brand;
  providerName?: string | null;
  providerImageUrl?: string | null;
  isWhitelabel?: boolean;
  hideBrand?: boolean;
  children: ReactNode;
}) => (
  <Wrapper>
    <Panel>
      <Scroller>
        <Content
          initial={{ opacity: 0, scale: 0.9, filter: isSafari ? undefined : 'blur(5px)' }}
          animate={{ opacity: 1, scale: 1, filter: isSafari ? undefined : 'blur(0px)' }}
          transition={{ duration: 0.4, ease: 'anticipate' }}
        >
          <BrandHeader
            brand={brand}
            providerName={providerName}
            providerImageUrl={providerImageUrl}
            hideBrand={hideBrand}
            align="start"
          />

          <Spacer size={25} />

          {children}
        </Content>

        {!isWhitelabel && (
          <Footer>
            <SecuredByFooter />
          </Footer>
        )}
      </Scroller>
    </Panel>
  </Wrapper>
);
