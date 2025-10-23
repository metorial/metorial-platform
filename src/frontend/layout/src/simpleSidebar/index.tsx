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

let Main = styled.div``;

export let SimpleSidebarLayout = ({
  children,
  groups
}: {
  children: React.ReactNode;
  groups: SimpleSidebarGroup[];
}) => {
  return (
    <Wrapper>
      <SimpleSidebar groups={groups} />
      <Main>{children}</Main>
    </Wrapper>
  );
};
