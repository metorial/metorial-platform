import { Skeleton, Text, Title, theme } from '@metorial/ui';
import { RiArrowLeftLine } from '@remixicon/react';
import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { DetailsActions, DetailsLayoutAction } from './components/actions';
import { DetailsBreadcrumb, DetailsBreadcrumbs } from './components/breadcrumbs';
import { DetailsTab, DetailsTabs } from './components/tabs';
import {
  DetailsLayoutAttribute,
  DetailsLayoutContext,
  DetailsLayoutEntity,
  getDetailsLayoutEntityLabel
} from './detailsLayoutContext';
import {
  DETAILS_LAYOUT_COLLAPSE_SCROLL_TOP,
  isDetailsMainPage,
  shouldExpandDetailsHeader
} from './detailsLayoutState';

export type DetailsLayoutProps = {
  entity: DetailsLayoutEntity;
  icon?: React.ReactNode;
  avatar?: (size: number) => React.ReactNode;
  breadcrumbs: DetailsBreadcrumb[];
  tabs?: DetailsTab[];
  actions?: DetailsLayoutAction[];
  attributes?: DetailsLayoutAttribute[];
  children: React.ReactNode;
};

let Header = styled.header<{ $showBorder: boolean }>`
  position: sticky;
  z-index: 45;
  top: 0;
  background: ${theme.colors.background};
  border-bottom: 1px solid ${p => (p.$showBorder ? theme.colors.gray400 : 'transparent')};
  transition: border-color 180ms ease;
  /* box-shadow: 0 1px 5px rgba(0, 0, 0, 0.1); */

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

let Container = styled.div`
  width: 100%;
  max-width: 1220px;
  margin: 0 auto;
  padding-right: 24px;
  padding-left: 24px;

  @media (max-width: 720px) {
    padding-right: 16px;
    padding-left: 16px;
  }
`;

let EntityHeader = styled(Container)`
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 54px;
  padding-top: 8px;
  padding-bottom: 8px;

  @media (max-width: 720px) {
    gap: 8px;
  }
`;

let EntityIdentity = styled.div<{ $expanded: boolean }>`
  display: flex;
  align-items: center;
  flex: 1 1 auto;
  min-width: 0;
  margin-left: -5px;
  transition: margin-left 280ms cubic-bezier(0.22, 1, 0.36, 1);

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

let CompactBackButtonSlot = styled.div<{ $visible: boolean }>`
  width: ${p => (p.$visible ? '28px' : '0')};
  margin-right: ${p => (p.$visible ? '8px' : '0')};
  flex-shrink: 0;
  overflow: hidden;
  opacity: ${p => (p.$visible ? 1 : 0)};
  transform: translateX(${p => (p.$visible ? '0' : '-8px')});
  transition:
    width 280ms cubic-bezier(0.22, 1, 0.36, 1),
    margin-right 280ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 180ms ease,
    transform 280ms cubic-bezier(0.22, 1, 0.36, 1);

  @media (prefers-reduced-motion: reduce) {
    transform: none;
    transition: none;
  }
`;

let BreadcrumbBackButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  color: ${theme.colors.gray700};
  background: transparent;
  cursor: pointer;
  flex-shrink: 0;
  transition:
    color 160ms ease,
    background 160ms ease;

  &:hover:not(:disabled),
  &:focus-visible:not(:disabled) {
    color: ${theme.colors.gray900};
    background: ${theme.colors.gray300};
    outline: none;
  }

  &:disabled {
    cursor: default;
    opacity: 0.5;
  }
`;

let BreadcrumbBackButtonContent = styled.span`
  position: relative;
  display: block;
  width: 16px;
  height: 16px;
`;

let BreadcrumbBackButtonIcon = styled.span`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    opacity 180ms ease,
    transform 180ms cubic-bezier(0.22, 1, 0.36, 1);

  svg {
    width: 16px;
    height: 16px;
  }
`;

let BreadcrumbBackButtonArrow = styled(BreadcrumbBackButtonIcon)`
  opacity: 0;
  transform: translateX(5px);

  ${BreadcrumbBackButton}:hover:not(:disabled) &, ${BreadcrumbBackButton}:focus-visible:not(:disabled) & {
    opacity: 1;
    transform: translateX(0);
  }
`;

let BreadcrumbBackButtonEntityIcon = styled(BreadcrumbBackButtonIcon)`
  ${BreadcrumbBackButton}:hover:not(:disabled) &, ${BreadcrumbBackButton}:focus-visible:not(:disabled) & {
    opacity: 0;
    transform: translateX(-5px);
  }
`;

let CompactAvatarSlot = styled.div<{ $visible: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: ${p => (p.$visible ? '24px' : '0')};
  margin-right: ${p => (p.$visible ? '8px' : '0')};
  overflow: hidden;
  opacity: ${p => (p.$visible ? 1 : 0)};
  transform: translateX(${p => (p.$visible ? '0' : '-8px')});
  transition:
    width 280ms cubic-bezier(0.22, 1, 0.36, 1),
    margin-right 280ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 180ms ease,
    transform 280ms cubic-bezier(0.22, 1, 0.36, 1);

  @media (prefers-reduced-motion: reduce) {
    transform: none;
    transition: none;
  }
`;

