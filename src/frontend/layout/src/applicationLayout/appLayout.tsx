import { Popover, Spacer, Switch, theme } from '@metorial/ui';
import { RiArrowLeftSLine, RiArrowRightSLine } from '@remixicon/react';
import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';
import { appLayoutSidebarStateAtom } from './atom';
import { ISidebarGroup, SidebarItems } from './components/sidebarItems';
import { RootLayout } from './layouts/rootLayout';

let SIDEBAR_DEFAULT_WIDTH = 260;
let SIDEBAR_MIN_WIDTH = 220;
let SIDEBAR_MAX_WIDTH = 420;
let SIDEBAR_CLOSE_THRESHOLD = 75;
let SIDEBAR_COLLAPSED_WIDTH = 10;
let SIDEBAR_RIGHT_PANEL_COLLAPSE_THRESHOLD = 1200;
let SIDEBAR_MOBILE_EXPANDED_WIDTH = 'calc(100vw - 120px)';

let clampSidebarWidth = (width: number) =>
  Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, width));

let getSidebarStorageKey = (id: string) => `metorial.app-layout.${id}.sidebar`;

type PersistedSidebarState = {
  width: number;
  collapsed: boolean;
  collapseSidebarWhenRightPanelOpen: boolean;
  keepSidebarCollapsedOnPageSwitch: boolean;
  autoCollapsedByRightPanel: boolean;
};

let defaultSidebarState = (): PersistedSidebarState => ({
  width: SIDEBAR_DEFAULT_WIDTH,
  collapsed: false,
  collapseSidebarWhenRightPanelOpen: true,
  keepSidebarCollapsedOnPageSwitch: false,
  autoCollapsedByRightPanel: false
});

let readSidebarState = (id: string): PersistedSidebarState => {
  if (typeof window == 'undefined') {
    return defaultSidebarState();
  }

  try {
    let raw = window.localStorage.getItem(getSidebarStorageKey(id));
    if (!raw) return defaultSidebarState();

    let parsed = JSON.parse(raw) as Partial<PersistedSidebarState>;
    let width =
      typeof parsed.width == 'number' && Number.isFinite(parsed.width)
        ? clampSidebarWidth(parsed.width)
        : SIDEBAR_DEFAULT_WIDTH;

    return {
      width,
      collapsed: parsed.collapsed === true,
      collapseSidebarWhenRightPanelOpen: parsed.collapseSidebarWhenRightPanelOpen !== false,
      keepSidebarCollapsedOnPageSwitch: parsed.keepSidebarCollapsedOnPageSwitch === true,
      autoCollapsedByRightPanel: parsed.autoCollapsedByRightPanel === true
    };
  } catch {
    return defaultSidebarState();
  }
};

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

let sidebarEnter = keyframes`
  from {
    opacity: 0;
    transform: translateX(var(--sidebar-enter-x, 18px));
  }

  to {
    opacity: 1;
    transform: translateX(0);
  }
`;

let Wrapper = styled.div`
  height: 100%;
  display: grid;
  position: relative;
`;

let SidebarWrapper = styled.div<{
  $collapsed: boolean;
  $height?: number | string;
  $mobile: boolean;
  $resizing: boolean;
  $width: number;
}>`
  height: calc(${p => p.$height || '100dvh'} - 70px);
  width: ${p =>
    p.$collapsed
      ? `${SIDEBAR_COLLAPSED_WIDTH}px`
      : p.$mobile
        ? SIDEBAR_MOBILE_EXPANDED_WIDTH
        : `${p.$width}px`};
  min-width: ${p =>
    p.$collapsed
      ? `${SIDEBAR_COLLAPSED_WIDTH}px`
      : p.$mobile
        ? SIDEBAR_MOBILE_EXPANDED_WIDTH
        : `${p.$width}px`};
  overflow: visible;
  position: relative;
  transition: ${p =>
    p.$resizing
      ? 'none'
      : `
    width 0.2s,
    min-width 0.2s`};
`;

let SidebarClip = styled.div`
  height: 100%;
  overflow: hidden;
  width: 100%;
`;

