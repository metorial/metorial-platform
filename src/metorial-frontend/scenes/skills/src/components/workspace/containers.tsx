import { FloatingPopover, floatingSurface, NavIconButton, theme } from '@metorial/ui';
import { Reorder, useDragControls } from 'framer-motion';
import type { ReactNode } from 'react';
import type { RefObject } from 'react';
import { useRef, useState } from 'react';
import styled, { css } from 'styled-components';
import { PANEL_COLUMN_WIDTH, SIDEBAR_INSET, SIDEBAR_WIDTH } from './layout';
import { usePresence, workspaceEase } from './motion';
import type { WorkspacePanelId } from './preferences';
import { SectionDragHandleContext, type WorkspaceSectionVariant } from './section';

export type WorkspaceSectionEntry = {
  id: WorkspacePanelId;
  title: string;
  icon: ReactNode;
  count?: number;
  render: (variant: WorkspaceSectionVariant) => ReactNode;
};

let Column = styled.div<{ $side: 'left' | 'right'; $away?: boolean }>`
  position: absolute;
  top: calc(var(--chrome-bottom, 70px) - 8px);
  ${({ $side }) => ($side == 'left' ? 'left: 0;' : 'right: 0;')}
  z-index: 30;
  display: flex;
  flex-direction: column;
  width: ${PANEL_COLUMN_WIDTH}px;
  max-height: calc(
    100% - var(--chrome-bottom, 70px) + 8px -
      ${({ $side }) =>
        $side == 'left' ? 'var(--panels-left-bottom, 0px)' : 'var(--panels-right-bottom, 0px)'}
  );
  padding: 6px 12px 14px;
  overflow-x: hidden;
  overflow-y: auto;
  box-sizing: border-box;
  scrollbar-width: none;
  pointer-events: none;
  transition:
    top 0.3s ${workspaceEase},
    opacity 0.25s ${workspaceEase},
    transform 0.35s ${workspaceEase};

  &::-webkit-scrollbar {
    display: none;
  }

  ${({ $away }) =>
    $away &&
    css`
      opacity: 0;
      transform: translateX(24px);
    `}
`;

let Slot = styled.div<{ $state: 'entering' | 'present' | 'leaving' }>`
  display: grid;
  grid-template-rows: ${({ $state }) => ($state == 'present' ? '1fr' : '0fr')};
  opacity: ${({ $state }) => ($state == 'present' ? 1 : 0)};
  transform: ${({ $state }) => ($state == 'present' ? 'none' : 'translateY(-6px)')};
  pointer-events: ${({ $state }) => ($state == 'leaving' ? 'none' : 'auto')};
  transition:
    grid-template-rows 0.34s ${workspaceEase},
    opacity 0.24s ease,
    transform 0.34s ${workspaceEase};
`;

let SlotInner = styled.div<{ $flush?: boolean }>`
  min-height: 0;
  overflow: hidden;
  padding: ${({ $flush }) => ($flush ? '0' : '0 2px')};

  > section {
    margin: ${({ $flush }) => ($flush ? '0' : '2px 0 10px')};
  }
`;

let SectionSlot = (p: {
  id: WorkspacePanelId;
  state: 'entering' | 'present' | 'leaving';
  flush?: boolean;
  draggable: boolean;
  constraints?: RefObject<HTMLElement | null>;
  children: ReactNode;
}) => {
  let controls = useDragControls();
  let [dragging, setDragging] = useState(false);

  let content = (
    <Slot $state={p.state} data-section={p.id}>
      <SlotInner $flush={p.flush}>{p.children}</SlotInner>
    </Slot>
  );

  if (!p.draggable) return content;

  return (
    <Reorder.Item
      value={p.id}
      dragListener={false}
      dragControls={controls}
      dragConstraints={p.constraints}
      dragElastic={0}
      onDragStart={() => setDragging(true)}
      onDragEnd={() => setDragging(false)}
      style={{ position: 'relative', zIndex: dragging ? 2 : 0, listStyle: 'none' }}
      whileDrag={{ scale: 1.01, filter: 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.08))' }}
      transition={{ duration: 0.2 }}
    >
      <SectionDragHandleContext.Provider
        value={{ dragging, onPointerDown: event => controls.start(event) }}
      >
        {content}
      </SectionDragHandleContext.Provider>
    </Reorder.Item>
  );
};

