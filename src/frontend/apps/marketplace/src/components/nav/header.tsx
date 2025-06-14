'use client';

import styled from 'styled-components';

let StyledHeader = styled.header`
  position: sticky;
  top: 0;
  width: 100%;
  height: 40px;
  background-color: black;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  font-size: 14px;
  padding: 0 15px;
`;

let HeaderContainer = styled.div`
  width: 100%;
  max-width: 80rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

let HeaderText = styled.p``;

let BoldText = styled.span`
  font-weight: 700;
`;

let NavLinks = styled.p`
  display: none;
  flex-wrap: wrap;
  gap: 1.25rem;
  font-weight: 600;

  a {
    color: white;
  }

  @media (min-width: 768px) {
    display: flex;
  }
`;

export let Header = () => {
  return (
    <StyledHeader
      onClick={() => {
        location.href = 'https://metorial.com';
      }}
    >
      <HeaderContainer>
        <HeaderText>
          Built by <BoldText>Metorial</BoldText>, the integration platform for agentic AI.
        </HeaderText>

        <NavLinks>
          <a href="https://metorial.com">Learn More</a>
        </NavLinks>
      </HeaderContainer>
    </StyledHeader>
  );
};