let Sidebar = styled.div`
  height: 100%;
  overflow: auto;
  padding: 0px;
  position: relative;
  width: 100%;
  min-width: ${SIDEBAR_MIN_WIDTH}px;
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

let SidebarResizeGutter = styled.div<{ $resizing: boolean }>`
  position: absolute;
  top: 15px;
  bottom: 15px;
  right: -6px;
  z-index: 40;
  width: 12px;
  cursor: col-resize;
  display: flex;
  justify-content: center;

  &::after {
    content: '';
    display: block;
    width: 3px;
    height: 100%;
    border-radius: 6px;
    background: ${p => (p.$resizing ? theme.colors.blue800 : 'transparent')};
    transition: background 0.14s ease;
  }

  &:hover::after {
    background: ${p => (p.$resizing ? theme.colors.blue800 : theme.colors.gray500)};
  }
`;

let Outer = styled.div`
  flex-grow: 1;
  min-width: 0;
  padding: 0px 10px 0px 0px;
  animation: ${fadeIn} 0.2s cubic-bezier(0.26, 1.11, 0.87, 1.25);
  max-height: calc(100dvh - 60px);
  position: relative;
`;

let SidebarEdgeHotspot = styled.div`
  position: absolute;
  top: 0;
  bottom: 0;
  left: -18px;
  width: 36px;
  z-index: 30;
  pointer-events: auto;
`;

let SidebarToggleButton = styled.button<{ $visible: boolean }>`
  position: absolute;
  z-index: 50;
  top: 72px;
  left: -15px;
  width: 30px;
  height: 30px;
  border-radius: 999px;
  border: 1px solid ${theme.colors.gray300};
  background: ${theme.colors.background};
  color: ${theme.colors.gray700};
  box-shadow: ${theme.shadows.medium};
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  opacity: ${p => (p.$visible ? 1 : 0)};
  pointer-events: ${p => (p.$visible ? 'auto' : 'none')};
  cursor: pointer;
  transition:
    opacity 0.14s ease,
    background 0.14s ease,
    color 0.14s ease;

  &:hover,
  &:focus-visible {
    background: ${theme.colors.gray100};
    color: ${theme.colors.foreground};
  }

  svg {
    width: 18px;
    height: 18px;
  }
`;

let SidebarSettings = styled.div`
  width: 350px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

let SidebarInnerTop = styled.div`
  padding: 10px 10px 0px 10px;
`;

let SidebarAnimatedItems = styled.div`
  animation: ${sidebarEnter} 0.26s cubic-bezier(0.22, 1, 0.36, 1);
`;

let SidebarInnerBottom = styled.div`
  padding: 0px 10px 0px 10px;
`;

let Content = styled.div`
  /* height: calc(100dvh - 70px); */
  background: ${theme.colors.background};
  border-radius: 10px;
  box-shadow: ${theme.shadows.large};
  overflow: auto;
  border: 1px solid ${theme.colors.gray300};
`;

let ContentInner = styled.div<{ $hidden: boolean }>`
  display: ${p => (p.$hidden ? 'none' : 'contents')};
`;

let Shadow = styled.div`
  height: 10px;
  background: linear-gradient(0deg, rgba(240, 240, 240, 0) 0%, rgba(240, 240, 240, 1) 100%);
  flex-shrink: 0;
`;

