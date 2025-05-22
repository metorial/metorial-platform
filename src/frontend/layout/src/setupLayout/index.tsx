import { Spacer, Text, Title } from '@metorial/ui';
import { AnimatePresence, motion } from 'framer-motion';
import React from 'react';
import { styled } from 'styled-components';
import { TextSparkle } from './textSparkle';
import { useDelayNavigation } from './useDelayNavigation';

let Wrapper = styled.div`
  background-color: hsla(321, 100%, 98%, 1);
  background-image:
    radial-gradient(at 37% 72%, hsla(26, 60%, 66%, 1) 0px, transparent 50%),
    radial-gradient(at 82% 63%, hsla(193, 100%, 83%, 1) 0px, transparent 50%),
    radial-gradient(at 9% 14%, hsla(304, 38%, 68%, 1) 0px, transparent 50%);
  background-size: cover;
  background-position: center;
  height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
`;

let Box = styled.div`
  max-width: 70dvw;
  max-height: 70dvh;
  width: 10000px;
  height: 700px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 10px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
  overflow-y: auto;
  overflow-x: hidden;
  /* padding: 50px; */
  display: flex;
  flex-direction: column;

  @media (max-width: 800px) {
    width: 90%;
    height: 90%;
    max-width: unset;
    max-height: unset;
    padding: 20px;
  }

  @media (max-width: 1000px) {
    .aside,
    hr {
      display: none;
    }
  }
`;

let Inner = styled(motion.div)`
  display: flex;
  min-height: 100%;
`;

let Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 50px;
  width: 100%;

  @media (max-width: 1000px) {
    grid-template-columns: 100%;
  }
`;

let Side = styled(motion.section)`
  display: flex;
  flex-direction: column;
  justify-content: center;
`;

let isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

export let SetupLayout = ({
  children,
  imageUrl,
  main
}: {
  children: React.ReactNode;

  imageUrl: string;

  main?: {
    title: string;
    description: string;
  };
}) => {
  let hidden = useDelayNavigation(400);

  return (
    <Wrapper>
      <Box
        style={{
          overflow: hidden ? 'hidden' : undefined
        }}
      >
        <Inner>
          <Grid>
            <Side className="aside" style={{ justifyContent: 'flex-end' }}>
              <img src={imageUrl} style={{ width: '100%' }} />
            </Side>

            <AnimatePresence>
              {!hidden && main && (
                <Side
                  style={{ padding: '50px' }}
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
                  exit={{ opacity: 0, scale: 1.2, filter: isSafari ? undefined : 'blur(5px)' }}
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
                </Side>
              )}
            </AnimatePresence>
          </Grid>
        </Inner>
      </Box>
    </Wrapper>
  );
};
