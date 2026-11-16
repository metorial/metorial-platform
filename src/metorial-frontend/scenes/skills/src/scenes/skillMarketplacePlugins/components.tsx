import { useDraggable, useDroppable } from '@dnd-kit/core';
import {
  Button,
  Checkbox,
  Menu,
  type MenuItem,
  Skeleton,
  Spinner,
  Text,
  Tooltip,
  theme
} from '@metorial/ui';
import {
  RiAddLine,
  RiArrowRightSLine,
  RiDraggable,
  RiErrorWarningLine,
  RiFolderTransferLine,
  RiLockLine,
  RiLoopLeftLine,
  RiMore2Line,
  RiStackLine
} from '@remixicon/react';
import { AnimatePresence, motion } from 'framer-motion';
import React from 'react';
import { Link } from 'react-router-dom';
import styled, { css, keyframes } from 'styled-components';
import {
  type MoveDestination,
  type PluginGroupView,
  type SkillEntry,
  formatRelativeTime
} from './hierarchy';

export type DropState = 'idle' | 'available' | 'blocked';

let rowHeight = 44;
let headerHeight = 60;
let layoutTransition = { type: 'spring', stiffness: 520, damping: 42, mass: 0.7 } as const;
let collapseTransition = { duration: 0.2, ease: [0.2, 0.8, 0.2, 1] } as const;
let flashIn = keyframes`
  0%, 35% { background: ${theme.colors.blue300}; }
  100% { background: transparent; }
`;

let ImageTile = styled.img<{ $size: number }>`
  display: block;
  flex: 0 0 auto;
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  border-radius: 22%;
  object-fit: cover;
  background: ${theme.colors.gray250};
`;

export let SkillImage = (p: { src: string | null | undefined; size: number }) =>
  p.src ? (
    <ImageTile src={p.src} $size={p.size} alt="" loading="lazy" draggable={false} />
  ) : (
    <ImageTile as="span" $size={p.size} />
  );

let Truncate = styled.div`
  min-width: 0;

  p,
  span {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

let CheckboxSlot = styled.span<{ $visible: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  opacity: ${({ $visible }) => ($visible ? 1 : 0)};
  transition: opacity 120ms ease;

  &:focus-within {
    opacity: 1;
  }
`;

let HandleSlot = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 28px;
`;

let DragHandle = styled.button`
  width: 20px;
  height: 28px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 6px;
  color: ${theme.colors.gray600};
  background: transparent;
  cursor: grab;
  opacity: 0;
  transition:
    opacity 120ms ease,
    background 120ms ease,
    color 120ms ease;
  touch-action: none;

  &:hover {
    color: ${theme.colors.gray900};
    background: ${theme.colors.gray300};
  }

  &:focus-visible {
    opacity: 1;
    outline: 2px solid ${theme.colors.blue800};
  }

  &:active {
    cursor: grabbing;
  }

  svg {
    width: 16px;
    height: 16px;
  }
`;

let RowActions = styled.div<{ $hidden?: boolean }>`
  display: flex;
  align-items: center;
  gap: 4px;
  visibility: ${({ $hidden }) => ($hidden ? 'hidden' : 'visible')};
`;

let RowMenuSlot = styled.div`
  opacity: 0;
  transition: opacity 120ms ease;

  &:focus-within,
  &:has([data-state='open']) {
    opacity: 1;
  }
