import { Button, Spacer } from '@metorial/ui';
import React from 'react';
import styled, { keyframes } from 'styled-components';

let moveDots = keyframes`
  0% {
    background-position: 0 0;
  }
  100% {
    background-position: 18px 18px;
  }
`;

let Wrapper = styled.div`
  position: relative;
  background: #000;
  background-image: radial-gradient(#444 1px, transparent 0);
  background-size: 18px 18px;
  background-position: -10px -10px;
  animation: ${moveDots} 2s linear infinite;

  height: 600px;
  border-radius: 15px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);

  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px;
  text-align: center;

  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: radial-gradient(circle, transparent calc(100% - 300px), rgba(0, 0, 0, 1) 100%);
    pointer-events: none;
    z-index: 1;
  }

  h1 {
    color: #fff;
    font-size: 32px;
    font-weight: 700;
    margin-bottom: 30px;
    margin-top: 20px;
    z-index: 2;
    position: relative;
  }

  p {
    color: #ccc;
    font-size: 18px;
    font-weight: 500;
    max-width: 620px;
    z-index: 2;
    position: relative;
  }
`;

let Pill = styled.span`
  height: 26px;
  padding: 0 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #ccc;
  color: #ccc;
  font-size: 14px;
  font-weight: 500;
  border-radius: 40px;
  z-index: 2;
  position: relative;
  background: linear-gradient(90deg, rgba(50, 50, 50, 0.7), rgba(100, 100, 100, 0.7));
`;

export let ComingSoon = (p: { title: React.ReactNode; description: React.ReactNode }) => {
  return (
    <Wrapper>
      <Pill>Coming Soon</Pill>
      <h1>{p.title}</h1>
      <p>{p.description}</p>
    </Wrapper>
  );
};

export let Upgrade = (p: { title: React.ReactNode; description: React.ReactNode }) => {
  return (
    <Wrapper>
      <Pill>Available on Metorial Pro</Pill>
      <h1>{p.title}</h1>
      <p>{p.description}</p>

      <Spacer height={30} />

      <Button
        color="white"
        onClick={() => {
          // @ts-ignore
          window.metorial_enterprise?.upgrade?.();
        }}
      >
        Learn More
      </Button>
    </Wrapper>
  );
};
