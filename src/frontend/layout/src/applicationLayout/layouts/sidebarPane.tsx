import { theme } from '@metorial/ui';
import React from 'react';
import styled from 'styled-components';
import { ISidebarGroup, SidebarItems } from '../components/sidebarItems';

let Wrapper = styled('div')`
  height: 100%;
  display: flex;
  /* grid-template-columns: 250px 1fr; */
  position: relative;
  flex-grow: 1;
`;

let Sidebar = styled('div')`
  max-height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  border-right: 1px solid ${theme.colors.gray300};
  padding: 25px 20px;
  position: relative;
  width: 250px;
  flex-shrink: 0;
`;

let Main = styled('div')`
  max-height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  flex-grow: 1;
  display: flex;
  flex-direction: column;
`;

export let SidebarPane = ({
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