export let AppLayout = ({
  id,
  mainGroups,
  bottomGroups,
  bottom,
  sidebarTop,
  right,
  rightPanelOpen,
  onOpenAutoCollapsedSidebar,
  sidebarRightPanelCollapseThreshold = SIDEBAR_RIGHT_PANEL_COLLAPSE_THRESHOLD,
  children,
  Nav,
  height,
  bottomOffset,
  onContentScroll,
  mobile = false,
  sidebarTransition
}: {
  id: string;
  mainGroups: ISidebarGroup[];
  bottomGroups?: ISidebarGroup[];
  bottom?: React.ReactNode;
  sidebarTop?: React.ReactNode;
  right?: React.ReactNode;
  rightPanelOpen?: boolean;
  onOpenAutoCollapsedSidebar?: () => void;
  sidebarRightPanelCollapseThreshold?: number;
  children: React.ReactNode;
  Nav: () => React.ReactNode;
  height?: number | string;
  bottomOffset?: number | string;
  onContentScroll?: React.UIEventHandler<HTMLDivElement>;
  mobile?: boolean;
  sidebarTransition?: {
    key: string;
    direction?: 'forward' | 'backward';
  };
}) => {
  let [sidebarWidth, setSidebarWidth] = useState(() => readSidebarState(id).width);
  let [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => mobile || readSidebarState(id).collapsed
  );
  let [collapseSidebarWhenRightPanelOpen, setCollapseSidebarWhenRightPanelOpen] = useState(
    () => readSidebarState(id).collapseSidebarWhenRightPanelOpen
  );
  let [keepSidebarCollapsedOnPageSwitch, setKeepSidebarCollapsedOnPageSwitch] = useState(
    () => readSidebarState(id).keepSidebarCollapsedOnPageSwitch
  );
  let [autoCollapsedByRightPanel, setAutoCollapsedByRightPanel] = useState(() =>
    mobile ? false : readSidebarState(id).autoCollapsedByRightPanel
  );
  let [isResizingSidebar, setIsResizingSidebar] = useState(false);
  let [sidebarToggleVisible, setSidebarToggleVisible] = useState(false);
  let [sidebarSettingsOpen, setSidebarSettingsOpen] = useState(false);
  let resizeStateRef = useRef<{ startX: number; startWidth: number } | null>(null);
  let layoutIdRef = useRef(id);
  let sidebarToggleHideTimeoutRef = useRef<number | null>(null);
  let sidebarSettingsHoverTimeoutRef = useRef<number | null>(null);
  let location = useLocation();
  let locationPathRef = useRef(location.pathname);

  useEffect(() => {
    if (typeof window == 'undefined') return;
    if (mobile) return;

    let timeout = window.setTimeout(() => {
      window.localStorage.setItem(
        getSidebarStorageKey(id),
        JSON.stringify({
          width: sidebarWidth,
          collapsed: sidebarCollapsed,
          collapseSidebarWhenRightPanelOpen,
          keepSidebarCollapsedOnPageSwitch,
          autoCollapsedByRightPanel
        } satisfies PersistedSidebarState)
      );
    }, 200);

    return () => window.clearTimeout(timeout);
  }, [
    mobile,
    id,
    sidebarWidth,
    sidebarCollapsed,
    collapseSidebarWhenRightPanelOpen,
    keepSidebarCollapsedOnPageSwitch,
    autoCollapsedByRightPanel
  ]);

  useEffect(() => {
    if (layoutIdRef.current == id) return;

    layoutIdRef.current = id;
    let sidebarState = readSidebarState(id);
    setSidebarWidth(sidebarState.width);
    setSidebarCollapsed(sidebarState.collapsed);
    setCollapseSidebarWhenRightPanelOpen(sidebarState.collapseSidebarWhenRightPanelOpen);
    setKeepSidebarCollapsedOnPageSwitch(sidebarState.keepSidebarCollapsedOnPageSwitch);
    setAutoCollapsedByRightPanel(sidebarState.autoCollapsedByRightPanel);
    setSidebarToggleVisible(false);
  }, [id]);

  useEffect(() => {
    if (mobile) {
      setAutoCollapsedByRightPanel(false);
      setIsResizingSidebar(false);
      setSidebarCollapsed(true);
      return;
    }

    let sidebarState = readSidebarState(id);
    setSidebarWidth(sidebarState.width);
    setSidebarCollapsed(sidebarState.collapsed);
    setAutoCollapsedByRightPanel(sidebarState.autoCollapsedByRightPanel);
  }, [id, mobile]);

  useEffect(() => {
    appLayoutSidebarStateAtom.set({
      layoutId: id,
      collapsed: sidebarCollapsed
    });
  }, [id, sidebarCollapsed]);

  useEffect(() => {
    return () => {
      appLayoutSidebarStateAtom.set({
        layoutId: null,
        collapsed: false
      });
    };
  }, []);

  useEffect(() => {
    if (mobile) return;
    if (!collapseSidebarWhenRightPanelOpen || !rightPanelOpen) return;
    if (typeof window == 'undefined') return;

    let collapseIfNeeded = () => {
      if (window.innerWidth < sidebarRightPanelCollapseThreshold && !sidebarCollapsed) {
        setAutoCollapsedByRightPanel(true);
        setSidebarCollapsed(true);
      }
    };

    collapseIfNeeded();
    window.addEventListener('resize', collapseIfNeeded);

    return () => window.removeEventListener('resize', collapseIfNeeded);
  }, [
    mobile,
    collapseSidebarWhenRightPanelOpen,
    rightPanelOpen,
    sidebarCollapsed,
    sidebarRightPanelCollapseThreshold
  ]);

  useEffect(() => {
    if (mobile) return;
    if (rightPanelOpen !== false || !autoCollapsedByRightPanel) return;

    if (sidebarCollapsed) {
      setSidebarCollapsed(false);
    }

    setAutoCollapsedByRightPanel(false);
  }, [autoCollapsedByRightPanel, mobile, rightPanelOpen, sidebarCollapsed]);

  useEffect(() => {
    if (locationPathRef.current == location.pathname) return;

    locationPathRef.current = location.pathname;
    if (mobile) {
      setAutoCollapsedByRightPanel(false);
      setSidebarCollapsed(true);
      return;
    }

    let shouldStayCollapsedForRightPanel =
      collapseSidebarWhenRightPanelOpen &&
      rightPanelOpen &&
      typeof window != 'undefined' &&
      window.innerWidth < sidebarRightPanelCollapseThreshold;

    if (!keepSidebarCollapsedOnPageSwitch && !shouldStayCollapsedForRightPanel) {
      setAutoCollapsedByRightPanel(false);
      setSidebarCollapsed(false);
    }
  }, [
    collapseSidebarWhenRightPanelOpen,
    keepSidebarCollapsedOnPageSwitch,
    location.pathname,
    mobile,
    rightPanelOpen,
    sidebarRightPanelCollapseThreshold
  ]);

  useEffect(() => {
    return () => {
      if (sidebarToggleHideTimeoutRef.current) {
        window.clearTimeout(sidebarToggleHideTimeoutRef.current);
      }

      if (sidebarSettingsHoverTimeoutRef.current) {
        window.clearTimeout(sidebarSettingsHoverTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (mobile || !isResizingSidebar || typeof window == 'undefined') return;

    let previousCursor = document.body.style.cursor;
    let previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    let handlePointerMove = (event: PointerEvent) => {
      let resizeState = resizeStateRef.current;
      if (!resizeState) return;

      let nextWidth = resizeState.startWidth + (event.clientX - resizeState.startX);
      if (nextWidth <= SIDEBAR_MIN_WIDTH - SIDEBAR_CLOSE_THRESHOLD) {
        setSidebarWidth(clampSidebarWidth(resizeState.startWidth));
        setAutoCollapsedByRightPanel(false);
        setSidebarCollapsed(true);
        resizeStateRef.current = null;
        setIsResizingSidebar(false);
        return;
      }

      setSidebarWidth(clampSidebarWidth(nextWidth));
    };

    let handlePointerUp = () => {
      resizeStateRef.current = null;
      setIsResizingSidebar(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [isResizingSidebar, mobile]);

  let startSidebarResize = (event: React.PointerEvent<HTMLDivElement>) => {
    if (mobile) return;

    event.preventDefault();
    resizeStateRef.current = {
      startX: event.clientX,
      startWidth: sidebarWidth
    };
    if (sidebarCollapsed && autoCollapsedByRightPanel && rightPanelOpen) {
      onOpenAutoCollapsedSidebar?.();
    }
    setAutoCollapsedByRightPanel(false);
    setSidebarCollapsed(false);
    setIsResizingSidebar(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  let toggleSidebarCollapsed = () => {
    if (sidebarCollapsed && autoCollapsedByRightPanel && rightPanelOpen) {
      onOpenAutoCollapsedSidebar?.();
    }

    setAutoCollapsedByRightPanel(false);
    setSidebarCollapsed(!sidebarCollapsed);
  };

  let showSidebarToggle = () => {
    if (sidebarToggleHideTimeoutRef.current) {
      window.clearTimeout(sidebarToggleHideTimeoutRef.current);
      sidebarToggleHideTimeoutRef.current = null;
    }

    setSidebarToggleVisible(true);
  };

  let hideSidebarToggle = () => {
    if (sidebarToggleHideTimeoutRef.current) {
      window.clearTimeout(sidebarToggleHideTimeoutRef.current);
    }

    sidebarToggleHideTimeoutRef.current = window.setTimeout(() => {
      setSidebarToggleVisible(false);
      sidebarToggleHideTimeoutRef.current = null;
    }, 180);
  };

  let cancelSidebarSettingsHover = () => {
    if (sidebarSettingsHoverTimeoutRef.current) {
      window.clearTimeout(sidebarSettingsHoverTimeoutRef.current);
      sidebarSettingsHoverTimeoutRef.current = null;
    }
  };

  let scheduleSidebarSettingsHover = () => {
    if (typeof window == 'undefined' || sidebarSettingsOpen) return;

    cancelSidebarSettingsHover();
    sidebarSettingsHoverTimeoutRef.current = window.setTimeout(() => {
      setSidebarSettingsOpen(true);
      setSidebarToggleVisible(true);
      sidebarSettingsHoverTimeoutRef.current = null;
    }, 2000);
  };

  return (
    <RootLayout Nav={Nav} height={height}>
      <Wrapper
        style={{
          gridTemplateColumns: right ? 'auto minmax(0, 1fr) auto' : 'auto minmax(0, 1fr)',
          height
        }}
      >
        <SidebarWrapper
          $collapsed={sidebarCollapsed}
          $height={height}
          $mobile={mobile}
          $resizing={isResizingSidebar}
          $width={sidebarWidth}
        >
          {!sidebarCollapsed && (
            <SidebarClip>
              <Sidebar>
                <Shadow />

                <SidebarInnerTop>
                  {sidebarTop}

                  {sidebarTransition ? (
                    <SidebarAnimatedItems
                      key={sidebarTransition.key}
                      style={
                        {
                          ['--sidebar-enter-x' as string]:
                            sidebarTransition.direction === 'backward' ? '-18px' : '18px'
                        } as React.CSSProperties
                      }
                    >
                      <SidebarItems groups={mainGroups} id={id} />
                    </SidebarAnimatedItems>
                  ) : (
                    <SidebarItems groups={mainGroups} id={id} />
                  )}
                </SidebarInnerTop>

                {!mobile && (
                  <>
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
                  </>
                )}
              </Sidebar>
            </SidebarClip>
          )}

          {!mobile && !sidebarCollapsed && (
            <SidebarResizeGutter
              $resizing={isResizingSidebar}
              role="separator"
              aria-label="Resize sidebar"
              aria-orientation="vertical"
              aria-valuemin={SIDEBAR_MIN_WIDTH}
              aria-valuemax={SIDEBAR_MAX_WIDTH}
              aria-valuenow={sidebarWidth}
              title="Resize sidebar"
              onPointerDown={startSidebarResize}
            />
          )}
        </SidebarWrapper>

        <Outer>
          <SidebarEdgeHotspot
            onPointerEnter={showSidebarToggle}
            onPointerLeave={hideSidebarToggle}
          />

          <Popover.Root
            align="start"
            open={sidebarSettingsOpen}
            onOpenChange={setSidebarSettingsOpen}
            side="right"
            sideOffset={8}
            trigger={
              <SidebarToggleButton
                $visible={
                  mobile || sidebarCollapsed || sidebarToggleVisible || sidebarSettingsOpen
                }
                aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                onBlur={() => {
                  cancelSidebarSettingsHover();
                  hideSidebarToggle();
                }}
                onClick={event => {
                  event.preventDefault();
                  cancelSidebarSettingsHover();
                  setSidebarSettingsOpen(false);
                  toggleSidebarCollapsed();
                }}
                onContextMenu={event => {
                  event.preventDefault();
                  cancelSidebarSettingsHover();
                  showSidebarToggle();
                  setSidebarSettingsOpen(true);
                }}
                onFocus={showSidebarToggle}
                onPointerEnter={() => {
                  showSidebarToggle();
                  scheduleSidebarSettingsHover();
                }}
                onPointerLeave={() => {
                  cancelSidebarSettingsHover();
                  hideSidebarToggle();
                }}
                type="button"
              >
                {sidebarCollapsed ? <RiArrowRightSLine /> : <RiArrowLeftSLine />}
              </SidebarToggleButton>
            }
          >
            <Popover.Content>
              <SidebarSettings>
                <Switch
                  checked={collapseSidebarWhenRightPanelOpen}
                  label="Collapse sidebar when right panel opens"
                  onCheckedChange={setCollapseSidebarWhenRightPanelOpen}
                />

                <Switch
                  checked={keepSidebarCollapsedOnPageSwitch}
                  label="Keep sidebar collapsed when switching pages"
                  onCheckedChange={setKeepSidebarCollapsedOnPageSwitch}
                />
              </SidebarSettings>
            </Popover.Content>
          </Popover.Root>

          <Content
            onScroll={onContentScroll}
            style={{
              height: `calc(100dvh - 70px - ${bottomOffset ?? '0px'})`
            }}
          >
            <ContentInner $hidden={mobile && !sidebarCollapsed}>{children}</ContentInner>
          </Content>
        </Outer>

        {right}
      </Wrapper>
    </RootLayout>
  );
};