`;

let Row = styled.div<{
  $selected: boolean;
  $dimmed: boolean;
  $pending: boolean;
  $flash: boolean;
  $indent: boolean;
  $inaccessible: boolean;
}>`
  position: relative;
  height: ${rowHeight}px;
  box-sizing: border-box;
  padding: 0 10px 0 ${({ $indent }) => ($indent ? 26 : 8)}px;
  display: grid;
  grid-template-columns: 20px 20px 28px minmax(0, 1fr) 92px 26px;
  align-items: center;
  gap: 10px;
  border-top: 1px solid ${theme.colors.gray400};
  background: ${({ $selected }) => ($selected ? theme.colors.gray200 : 'transparent')};
  opacity: ${({ $dimmed, $pending }) => ($dimmed ? 0.4 : $pending ? 0.72 : 1)};
  transition:
    background 120ms ease,
    opacity 160ms ease;

  ${({ $flash }) =>
    $flash &&
    css`
      animation: ${flashIn} 1.8s ease-out;
    `}

  ${({ $inaccessible }) =>
    $inaccessible &&
    css`
      color: ${theme.colors.gray600};

      img {
        filter: grayscale(1);
        opacity: 0.5;
      }
    `}

  &:hover {
    background: ${({ $selected }) => ($selected ? theme.colors.gray250 : theme.colors.gray100)};
  }

  &:hover ${DragHandle}, &:focus-within ${DragHandle} {
    opacity: 1;
  }

  &:hover ${CheckboxSlot} {
    opacity: 1;
  }

  &:hover ${RowMenuSlot}, &:focus-within ${RowMenuSlot} {
    opacity: 1;
  }

  @media (max-width: 720px) {
    grid-template-columns: 20px 20px 28px minmax(0, 1fr) 26px;

    & > [data-optional-column] {
      display: none;
    }
  }
`;

let rowMainStyles = css`
  min-width: 0;
  height: 100%;
  display: flex;
  align-items: center;
  color: inherit;
  text-decoration: none;
  border-radius: 6px;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid ${theme.colors.blue800};
    outline-offset: -2px;
  }
`;

let RowMain = styled.div<{ $inaccessible?: boolean }>`
  ${rowMainStyles}
  gap: 6px;
  cursor: ${({ $inaccessible }) => ($inaccessible ? 'default' : 'pointer')};

  & > svg {
    flex-shrink: 0;
    width: 14px;
    height: 14px;
    color: ${theme.colors.gray600};
  }
`;

let RowMainLink = styled(Link)`
  ${rowMainStyles}
`;

let UpdatedText = styled.span`
  font-size: 12px;
  color: ${theme.colors.gray600};
  text-align: right;
  white-space: nowrap;