let SectionStack = (p: {
  sections: WorkspaceSectionEntry[];
  variant: WorkspaceSectionVariant;
  flush?: boolean;
  animateInitial?: boolean;
  onReorder?: (ids: WorkspacePanelId[]) => void;
}) => {
  let items = usePresence(
    p.sections.map(section => ({ key: section.id, value: section })),
    { animateInitial: p.animateInitial }
  );

  let groupRef = useRef<HTMLElement | null>(null);
  let draggable = !!p.onReorder && p.sections.length > 1;
  let present = items.filter(item => item.state != 'leaving').map(item => item.key);

  let slots = items.map(item => (
    <SectionSlot
      key={item.key}
      id={item.key as WorkspacePanelId}
      state={item.state}
      flush={p.flush}
      draggable={draggable && item.state != 'leaving'}
      constraints={groupRef}
    >
      {item.value.render(p.variant)}
    </SectionSlot>
  ));

  if (!draggable) return <>{slots}</>;

  return (
    <Reorder.Group
      ref={groupRef as RefObject<HTMLUListElement | null>}
      axis="y"
      values={present}
      onReorder={ids => p.onReorder?.(ids as WorkspacePanelId[])}
      style={{ margin: 0, padding: 0, listStyle: 'none' }}
    >
      {slots}
    </Reorder.Group>
  );
};

export let PanelColumn = (p: {
  side: 'left' | 'right';
  sections: WorkspaceSectionEntry[];
  away?: boolean;
  onReorder?: (ids: WorkspacePanelId[]) => void;
}) => (
  <Column $side={p.side} $away={p.away} aria-hidden={p.away || undefined}>
    <SectionStack sections={p.sections} variant="floating" onReorder={p.onReorder} />
  </Column>
);

let DockRail = styled.div<{ $visible: boolean }>`
  ${floatingSurface};
  position: absolute;
  top: 50%;
  left: 12px;
  z-index: 31;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 3px;
  border-radius: 10px;
  transform: translateY(-50%) translateX(${({ $visible }) => ($visible ? '0' : '-12px')});
  opacity: ${({ $visible }) => ($visible ? 1 : 0)};
  pointer-events: ${({ $visible }) => ($visible ? 'auto' : 'none')};
  transition:
    opacity 0.22s ease,
    transform 0.3s ${workspaceEase};

  button {
    width: 34px;
    height: 34px;
  }
`;

let FlyoutBody = styled.div`
  max-height: min(560px, calc(100vh - 160px));
  overflow-y: auto;

  > section {
    border: 0;
    border-radius: 0;
    box-shadow: none;
  }
`;

export let PanelDock = (p: { sections: WorkspaceSectionEntry[]; visible: boolean }) => {
  let [open, setOpen] = useState<WorkspacePanelId | null>(null);

  return (
    <DockRail $visible={p.visible && p.sections.length > 0}>
      {p.sections.map(section => (
        <FloatingPopover
          key={section.id}
          open={open == section.id}
          onOpenChange={value => setOpen(value ? section.id : null)}
          side="right"
          align="center"
          sideOffset={12}
          width={280}
          trigger={
            <NavIconButton
              icon={section.icon}
              badge={section.count || undefined}
              label={section.title}
              tooltip={section.title}
              tooltipSide="right"
              active={open == section.id}
            />
          }
        >
          <FlyoutBody>{section.render('flyout')}</FlyoutBody>
        </FloatingPopover>
      ))}
    </DockRail>
  );
};

let SidebarRoot = styled.aside<{ $visible: boolean }>`
  ${floatingSurface};
  position: absolute;
  top: ${SIDEBAR_INSET}px;
  bottom: ${SIDEBAR_INSET}px;
  left: ${SIDEBAR_INSET}px;
  z-index: 41;
  display: flex;
  flex-direction: column;
  width: ${SIDEBAR_WIDTH}px;
  border-radius: 12px;
  overflow: hidden;
  box-sizing: border-box;
  opacity: ${({ $visible }) => ($visible ? 1 : 0)};
  pointer-events: ${({ $visible }) => ($visible ? 'auto' : 'none')};
  transform: ${({ $visible }) => ($visible ? 'none' : 'translateX(-16px)')};
  transition:
    opacity 0.25s ${workspaceEase},
    transform 0.35s ${workspaceEase};
`;

let SidebarSections = styled.div`
  flex: 1;
  min-height: 0;
  padding: 6px 0;
  overflow-y: auto;
  scrollbar-width: thin;

  [data-section] + [data-section] section {
    border-top: 1px solid ${theme.colors.gray300};
  }
`;

let SidebarFooter = styled.div`
  flex: 0 0 auto;
  padding: 6px;
  border-top: 1px solid ${theme.colors.gray300};
`;

export let WorkspaceSidebar = (p: {
  visible: boolean;
  sections: WorkspaceSectionEntry[];
  footer: ReactNode;
}) => (
  <SidebarRoot $visible={p.visible} aria-hidden={!p.visible || undefined}>
    <SidebarSections>
      {p.visible ? <SectionStack sections={p.sections} variant="sidebar" flush /> : null}
    </SidebarSections>
    <SidebarFooter>{p.footer}</SidebarFooter>
  </SidebarRoot>
);