let ExpandedAvatarSlot = styled.div`
  display: flex;
  flex-shrink: 0;
`;

let HeaderControls = styled.div`
  display: flex;
  align-items: center;
  flex: 0 1 auto;
  min-width: 0;
  margin-left: auto;
  gap: 8px;

  @media (max-width: 720px) {
    gap: 6px;
  }
`;

let ExpandedIdentity = styled(Container)<{
  $expanded: boolean;
  $contentHeight: number;
}>`
  height: ${p => (p.$expanded ? `${p.$contentHeight}px` : '0')};
  overflow: hidden;
  opacity: ${p => (p.$expanded ? 1 : 0)};
  transform: translateY(${p => (p.$expanded ? '0' : '-8px')});
  transition:
    height 280ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 180ms ease,
    transform 280ms cubic-bezier(0.22, 1, 0.36, 1);

  @media (prefers-reduced-motion: reduce) {
    transform: none;
    transition: none;
  }
`;

let ExpandedIdentityContent = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  padding-top: 10px;
  padding-bottom: 16px;
  box-sizing: border-box;

  @media (max-width: 720px) {
    gap: 10px;
    padding-top: 10px;
    padding-bottom: 14px;
  }
`;

let ExpandedEntityCopy = styled.div`
  min-width: 0;
`;

let ExpandedEntityTitle = styled.div`
  overflow: hidden;
`;

let ExpandedEntityDescription = styled.div`
  max-width: 760px;
  margin: 6px 0 0;

  > * {
    display: -webkit-box;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }
`;

let HeaderSpacer = styled.div<{ $reserved: boolean; $height: number }>`
  height: ${p => (p.$reserved ? `${p.$height}px` : '0')};
  transition: height 280ms cubic-bezier(0.22, 1, 0.36, 1);

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

let Body = styled.main<{ $isMainPage: boolean }>`
  width: 100%;
  max-width: 1220px;
  margin: 0 auto;
  padding: ${p => (p.$isMainPage ? '12px' : '40px')} 24px 20px;

  @media (max-width: 720px) {
    padding-right: 16px;
    padding-left: 16px;
  }
`;

let getScrollContainer = (element: HTMLElement) => {
  let parent = element.parentElement;

  while (parent) {
    let { overflowY } = window.getComputedStyle(parent);
    if (overflowY == 'auto' || overflowY == 'scroll' || overflowY == 'overlay') {
      return parent;
    }

    parent = parent.parentElement;
  }

  return window;
};

let getScrollTop = (container: HTMLElement | Window) =>
  container == window ? window.scrollY : (container as HTMLElement).scrollTop;

