import React from 'react';
import { styled } from 'styled-components';
import { SimpleSidebar, SimpleSidebarGroup } from './sidebar';

let Wrapper = styled.div`
  display: grid;
  grid-template-columns: 200px calc(100% - 230px);
  gap: 30px;
  /* max-width: 1220px; */
  /* padding: 70px 15px 20px 20px; */
  padding: 20px 0px;
  width: 100%;
  margin: 0 auto;

  @media (max-width: 1100px) {
    grid-template-columns: 100%;
    gap: 20px;
  }
`;

let SidebarColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: 15px;
`;

let Main = styled.div``;

export let SimpleSidebarLayout = ({
  children,
  groups,
  extraTop
}: {
  children: React.ReactNode;
  groups: SimpleSidebarGroup[];
  extraTop?: React.ReactNode;
}) => {
  return (
    <Wrapper>
      <SidebarColumn>
        {extraTop}
        <SimpleSidebar groups={groups} />
      </SidebarColumn>
      <Main>{children}</Main>
    </Wrapper>
  );
};
