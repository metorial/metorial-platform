import { Spacer, Text, Title } from '@metorial/ui';
import { AnimatePresence, motion } from 'framer-motion';
import React from 'react';
import { styled } from 'styled-components';
import { InnerLayout } from './inner';
import { useDelayNavigation } from './useDelayNavigation';

let AnimatedInner = styled(motion.div)`
  display: flex;
  flex-direction: column;
  justify-content: center;
`;

let isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

export let SetupLayout = ({
  children,
  main,
  animation = 'scale',
  duration = 0.4
}: {
  children: React.ReactNode;

  backgroundUrl?: string;

  main?: {
    title: string;
    description?: string;
  };

  animation?: 'scale' | 'fade';
  duration?: number;
}) => {
  let hidden = useDelayNavigation(400);

  return (
    <InnerLayout>
      <AnimatePresence>
        {!hidden && main && (
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
            <Title as="h1" size="5" weight="bold">
              {main.title}
            </Title>
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