export let DetailsLayout = ({
  entity,
  icon,
  avatar,
  breadcrumbs,
  tabs,
  actions,
  attributes = [],
  children
}: DetailsLayoutProps) => {
  let navigate = useNavigate();
  let location = useLocation();
  let headerRef = React.useRef<HTMLElement>(null);
  let expandedIdentityRef = React.useRef<HTMLDivElement>(null);
  let [expandedHeaderHeight, setExpandedHeaderHeight] = React.useState(0);
  let [showHeaderBorder, setShowHeaderBorder] = React.useState(false);
  let [isPastCollapsePoint, setIsPastCollapsePoint] = React.useState(false);
  let [isBreadcrumbsHovered, setIsBreadcrumbsHovered] = React.useState(false);
  let entityLabel = getDetailsLayoutEntityLabel(entity);
  let visibleBreadcrumbs = breadcrumbs.length ? breadcrumbs : [{ label: entityLabel }];
  let skeleton = entity == null;
  let parentBreadcrumb = visibleBreadcrumbs.at(-2);
  let isBackButtonDisabled = visibleBreadcrumbs.length <= 1 || !parentBreadcrumb?.to;
  let shouldAlwaysShowBackArrow = visibleBreadcrumbs.length >= 3 || !icon;
  let mainPageTo = breadcrumbs.at(-1)?.to;
  let isMainPage = isDetailsMainPage({
    pathname: location.pathname,
    mainPageTo
  });
  let isExpanded = shouldExpandDetailsHeader({
    pathname: location.pathname,
    mainPageTo,
    scrollTop: isPastCollapsePoint ? DETAILS_LAYOUT_COLLAPSE_SCROLL_TOP + 1 : 0
  });
  let shouldReserveExpandedSpace = isMainPage && isPastCollapsePoint;
  let shouldShowBackButton = !isExpanded || isBreadcrumbsHovered;

  React.useLayoutEffect(() => {
    let expandedIdentity = expandedIdentityRef.current;
    if (!expandedIdentity) return;

    let measure = () => {
      let height = Math.ceil(expandedIdentity.getBoundingClientRect().height);
      setExpandedHeaderHeight(currentHeight =>
        currentHeight == height ? currentHeight : height
      );
    };

    measure();

    let resizeObserver =
      typeof ResizeObserver == 'undefined' ? null : new ResizeObserver(measure);
    resizeObserver?.observe(expandedIdentity);

    return () => resizeObserver?.disconnect();
  }, []);

  useEffect(() => {
    let header = headerRef.current;
    if (!header) return;

    let scrollContainer = getScrollContainer(header);
    let animationFrame: number | undefined;
    let updateScrollTop = () => {
      animationFrame = undefined;
      let scrollTop = getScrollTop(scrollContainer);
      setShowHeaderBorder(scrollTop >= 5);
      setIsPastCollapsePoint(scrollTop > DETAILS_LAYOUT_COLLAPSE_SCROLL_TOP);
    };
    let handleScroll = () => {
      if (animationFrame !== undefined) return;
      animationFrame = window.requestAnimationFrame(updateScrollTop);
    };

    updateScrollTop();
    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
      if (animationFrame !== undefined) window.cancelAnimationFrame(animationFrame);
    };
  }, [location.pathname]);

  return (
    <DetailsLayoutContext.Provider
      value={{ entity, icon, avatar, breadcrumbs, tabs, actions, attributes }}
    >
      <Header ref={headerRef} $showBorder={showHeaderBorder}>
        <EntityHeader>
          <EntityIdentity
            $expanded={isExpanded}
            onMouseEnter={() => setIsBreadcrumbsHovered(true)}
            onMouseLeave={() => setIsBreadcrumbsHovered(false)}
          >
            <CompactBackButtonSlot
              $visible={shouldShowBackButton}
              aria-hidden={!shouldShowBackButton}
            >
              <Skeleton active={skeleton} borderRadius={6}>
                <BreadcrumbBackButton
                  type="button"
                  aria-label="Back"
                  title={isBackButtonDisabled ? undefined : 'Back'}
                  tabIndex={shouldShowBackButton ? undefined : -1}
                  disabled={isBackButtonDisabled || skeleton}
                  onClick={() => parentBreadcrumb?.to && navigate(parentBreadcrumb.to)}
                >
                  <BreadcrumbBackButtonContent aria-hidden="true">
                    {shouldAlwaysShowBackArrow ? (
                      <BreadcrumbBackButtonIcon>
                        <RiArrowLeftLine />
                      </BreadcrumbBackButtonIcon>
                    ) : (
                      <>
                        <BreadcrumbBackButtonEntityIcon>{icon}</BreadcrumbBackButtonEntityIcon>
                        <BreadcrumbBackButtonArrow>
                          <RiArrowLeftLine />
                        </BreadcrumbBackButtonArrow>
                      </>
                    )}
                  </BreadcrumbBackButtonContent>
                </BreadcrumbBackButton>
              </Skeleton>
            </CompactBackButtonSlot>
            {avatar && (
              <CompactAvatarSlot $visible={!isExpanded} aria-hidden={isExpanded}>
                <Skeleton active={skeleton} borderRadius={6}>
                  {avatar(24)}
                </Skeleton>
              </CompactAvatarSlot>
            )}
            <DetailsBreadcrumbs
              breadcrumbs={visibleBreadcrumbs}
              currentLabel={entityLabel}
              skeleton={skeleton}
            />
          </EntityIdentity>

          {(tabs?.length || actions?.length) && (
            <HeaderControls>
              {tabs?.length ? <DetailsTabs tabs={tabs} skeleton={skeleton} /> : null}
              {actions?.length ? (
                <DetailsActions actions={actions} skeleton={skeleton} />
              ) : null}
            </HeaderControls>
          )}
        </EntityHeader>

        <ExpandedIdentity
          $expanded={isExpanded}
          $contentHeight={expandedHeaderHeight}
          aria-hidden={!isExpanded}
        >
          <ExpandedIdentityContent ref={expandedIdentityRef}>
            {avatar && (
              <ExpandedAvatarSlot>
                <Skeleton active={skeleton} borderRadius={10}>
                  {avatar(56)}
                </Skeleton>
              </ExpandedAvatarSlot>
            )}
            <ExpandedEntityCopy>
              <Skeleton active={skeleton} borderRadius={6}>
                <ExpandedEntityTitle>
                  <Title as="h1" size="6" weight="strong" color="gray900" truncate>
                    {entityLabel}
                  </Title>
                </ExpandedEntityTitle>
              </Skeleton>

              {entity?.description && (
                <ExpandedEntityDescription>
                  <Text as="p" size="2" weight="medium" color="gray650">
                    {entity.description}
                  </Text>
                </ExpandedEntityDescription>
              )}
            </ExpandedEntityCopy>
          </ExpandedIdentityContent>
        </ExpandedIdentity>
      </Header>

      <HeaderSpacer
        $reserved={shouldReserveExpandedSpace}
        $height={expandedHeaderHeight}
        aria-hidden="true"
      />

      <Body $isMainPage={isMainPage}>{children}</Body>
    </DetailsLayoutContext.Provider>
  );
};
