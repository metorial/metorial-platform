import React from 'react';
import { styled } from 'styled-components';

let Wrapper = styled.div`
  background: #dcc425;
  height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
`;

let Box = styled.div`
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(15px);

  /* important: Box should not be the scroll container */
  overflow: hidden;

  display: flex;
  flex-direction: column;

  @media (max-width: 800px) {
    width: min(600px, calc(100dvw - 40px));
    height: min(700px, 70dvh);
    border-radius: 10px;
  }

  @media (min-width: 800px) {
    position: fixed;
    top: 0;
    left: 0;
    height: 100dvh;
    width: 600px;
    max-width: 70dvw;
  }

  @media (max-width: 1000px) {
    background: white;

    .aside,
    hr {
      display: none;
    }
  }
`;

let Inner = styled.div`
  display: flex;

  /* critical for overflow inside flex children */
  height: 100%;
  min-height: 0;
  min-width: 0;
`;

let Side = styled.section`
  display: flex;
  flex-direction: column;

  width: 100%;

  overflow: auto;
  min-height: 0;
  min-width: 0;

  -webkit-overflow-scrolling: touch;

  &.padded {
    padding: 50px;

    @media (max-width: 800px) {
      padding: 40px;
    }
  }
`;

let Content = styled.div`
  margin: auto 0; /* vertical centering when content is small */
`;

export let InnerLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <Wrapper>
      <Box>
        <Inner>
          <Side style={{ background: 'rgba(255, 255, 255, 1)' }} className="padded">
            <Content>{children}</Content>
          </Side>
        </Inner>
      </Box>
    </Wrapper>
  );
};
