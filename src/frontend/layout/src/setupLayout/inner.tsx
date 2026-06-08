import { Logo } from '@metorial/ui';
import React from 'react';
import { styled } from 'styled-components';

let Wrapper = styled.div`
  min-height: 100dvh;
  padding: 20px;
  box-sizing: border-box;
  background: white;
  display: flex;
  flex-direction: column;
  gap: 24px;
  align-items: center;
  justify-content: center;

  @media (max-width: 800px) {
    padding: 20px 16px;
  }
`;

let BrandSlot = styled.div`
  min-height: 30px;
`;

let Brand = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

let BrandText = styled.p`
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  line-height: 1;
  color: black;
`;

let Box = styled.div`
  width: min(460px, 100%);
  display: flex;
  flex-direction: column;
`;

let Content = styled.div`
  width: 100%;
  min-width: 0;
`;

export let InnerLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <Wrapper>
      <BrandSlot>
        <Brand>
          <Logo size={30} color="black" />
          <BrandText>Metorial</BrandText>
        </Brand>
      </BrandSlot>

      <Box>
        <Content>{children}</Content>
      </Box>
    </Wrapper>
  );
};