`;

export let SkillRow = (p: {
  entry: SkillEntry;
  href?: string;
  selected: boolean;
  selectionActive: boolean;
  pending: boolean;
  dimmed: boolean;
  flash: boolean;
  indent: boolean;
  dragDisabled: boolean;
  menuItems: MenuItem[];
  onSelectedChange: (checked: boolean) => void;
}) => {
  let { skill } = p.entry;
  let drag = useDraggable({
    id: `skill:${skill.id}`,
    disabled: p.dragDisabled || p.pending,
    data: { entryKey: skill.id }
  });
  let name = skill.skill.name;
  let inaccessible = !p.entry.canRead;
  let main = (
    <Text size="2" weight="strong" color={inaccessible ? 'gray600' : undefined} truncate>
      {name}
    </Text>
  );
  let onMainPointerDown = (event: React.PointerEvent) =>
    drag.listeners?.onPointerDown?.(event);

  return (
    <motion.div
      layout="position"
      layoutId={`skill-row:${skill.id}`}
      transition={layoutTransition}
    >
      <Row
        ref={drag.setNodeRef}
        $selected={p.selected}
        $dimmed={p.dimmed}
        $pending={p.pending}
        $flash={p.flash}
        $indent={p.indent}
        $inaccessible={inaccessible}
        data-skill-row
      >
        <HandleSlot>
          {p.pending ? (
            <Spinner size={14} />
          ) : p.dragDisabled ? null : (
            <DragHandle
              ref={drag.setActivatorNodeRef}
              {...drag.listeners}
              {...drag.attributes}
              type="button"
              data-skill-drag-handle
              aria-label={`Move ${name}`}
              title="Drag to move"
            >
              <RiDraggable />
            </DragHandle>
          )}
        </HandleSlot>

        <CheckboxSlot $visible={p.selected || p.selectionActive}>
          {!p.dragDisabled && (
            <Checkbox
              label={`Select ${name}`}
              hideLabel
              checked={p.selected}
              disabled={p.pending}
              onCheckedChange={p.onSelectedChange}
            />
          )}
        </CheckboxSlot>

        <SkillImage src={skill.skill.imageUrl} size={28} />

        {inaccessible ? (
          <Tooltip content="You don't have access to this skill.">
            <RowMain $inaccessible onPointerDown={onMainPointerDown}>
              {main}
              <RiLockLine aria-label="No access" />
            </RowMain>
          </Tooltip>
        ) : p.href ? (
          <RowMainLink to={p.href} onPointerDown={onMainPointerDown} draggable={false}>
            {main}
          </RowMainLink>
        ) : (
          <RowMain onPointerDown={onMainPointerDown}>{main}</RowMain>
        )}

        <UpdatedText data-optional-column title={new Date(skill.updatedAt).toLocaleString()}>
          {formatRelativeTime(skill.skill.updatedAt ?? skill.updatedAt)}
        </UpdatedText>

        <RowMenuSlot>
          {p.menuItems.length > 0 && (
            <Menu items={p.menuItems}>
              <Button
                size="1"
                variant="ghost"
                aria-label={`${name} options`}
                title="Skill options"
                iconLeft={<RiMore2Line />}
                disabled={p.pending}
              />
            </Menu>
          )}
        </RowMenuSlot>
      </Row>
    </motion.div>
  );
};

let GroupCard = styled.section<{ $drop: DropState; $over: boolean; $pending: boolean }>`
  position: relative;
  border: 1px solid ${theme.colors.gray400};
  border-radius: 10px;
  background: ${theme.colors.background};
  box-shadow: ${theme.shadows.small};
  overflow: hidden;
  transition:
    border-color 140ms ease,
    box-shadow 140ms ease,
    opacity 160ms ease,
    background 140ms ease;
  opacity: ${({ $drop, $pending }) => ($drop === 'blocked' ? 0.5 : $pending ? 0.75 : 1)};

  ${({ $drop, $over }) =>
    $drop === 'available' &&
    !$over &&
    css`
      border-color: ${theme.colors.blue650};
      border-style: dashed;
    `}

  ${({ $over }) =>
    $over &&
    css`
      border-color: ${theme.colors.blue900};
      background: ${theme.colors.blue150};
      box-shadow: 0 0 0 3px ${theme.colors.blue400};
    `}
`;

let GroupHeader = styled.div`
  position: relative;
  height: ${headerHeight}px;
  box-sizing: border-box;
  padding: 0 10px 0 6px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

let HeaderToggle = styled.button`
  min-width: 0;
  height: 100%;
  flex: 1;
  padding: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  font: inherit;
  cursor: pointer;
  border-radius: 8px;

  &:focus-visible {
    outline: 2px solid ${theme.colors.blue800};
    outline-offset: -2px;
  }
`;

let Chevron = styled.span<{ $open: boolean }>`
  width: 20px;
  height: 20px;
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: ${theme.colors.gray600};
  transform: rotate(${({ $open }) => ($open ? 90 : 0)}deg);
  transition: transform 180ms ease;

  svg {
    width: 16px;
    height: 16px;
  }
`;

let HeaderTitle = styled(Truncate)`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

let HeaderMeta = styled.span`
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 12px;
  color: ${theme.colors.gray600};

  & > * {
    flex: 0 1 auto;
    min-width: 0;
  }
`;

let ReadOnlyBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  padding: 0 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  color: ${theme.colors.gray700};
  background: ${theme.colors.gray250};
  white-space: nowrap;

  svg {
    width: 12px;
    height: 12px;
  }
`;

let WarningBadge = styled(ReadOnlyBadge)`
  color: ${theme.colors.orange900};
  background: ${theme.colors.orange300};
`;

