import React from 'react';
import styled from 'styled-components';
import { ISidebarGroup, SidebarItems } from '../components/sidebarItems';

let Wrapper = styled('div')`
  min-height: 100%;
  display: flex;
  /* grid-template-columns: 250px 1fr; */
  position: relative;
  flex-grow: 1;
`;

let Sidebar = styled('div')`
  padding: 5px 20px 0px 0px;
  position: relative;
  width: 250px;
  flex-shrink: 0;
  margin-left: -10px;
`;

let Main = styled('div')`
  max-height: 100%;
  flex-grow: 1;
  display: flex;
  flex-direction: column;
`;

export let SidebarLayout = ({
  groups,
  children,
  id
}: {
  groups: ISidebarGroup[];
  children: React.ReactNode;
  id: string;
}) => {
  return (
    <Wrapper>
      <Sidebar>
        <SidebarItems groups={groups} id={id} />
      </Sidebar>

      <Main>{children}</Main>
    </Wrapper>
  );
};
