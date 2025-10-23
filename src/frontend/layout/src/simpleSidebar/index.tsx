import React from 'react';
import { styled } from 'styled-components';
import { SimpleSidebar, SimpleSidebarGroup } from './sidebar';

let Wrapper = styled.div`
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: 30px;
  /* max-width: 1220px; */
  /* padding: 70px 15px 20px 20px; */
  padding: 20px 0px;
  width: 100%;
  margin: 0 auto;
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
