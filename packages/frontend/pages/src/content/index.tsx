import React from 'react';
import { Balancer } from 'react-wrap-balancer';
import { styled } from 'styled-components';

let Wrapper = styled.div`
  height: 100vh;
`;

let Main = styled.main`
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  max-width: 600px;
  margin: 0 auto;
`;

let Title = styled.h1`
  font-size: 40px;
  font-weight: 700;
  color: black;
  text-align: center;
  margin-bottom: 20px;

  @media (max-width: 600px) {
    font-size: 36px;
  }
`;

let Description = styled.p`
  font-size: 30px;
  font-weight: 600;
  color: black;
  text-align: center;
  opacity: 0.6;

  @media (max-width: 600px) {
    font-size: 18px;
  }
`;

export let ContentPage = ({ title, description }: { title: string; description: string }) => {
  return (
    <Wrapper>
      <Main>
        <Title>
          <Balancer>{title}</Balancer>
        </Title>
        <Description>
          <Balancer>{description}</Balancer>
        </Description>
      </Main>
    </Wrapper>
  );
};
