'use client';

import { motion } from 'motion/react';
import React from 'react';
import styled from 'styled-components';
import { useScrollDirection } from '../../hooks/use-scroll-direction';
import { Header } from './header';

let RootWrapper = styled(motion.div)`
  position: sticky;
  top: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  z-index: 999;
`;

export let NavRoot = ({ children }: { children: React.ReactNode }) => {
  let { isScrolledDelayed } = useScrollDirection();

  return (
    <RootWrapper
      animate={
        isScrolledDelayed
          ? {
              y: '-40px'
            }
          : {
              y: 0
            }
      }
      transition={{
        ease: 'easeInOut'
      }}
    >
      <Header />

      {children}
    </RootWrapper>
  );
};