let DropHint = styled.span<{ $visible: boolean }>`
  position: absolute;
  right: 12px;
  top: 50%;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  color: ${theme.colors.background};
  background: ${theme.colors.blue900};
  pointer-events: none;
  opacity: ${({ $visible }) => ($visible ? 1 : 0)};
  transform: translateY(-50%) scale(${({ $visible }) => ($visible ? 1 : 0.94)});
  transition:
    opacity 120ms ease,
    transform 120ms ease;

  svg {
    width: 14px;
    height: 14px;
  }
`;

let EmptyGroupRow = styled.div`
  height: ${rowHeight}px;
  box-sizing: border-box;
  padding: 0 16px 0 66px;
  display: flex;
  align-items: center;
  gap: 8px;
  border-top: 1px solid ${theme.colors.gray400};
`;

let Collapsible = (p: { open: boolean; children: React.ReactNode }) => (
  <AnimatePresence initial={false}>
    {p.open && (
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={collapseTransition}
        style={{ overflow: 'hidden' }}
      >
        {p.children}
      </motion.div>
    )}
  </AnimatePresence>
);

let useDropTarget = (id: string, destination: MoveDestination, drop: DropState) => {
  let droppable = useDroppable({
    id,
    disabled: drop !== 'available',
    data: { destination }
  });

  return { ref: droppable.setNodeRef, isOver: droppable.isOver && drop === 'available' };
};

export let PluginGroup = (p: {
  view: PluginGroupView;
  open: boolean;
  drop: DropState;
  dragActive: boolean;
  pending: boolean;
  canUpdate: boolean;
  canEditSkills: boolean;
  menuItems: MenuItem[];
  onToggle: () => void;
  onAddSkills?: () => void;
  onOpenSkillGroup?: () => void;
  children: React.ReactNode;
}) => {
  let { plugin, item } = p.view;
  let skillGroup = plugin.source.type === 'skill_group' ? plugin.source : null;
  let target = useDropTarget(
    `plugin:${plugin.id}`,
    { type: 'plugin', pluginId: plugin.id },
    p.drop
  );
  return (
    <motion.div layout="position" transition={layoutTransition}>
      <GroupCard ref={target.ref} $drop={p.drop} $over={target.isOver} $pending={p.pending}>
        <GroupHeader>
          <HeaderToggle type="button" aria-expanded={p.open} onClick={p.onToggle}>
            <Chevron $open={p.open}>
              <RiArrowRightSLine />
            </Chevron>

            <SkillImage src={plugin.imageUrl} size={34} />

            <HeaderTitle>
              <Text size="2" weight="strong" truncate>
                {plugin.name}
              </Text>
              {(plugin.category || skillGroup) && (
                <HeaderMeta>
                  {plugin.category && <span>{plugin.category}</span>}
                  {skillGroup && (
                    <Truncate as="span">
                      <span>Synced from {skillGroup.skillGroup.name}</span>
                    </Truncate>
                  )}
                </HeaderMeta>
              )}
            </HeaderTitle>
          </HeaderToggle>

          <RowActions $hidden={p.dragActive}>
            {p.pending && <Spinner size={14} />}

            {skillGroup && skillGroup.unsyncedSkills.length > 0 && (
              <Tooltip content={skillGroup.unsyncedSkills[0].message}>
                <WarningBadge>
                  <RiErrorWarningLine />
                  {skillGroup.unsyncedSkills.length} not synced
                </WarningBadge>
              </Tooltip>
            )}

            {p.onOpenSkillGroup && (
              <Button
                size="1"
                variant="outline"
                iconLeft={<RiLoopLeftLine />}
                title="Skills are synced from this skill group. Add or remove them on the group."
                disabled={p.pending}
                onClick={p.onOpenSkillGroup}
              >
                Open Skill Group
              </Button>
            )}

            {!p.canUpdate && (
              <Tooltip content="This plugin is managed elsewhere, so its skills can't be changed here.">
                <ReadOnlyBadge>
                  <RiLockLine />
                  Read-only
                </ReadOnlyBadge>
              </Tooltip>
            )}

            {p.onAddSkills && (
              <Button
                size="1"
                variant="outline"
                iconLeft={<RiAddLine />}
                disabled={p.pending}
                onClick={p.onAddSkills}
              >
                Add
              </Button>
            )}

            {p.menuItems.length > 0 && (
              <Menu items={p.menuItems}>
                <Button
                  size="1"
                  variant="ghost"
                  aria-label={`${plugin.name} options`}
                  title="Plugin options"
                  iconLeft={<RiMore2Line />}
                  disabled={p.pending}
                />
              </Menu>
            )}
          </RowActions>

          <DropHint $visible={target.isOver}>
            <RiFolderTransferLine />
            Drop to move here
          </DropHint>
        </GroupHeader>

        <Collapsible open={p.open}>
          {p.view.skills.length ? (
            p.children
          ) : (
            <EmptyGroupRow>
              <Text size="2" color="gray600">
                {skillGroup
                  ? 'The skill group has no skills yet.'
                  : p.canEditSkills
                    ? 'No skills yet. Drag skills here or add some.'
                    : 'No skills yet.'}
              </Text>
            </EmptyGroupRow>
          )}
        </Collapsible>
      </GroupCard>
    </motion.div>
  );
};

