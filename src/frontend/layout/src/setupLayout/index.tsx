import { Spacer, Text, Title } from '@metorial/ui';
import { AnimatePresence, motion } from 'framer-motion';
import React from 'react';
import { styled } from 'styled-components';
import { TextSparkle } from './textSparkle';
import { useDelayNavigation } from './useDelayNavigation';

let Wrapper = styled.div`
  height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  background: white;
`;

let Inner = styled(motion.div)`
  display: flex;
  min-height: 100%;
  width: 100%;
  background: linear-gradient(90deg, rgba(240, 240, 240, 1) 0%, rgba(255, 255, 255, 1) 100%);
`;

let Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  /* gap: 50px; */
  width: 100%;

  @media (max-width: 1000px) {
    grid-template-columns: 100%;
  }
`;

let Side = styled(motion.section)`
  display: flex;
  flex-direction: column;
  justify-content: center;
  margin: 25px;
  background: white;
  border-radius: 10px;
  box-shadow: rgba(0, 0, 0, 0.15) 4px 4px 10px;

  &:not(:last-of-type) {
    margin-right: 0px;
  }

  &.desktop {
    @media (max-width: 1000px) {
      display: none;
    }
  }
`;

let ImageHighlight = styled.img`
  height: 100%;
  width: 100%;
  object-fit: cover;
  border-radius: 10px;
`;

let AnimatedInner = styled(motion.div)`
  display: flex;
  flex-direction: column;
  justify-content: center;
`;

let isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

export let SetupLayout = ({
  children,
  backgroundUrl,
  main
}: {
  children: React.ReactNode;

  backgroundUrl: string;

  main?: {
    title: string;
    description: string;
  };
}) => {
  let hidden = useDelayNavigation(400);

  return (
    <Wrapper>
      <Inner>
        <Grid>
          <Side className="aside padded desktop" style={{ alignItems: 'center' }}>
            <ImageHighlight src={backgroundUrl} />
          </Side>

          <Side style={{ padding: '50px' }}>
            <AnimatePresence>
              {!hidden && main && (
                <AnimatedInner
                  initial={{
                    opacity: 0,
                    scale: 0.9,
                    filter: isSafari ? undefined : 'blur(5px)'
                  }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                    filter: isSafari ? undefined : 'blur(0px)'
                  }}
                  exit={{
                    opacity: 0,
                    scale: 1.2,
                    filter: isSafari ? undefined : 'blur(5px)'
                  }}
                  transition={{ duration: 0.4, ease: 'anticipate' }}
                >
                  <TextSparkle>
                    <Title as="h1" size="5" weight="bold">
                      {main.title}
                    </Title>
                  </TextSparkle>
                  <Spacer size={5} />
                  <Text size="3" color="gray700" weight="medium">
                    {main.description}
                  </Text>
                  <Spacer size={25} />

                  {children}
                </AnimatedInner>
              )}
            </AnimatePresence>
          </Side>
        </Grid>
      </Inner>
    </Wrapper>
  );
};
