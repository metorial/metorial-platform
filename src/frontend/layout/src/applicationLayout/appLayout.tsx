import { Spacer, theme } from '@metorial/ui';
import React from 'react';
import styled, { keyframes } from 'styled-components';
import { ISidebarGroup, SidebarItems } from './components/sidebarItems';
import { RootLayout } from './layouts/rootLayout';
import { OssApplicationLayoutNav } from './nav';

let fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(20px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

let Wrapper = styled.div`
  height: 100%;
  display: flex;
  /* grid-template-columns: 250px 1fr; */
  position: relative;
`;

let SidebarWrapper = styled.div`
  height: calc(100dvh - 60px);
`;

let Sidebar = styled.div`
  height: 100%;
  overflow: auto;
  padding: 0px;
  position: relative;
  width: 260px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;

  scrollbar-width: thin;
  scrollbar-color: ${theme.colors.gray400} ${theme.colors.gray200};

  opacity: 0;
  animation: ${fadeIn} 0.2s 0.05s cubic-bezier(0.26, 1.11, 0.87, 1.25) forwards;

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background-color: ${theme.colors.gray400};
  }

  &::-webkit-scrollbar-track {
    background-color: ${theme.colors.gray200};
  }
`;

let Outer = styled.div`
  flex-grow: 1;
  padding: 0px 10px 0px 0px;
  animation: ${fadeIn} 0.2s cubic-bezier(0.26, 1.11, 0.87, 1.25);
  max-height: calc(100dvh - 60px);
`;

let SidebarInnerTop = styled.div`
  padding: 10px 10px 0px 10px;
`;

let SidebarInnerBottom = styled.div`
  padding: 0px 10px 0px 10px;
`;

let Content = styled.div`
  /* height: calc(100dvh - 70px); */
  height: calc(100% - 10px);
  background: ${theme.colors.background};
  border-radius: 10px;
  box-shadow: ${theme.shadows.large};
  overflow: auto;
  border: 1px solid ${theme.colors.gray300};
`;

let Shadow = styled.div`
  height: 10px;
  background: linear-gradient(0deg, rgba(240, 240, 240, 0) 0%, rgba(240, 240, 240, 1) 100%);
`;

export let AppLayout = ({
  id,
  mainGroups,
  bottomGroups,
  bottom,
  right,
  children,
  Nav = () => <OssApplicationLayoutNav />
}: {
  id: string;
  mainGroups: ISidebarGroup[];
  bottomGroups?: ISidebarGroup[];
  bottom?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  Nav?: () => React.ReactNode;
}) => {
  return (
    <RootLayout Nav={Nav}>
      <Wrapper>
        <SidebarWrapper>
          <Sidebar>
            <Shadow />

            <SidebarInnerTop>
              <SidebarItems groups={mainGroups} id={id} />
            </SidebarInnerTop>

            <Spacer />

            <div
              style={{
                position: 'sticky',
                bottom: 0,
                zIndex: 10
              }}
            >
              <Shadow style={{ height: 20, transform: 'rotate(180deg)' }} />

              <div
                style={{
                  background: 'var(--lb-bg)'
                }}
              >
                {bottomGroups && (
                  <SidebarInnerBottom>
                    <SidebarItems groups={bottomGroups} id={`${id}-bottom`} />
                  </SidebarInnerBottom>
                )}

                {bottom && (
                  <div
                    style={{
                      padding: '0px 10px 10px 10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10
                    }}
                  >
                    {bottom}
                  </div>
                )}
              </div>
            </div>
          </Sidebar>
        </SidebarWrapper>

        <Outer>
          <Content>{children}</Content>
        </Outer>

        {right}
      </Wrapper>
    </RootLayout>
  );
};