let StandaloneIcon = styled.span`
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 22%;
  color: ${theme.colors.gray700};
  background: ${theme.colors.gray250};

  svg {
    width: 18px;
    height: 18px;
  }
`;

export let StandaloneSection = (p: {
  visibleCount: number;
  open: boolean;
  drop: DropState;
  onToggle: () => void;
  emptyMessage: string;
  children: React.ReactNode;
}) => {
  let target = useDropTarget('standalone', { type: 'standalone' }, p.drop);

  return (
    <motion.div layout="position" transition={layoutTransition}>
      <GroupCard ref={target.ref} $drop={p.drop} $over={target.isOver} $pending={false}>
        <GroupHeader>
          <HeaderToggle type="button" aria-expanded={p.open} onClick={p.onToggle}>
            <Chevron $open={p.open}>
              <RiArrowRightSLine />
            </Chevron>

            <StandaloneIcon>
              <RiStackLine />
            </StandaloneIcon>

            <HeaderTitle>
              <Text size="2" weight="strong" truncate>
                Standalone Skills
              </Text>
              <HeaderMeta>
                <span>Listed on their own, without a plugin</span>
              </HeaderMeta>
            </HeaderTitle>
          </HeaderToggle>

          <DropHint $visible={target.isOver}>
            <RiFolderTransferLine />
            Drop to list on its own
          </DropHint>
        </GroupHeader>

        <Collapsible open={p.open}>
          {p.visibleCount ? (
            p.children
          ) : (
            <EmptyGroupRow>
              <Text size="2" color="gray600">
                {p.emptyMessage}
              </Text>
            </EmptyGroupRow>
          )}
        </Collapsible>
      </GroupCard>
    </motion.div>
  );
};

let PreviewStack = styled.div`
  position: relative;
  width: min(420px, 80vw);
  cursor: grabbing;
`;

let PreviewCard = styled.div`
  position: relative;
  z-index: 1;
  height: ${rowHeight}px;
  padding: 0 14px;
  box-sizing: border-box;
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  border: 1px solid ${theme.colors.gray400};
  border-radius: 10px;
  background: ${theme.colors.background};
  box-shadow:
    0 12px 28px rgba(0, 0, 0, 0.14),
    0 2px 6px rgba(0, 0, 0, 0.08);
  transform: rotate(-1deg);
`;

let PreviewShadowCard = styled.div<{ $depth: number }>`
  position: absolute;
  inset: 0;
  border: 1px solid ${theme.colors.gray400};
  border-radius: 10px;
  background: ${theme.colors.gray100};
  transform: translate(${({ $depth }) => $depth * 5}px, ${({ $depth }) => $depth * 5}px)
    rotate(${({ $depth }) => $depth * 1.2}deg);
`;

let PreviewCount = styled.span`
  min-width: 22px;
  height: 22px;
  padding: 0 7px;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 11px;
  font-size: 12px;
  font-weight: 600;
  color: ${theme.colors.background};
  background: ${theme.colors.blue900};
`;

