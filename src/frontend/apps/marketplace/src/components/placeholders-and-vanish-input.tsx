'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';

let FormWrapper = styled.form.withConfig({
  shouldForwardProp: prop => !['hasValue'].includes(prop)
})<{ hasValue: boolean }>`
  width: 100%;
  position: relative;
  max-width: 36rem;
  margin-left: auto;
  margin-right: auto;
  background-color: #ffffff;
  border: 1px solid #ddd;
  color: inherit;
  height: 3rem;
  border-radius: 9999px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transition: background-color 0.2s;
`;

let InputField = styled.input`
  width: 100%;
  position: relative;
  font-size: 0.875rem;
  z-index: 50;
  border: none;
  color: black;
  background: transparent;
  height: 100%;
  border-radius: 9999px;
  padding-left: 1rem;
  padding-right: 5rem;
  outline: none;

  @media (min-width: 640px) {
    font-size: 1rem;
    padding-left: 1.75rem;
  }

  &:focus {
    outline: none;
    box-shadow: none;
  }
`;

let SubmitButton = styled.button`
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  z-index: 50;
  height: 2rem;
  width: 2rem;
  border-radius: 9999px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
  background-color: black;

  &:disabled {
    background-color: #ddd;
  }
`;

let PlaceholderWrapper = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  border-radius: 9999px;
  pointer-events: none;
`;

let PlaceholderText = styled(motion.p)`
  color: #999;
  font-size: 0.875rem;
  font-weight: 400;
  padding-left: 1rem;
  text-align: left;
  width: calc(100% - 2rem);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  @media (min-width: 640px) {
    font-size: 1rem;
    padding-left: 1.75rem;
  }
`;

let SubmitIcon = styled(motion.svg)`
  color: white;
  height: 1rem;
  width: 1rem;
`;

export let PlaceholdersAndVanishInput = ({
  placeholders,
  onChange,
  onSubmit,
  initialValue
}: {
  placeholders: string[];
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  initialValue?: string;
}) => {
  let [currentPlaceholder, setCurrentPlaceholder] = useState(0);

  let intervalRef = useRef<NodeJS.Timeout | null>(null);
  let startAnimation = () => {
    intervalRef.current = setInterval(() => {
      setCurrentPlaceholder(prev => (prev + 1) % placeholders.length);
    }, 3000);
  };
  let handleVisibilityChange = () => {
    if (document.visibilityState !== 'visible' && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    } else if (document.visibilityState === 'visible') {
      startAnimation();
    }
  };

  useEffect(() => {
    startAnimation();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [placeholders]);

  let inputRef = useRef<HTMLInputElement>(null);
  let [value, setValue] = useState(() => initialValue ?? '');

  let handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit && onSubmit(e);
  };

  return (
    <FormWrapper hasValue={!!value} onSubmit={handleSubmit}>
      <InputField
        onChange={e => {
          setValue(e.target.value);
          onChange?.(e);
        }}
        ref={inputRef}
        value={value}
        type="text"
      />

      <SubmitButton disabled={!value} type="submit">
        <SubmitIcon
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path stroke="none" d="M0 0h24v24H0z" fill="none" />
          <motion.path
            d="M5 12l14 0"
            initial={{
              strokeDasharray: '50%',
              strokeDashoffset: '50%'
            }}
            animate={{
              strokeDashoffset: value ? 0 : '50%'
            }}
            transition={{
              duration: 0.3,
              ease: 'linear'
            }}
          />
          <path d="M13 18l6 -6" />
          <path d="M13 6l6 6" />
        </SubmitIcon>
      </SubmitButton>

      <PlaceholderWrapper>
        <AnimatePresence mode="wait">
          {!value && (
            <PlaceholderText
              initial={{
                y: 5,
                opacity: 0
              }}
              key={`current-placeholder-${currentPlaceholder}`}
              animate={{
                y: 0,
                opacity: 1
              }}
              exit={{
                y: -15,
                opacity: 0
              }}
              transition={{
                duration: 0.3,
                ease: 'linear'
              }}
            >
              {placeholders[currentPlaceholder]}
            </PlaceholderText>
          )}
        </AnimatePresence>
      </PlaceholderWrapper>
    </FormWrapper>
  );
};
