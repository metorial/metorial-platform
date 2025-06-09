'use client';

import { useInterval } from '@looped/hooks';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { LandingButton } from '../../../components/button';

let Wrapper = styled(motion.div)`
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
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
      {visible && (
        <Wrapper
          initial={{ opacity: 0, bottom: -10 }}
          animate={{ opacity: 1, bottom: 20 }}
          transition={{ ease: 'anticipate' }}
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
            href="https://metorial.com/early-access"
            target="_blank"
            rel="noopener noreferrer"
          >
            <LandingButton variant="white" as="span">
              Get early access
            </LandingButton>
          </a>
        </Wrapper>
      )}
    </AnimatePresence>
  );
};