export let DragPreview = (p: { entry: SkillEntry; count: number }) => (
  <PreviewStack>
    {p.count > 2 && <PreviewShadowCard $depth={2} />}
    {p.count > 1 && <PreviewShadowCard $depth={1} />}

    <PreviewCard>
      <SkillImage src={p.entry.skill.skill.imageUrl} size={28} />
      <Truncate>
        <Text size="2" weight="strong" truncate>
          {p.entry.skill.skill.name}
        </Text>
      </Truncate>
      {p.count > 1 && <PreviewCount>{p.count}</PreviewCount>}
    </PreviewCard>
  </PreviewStack>
);

let BulkWrapper = styled.div`
  position: fixed;
  bottom: 60px;
  left: 0;
  right: 0;
  z-index: 50;
  display: flex;
  justify-content: center;
  pointer-events: none;
`;

let BulkBarInner = styled(motion.div)`
  background: ${theme.colors.foreground};
  border: 1px solid ${theme.colors.gray300};
  padding: 12px 20px;
  border-radius: 100px;
  max-width: 500px;
  overflow-x: auto;
  box-shadow: ${theme.shadows.small};
  display: flex;
  gap: 10px;
  align-items: center;
  pointer-events: auto;
  white-space: nowrap;
`;

export let BulkBar = (p: {
  count: number;
  moveItems: MenuItem[];
  canRemove: boolean;
  onRemove: () => void;
  onClear: () => void;
}) => (
  <BulkWrapper>
    <AnimatePresence>
      {p.count > 0 && (
        <BulkBarInner
          role="toolbar"
          aria-label="Selected skills"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.5 }}
          transition={{ duration: 0.4, type: 'spring', bounce: 0.35 }}
        >
          <Text size="1" color="gray400" weight="medium">
            <strong>{p.count}</strong> {p.count === 1 ? 'skill' : 'skills'} selected
          </Text>

          <Menu items={p.moveItems} disabled={!p.moveItems.length}>
            <Button size="1" disabled={!p.moveItems.length}>
              Move To
            </Button>
          </Menu>

          {p.canRemove && (
            <Button size="1" color="red" onClick={p.onRemove}>
              Remove
            </Button>
          )}

          <Button size="1" onClick={p.onClear}>
            Clear Selection
          </Button>
        </BulkBarInner>
      )}
    </AnimatePresence>
  </BulkWrapper>
);

export let ListStack = styled(motion.div)`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

let SkeletonGroup = styled.div`
  border: 1px solid ${theme.colors.gray400};
  border-radius: 10px;
  box-shadow: ${theme.shadows.small};
  overflow: hidden;
`;

let SkeletonHeader = styled.div`
  height: ${headerHeight}px;
  padding: 0 16px 0 32px;
  display: flex;
  align-items: center;
  gap: 10px;
`;

let SkeletonRow = styled.div`
  height: ${rowHeight}px;
  padding: 0 16px 0 82px;
  display: flex;
  align-items: center;
  gap: 10px;
  border-top: 1px solid ${theme.colors.gray400};
`;

let SkeletonBlock = (p: { width: number; height: number; radius?: number }) => (
  <Skeleton active borderRadius={p.radius ?? 6}>
    <span style={{ display: 'block', width: p.width, height: p.height }} />
  </Skeleton>
);

export let ListSkeleton = () => (
  <ListStack aria-busy="true">
    {[3, 2].map((rows, group) => (
      <SkeletonGroup key={group}>
        <SkeletonHeader>
          <SkeletonBlock width={34} height={34} radius={8} />
          <SkeletonBlock width={160 - group * 30} height={14} />
        </SkeletonHeader>
        {Array.from({ length: rows }).map((_, row) => (
          <SkeletonRow key={row}>
            <SkeletonBlock width={28} height={28} radius={7} />
            <SkeletonBlock width={220 - row * 40} height={12} />
          </SkeletonRow>
        ))}
      </SkeletonGroup>
    ))}
  </ListStack>
);
