import { Tabs } from '@base-ui/react/tabs';
import { Skeleton, theme } from '@metorial/ui';
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import styled from 'styled-components';

export type DetailsTab = {
  label: React.ReactNode;
  to: string;
};

let TabsNav = styled.nav`
  min-width: 0;
  max-width: 100%;
  overflow-x: auto;
  scrollbar-width: none;
  border: 1px solid ${theme.colors.gray400};
  border-radius: 8px;
  background: ${theme.colors.gray300};
  box-shadow: ${theme.shadows.small};

  &::-webkit-scrollbar {
    display: none;
  }
`;

let TabsRoot = styled(Tabs.Root)`
  width: max-content;
`;

let TabsList = styled(Tabs.List)`
  position: relative;
  display: flex;
  width: max-content;
  min-width: 0;
  gap: 2px;
  padding: 2px;
`;

let Tab = styled(Tabs.Tab)`
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  min-height: 30px;
  padding: 0 10px;
  border: 0;
  border-radius: 6px;
  color: ${theme.colors.gray700};
  background: transparent;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
  transition: color 160ms ease;

  &[data-active] {
    color: ${theme.colors.gray900};
  }

  &:hover,
  &:focus-visible {
    color: ${theme.colors.gray900};
    outline: none;
  }

  &:focus-visible {
    box-shadow: inset 0 0 0 2px ${theme.colors.blue500};
  }
`;

let TabIndicator = styled(Tabs.Indicator)`
  position: absolute;
  z-index: 0;
  top: 0;
  left: 0;
  width: var(--active-tab-width);
  height: var(--active-tab-height);
  transform: translate3d(var(--active-tab-left), var(--active-tab-top), 0);
  border: 1px solid ${theme.colors.gray400};
  border-radius: 6px;
  background: ${theme.colors.background};
  box-shadow: ${theme.shadows.small};
  will-change: transform, width;
  transition:
    transform 220ms cubic-bezier(0.22, 1, 0.36, 1),
    width 220ms cubic-bezier(0.22, 1, 0.36, 1),
    height 220ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 140ms ease;

  &[hidden] {
    opacity: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

let getPathname = (to: string) => {
  try {
    return new URL(to, 'http://metorial.local').pathname.replace(/\/$/, '') || '/';
  } catch {
    return to.replace(/[?#].*$/, '').replace(/\/$/, '') || '/';
  }
};

export let DetailsTabs = ({ tabs, skeleton }: { tabs: DetailsTab[]; skeleton?: boolean }) => {
  let currentPathname = getPathname(useLocation().pathname);
  let activePathname = tabs
    .map(tab => getPathname(tab.to))
    .filter(
      pathname => currentPathname == pathname || currentPathname.startsWith(`${pathname}/`)
    )
    .sort((a, b) => b.length - a.length)[0];
  return (
    <Skeleton active={skeleton} borderRadius={8}>
      <TabsNav aria-label="Page sections">
        <TabsRoot value={activePathname}>
          <TabsList>
            {tabs.map(tab => {
              let pathname = getPathname(tab.to);

              return (
                <Tab
                  key={tab.to}
                  value={pathname}
                  nativeButton={false}
                  render={<Link to={tab.to} />}
                >
                  {tab.label}
                </Tab>
              );
            })}

            <TabIndicator renderBeforeHydration />
          </TabsList>
        </TabsRoot>
      </TabsNav>
    </Skeleton>
  );
};
