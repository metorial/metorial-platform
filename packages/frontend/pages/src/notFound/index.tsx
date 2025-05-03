import React from 'react';
import { styled } from 'styled-components';

export let Wrapper = styled.div`
  background-color: hsla(321, 100%, 98%, 1);
  background-image:
    radial-gradient(at 37% 72%, hsla(26, 60%, 66%, 1) 0px, transparent 50%),
    radial-gradient(at 82% 63%, hsla(193, 100%, 83%, 1) 0px, transparent 50%),
    radial-gradient(at 9% 14%, hsla(304, 38%, 68%, 1) 0px, transparent 50%);
  height: 100vh;
`;

export let Main = styled.main`
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  max-width: 600px;
  margin: 0 auto;
`;

export let Title = styled.h1`
  font-size: 48px;
  font-weight: 700;
  color: black;
  text-align: center;
  margin-bottom: 20px;

  @media (max-width: 600px) {
    font-size: 36px;
  }
`;

export let Description = styled.p`
  font-size: 18px;
  font-weight: 500;
  color: black;
  text-align: center;
  opacity: 0.8;
`;

export let NotFound = () => {
  return (
    <Wrapper>
      <Main>
        <Title>404 - Not Found</Title>
        <Description>The page you are looking for does not exist.</Description>
      </Main>
    </Wrapper>
  );
};
