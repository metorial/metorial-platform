'use client';

import { useInterval, useIsSSR } from '@looped/hooks';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { useWindowScroll, useWindowSize } from 'react-use';
import styled from 'styled-components';
import { LandingButton } from '../../../components/button';

let Wrapper = styled(motion.div)`
  position: fixed;
  bottom: 20px;
  left: 50%;
  width: min(calc(100% - 50px), 600px);
  padding: 0px 8px 0px 20px;
  background-color: rgba(0, 0, 0, 0.7);
  box-shadow: 0px 4px 20px rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(10px);
  border-radius: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  z-index: 100;
`;

let Text = styled(motion.p)`
  color: white;
  font-size: 14px;
  font-weight: 500;
  position: absolute;
  left: 20px;
  top: 0;
  bottom: 0;
  display: inline-flex;
  align-items: center;
  max-width: calc(100% - 180px);

  @media (max-width: 600px) {
    font-size: 12px;
  }
`;

export let EarlyAccessBar = () => {
  let [visible, setVisible] = useState(false);
  let [index, setIndex] = useState(0);

  let scroll = useWindowScroll();
  let size = useWindowSize();
  let isSSR = useIsSSR();

  let isAtBottom = useMemo(() => {
    if (typeof window === 'undefined' || isSSR) return false;
    return scroll.y + size.height >= document.body.scrollHeight - 250;
  }, [scroll, size, isSSR]);

  useEffect(() => {
    let timer = setTimeout(() => setVisible(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  let texts = [
    'Thousands of MCP servers in a single function call.',
    'The MCP platform for AI developers.',
    'Build AI applications with ease using MCP.'
  ];

  useInterval(() => {
    if (visible) setIndex(prev => (prev + 1) % texts.length);
  }, 5000);

  return (
    <AnimatePresence>
      {visible && !isAtBottom && (
        <Wrapper
          initial={{ opacity: 0, bottom: -20, x: '-50%', scale: 0.98, filter: 'blur(10px)' }}
          animate={{ opacity: 1, bottom: 20, x: '-50%', scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, bottom: 10, x: '-50%', scale: 0.6, filter: 'blur(20px)' }}
          transition={{ ease: 'anticipate', duration: 0.4 }}
          data-visible={visible.toString()}
        >
          <div>
            <AnimatePresence>
              <Text
                key={index}
                initial={{ opacity: 0, y: 25 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -25 }}
                transition={{ duration: 0.5 }}
              >
                {texts[index]}
              </Text>
            </AnimatePresence>
          </div>

          <a
            href="https://auth.metorial.com/signup?nextUrl=https%3A%2F%2Fapp.metorial.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            <LandingButton variant="white" as="span">
              Get Started
            </LandingButton>
          </a>
        </Wrapper>
      )}
    </AnimatePresence>
  );
};
