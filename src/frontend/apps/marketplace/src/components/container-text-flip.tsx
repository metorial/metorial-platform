'use client';

import { motion } from 'motion/react';
import React, { useEffect, useId, useState } from 'react';
import styled from 'styled-components';
import { cn } from '../lib/utils';

let FlipContainer = styled(motion.span)`
  position: relative;
  display: inline-block;
  border-radius: 0.5rem;
  text-align: center;
  font-size: 2.25rem;
  font-weight: 700;
  color: black;
  background: linear-gradient(to bottom, #efefef, #ddd);
  box-shadow:
    inset 0 -1px #ccc,
    inset 0 0 0 1px #ccc,
    0 4px 8px #ccc;

  @media (min-width: 768px) {
    font-size: 6rem;
  }
`;

let WordWrapper = styled(motion.span)`
  display: inline-block;
`;

let LetterWrapper = styled(motion.span)`
  display: inline-block;
`;

export function ContainerTextFlip({
  words,
  interval = 3000,
  className,
  textClassName,
  animationDuration = 700
}: {
  words: string[];
  interval?: number;
  className?: string;
  textClassName?: string;
  animationDuration?: number;
}) {
  let id = useId();
  let [currentWordIndex, setCurrentWordIndex] = useState(0);
  let [width, setWidth] = useState(100);
  let textRef = React.useRef(null);

  let updateWidthForWord = () => {
    if (textRef.current) {
      // Add some padding to the text width (30px on each side)
      // @ts-ignore
      let textWidth = textRef.current.scrollWidth + 60;
      setWidth(textWidth);
    }
  };

  useEffect(() => {
    // Update width whenever the word changes
    updateWidthForWord();
  }, [currentWordIndex]);

  useEffect(() => {
    let intervalId = setInterval(() => {
      setCurrentWordIndex(prevIndex => (prevIndex + 1) % words.length);
      // Width will be updated in the effect that depends on currentWordIndex
    }, interval);

    return () => clearInterval(intervalId);
  }, [words, interval]);

  return (
    <FlipContainer
      layout
      layoutId={`words-here-${id}`}
      animate={{ width }}
      transition={{ duration: animationDuration / 2000 }}
      className={cn(className)}
      key={words[currentWordIndex]}
    >
      <WordWrapper
        transition={{
          duration: animationDuration / 1000,
          ease: 'easeInOut'
        }}
        className={cn(textClassName)}
        ref={textRef}
        layoutId={`word-div-${words[currentWordIndex]}-${id}`}
      >
        <LetterWrapper>
          {words[currentWordIndex].split('').map((letter, index) => (
            <motion.span
              key={index}
              initial={{
                opacity: 0,
                filter: 'blur(10px)'
              }}
              animate={{
                opacity: 1,
                filter: 'blur(0px)'
              }}
              transition={{
                delay: index * 0.02
              }}
              style={{ display: 'inline-block' }}
            >
              {letter}
            </motion.span>
          ))}
        </LetterWrapper>
      </WordWrapper>
    </FlipContainer>
  );
}
