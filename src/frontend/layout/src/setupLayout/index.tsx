import { Spacer, Text, Title } from '@metorial/ui';
import { AnimatePresence, motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import React from 'react';
import { styled } from 'styled-components';
import { InnerLayout } from './inner';
import { useDelayNavigation } from './useDelayNavigation';

let AnimatedInner = styled(motion.div)`
  display: flex;
  flex-direction: column;
  justify-content: center;
`;

let StaggerItem = styled(motion.div)`
  width: 100%;
  min-width: 0;
`;

let isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

export let SetupLayout = ({
  children,
  main,
  animation = 'scale',
  duration: durationProp,
  staggerDelay = 0.06,
  navigationDelay,
  animationKey
}: {
  children: React.ReactNode;

  backgroundUrl?: string;

  main?: {
    title: string;
    description?: string;
  };

  animation?: 'scale' | 'fade' | 'stagger';
  duration?: number;
  staggerDelay?: number;
  navigationDelay?: number;
  animationKey?: React.Key;
}) => {
  let duration = durationProp ?? (animation == 'stagger' ? 0.55 : 0.4);
  let childItems = React.Children.toArray(children);
  let staggerItemCount =
    (main?.title ? 1 : 0) + (main?.description ? 1 : 0) + childItems.length;
  let staggerNavigationDelay = Math.ceil(
    (duration + staggerDelay * Math.max(staggerItemCount - 1, 0) + 0.05) * 1000
  );
  let hidden = useDelayNavigation(
    navigationDelay ?? (animation == 'stagger' ? staggerNavigationDelay : 400)
  );
  let staggerItemVariants: Variants = {
    hidden: {
      opacity: 0,
      y: 14,
      filter: isSafari ? undefined : 'blur(5px)'
    },
    visible: {
      opacity: 1,
      y: 0,
      filter: isSafari ? undefined : 'blur(0px)',
      transition: { duration, ease: 'easeOut' }
    },
    exit: {
      opacity: 0,
      y: -10,
      filter: isSafari ? undefined : 'blur(5px)',
      transition: { duration, ease: 'easeInOut' }
    }
  };

  let renderStaggerContent = () => (
    <AnimatedInner
      key={animationKey}
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={{
        hidden: {
          transition: {
            staggerChildren: staggerDelay,
            staggerDirection: -1
          }
        },
        visible: {
          transition: {
            delayChildren: 0.08,
            staggerChildren: staggerDelay
          }
        },
        exit: {
          transition: {
            staggerChildren: staggerDelay,
            staggerDirection: -1
          }
        }
      }}
    >
      <StaggerItem variants={staggerItemVariants}>
        <Title as="h1" size="5" weight="bold">
          {main!.title}
        </Title>
      </StaggerItem>

      {main!.description && (
        <StaggerItem variants={staggerItemVariants}>
          <Spacer size={5} />
          <Text size="3" color="gray700" weight="medium">
            {main!.description}
          </Text>
        </StaggerItem>
      )}

      {childItems.map((child, idx) => (
        <StaggerItem
          key={React.isValidElement(child) ? child.key : idx}
          variants={staggerItemVariants}
        >
          {idx == 0 && <Spacer size={25} />}
          {child}
        </StaggerItem>
      ))}
    </AnimatedInner>
  );

  return (
    <InnerLayout>
      <AnimatePresence mode="wait">
        {!hidden && main && animation == 'stagger' && renderStaggerContent()}
        {!hidden && main && animation != 'stagger' && (
          <AnimatedInner
            key={animationKey}
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
