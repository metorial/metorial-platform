import { theme } from '@metorial/ui';
import { RiCloseLine, RiDraggable } from '@remixicon/react';
import { useState } from 'react';
import styled from 'styled-components';

let Wrapper = styled.div`
  display: flex;
  align-items: stretch;
  flex-shrink: 0;
  gap: 1px;
  overflow-x: auto;
  border-bottom: 1px solid ${theme.colors.gray400};
  background: ${theme.colors.gray300};
`;

let TabSlot = styled.div`
  position: relative;
  display: flex;
  flex-shrink: 0;
`;

let TabButton = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  max-width: 260px;
  padding: 10px 12px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: ${theme.colors.background};
  color: ${theme.colors.gray700};
  cursor: pointer;
  flex-shrink: 0;
  transition:
    background 0.18s ease,
    color 0.18s ease,
    border-color 0.18s ease;

  &[data-active='true'] {
    color: ${theme.colors.foreground};
    border-bottom-color: ${theme.colors.blue800};
  }

  &:focus-visible {
    outline: 2px solid ${theme.colors.blue700};
    outline-offset: -2px;
  }

  &:hover {
    background: ${theme.colors.gray100};
  }
`;

let DropIndicator = styled.div`
  position: absolute;
  top: 6px;
  bottom: 6px;
  width: 2px;
  border-radius: 999px;
  background: ${theme.colors.blue800};
  pointer-events: none;

  &[data-position='before'] {
    left: -1px;
  }

  &[data-position='after'] {
    right: -1px;
  }
`;

let Label = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 500;
`;

let Accent = styled.span`
  width: 8px;
  height: 8px;
  border-radius: 999px;
  flex-shrink: 0;
  background: var(--accent-color);
`;

let CloseButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  border: 0;
  background: transparent;
  color: ${theme.colors.gray600};
  cursor: pointer;
  flex-shrink: 0;
  padding: 0;

  svg {
    width: 16px;
    height: 16px;
  }

  &:hover {
    background: ${theme.colors.gray300};
    color: ${theme.colors.foreground};
  }
`;

let DragHandle = styled.span`
  display: inline-flex;
  align-items: center;
  color: ${theme.colors.gray500};
  flex-shrink: 0;
`;

export type EditorTabItem = {
  id: string;
  label: string;
  accentColor?: string;
};

type DropPosition = 'before' | 'after';

export let EditorTabs = ({
  tabs,
  activeId,
  onSelect,
  onClose,
  onReorder
}: {
  tabs: EditorTabItem[];
  activeId?: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onReorder?: (sourceId: string, targetId: string, position: DropPosition) => void;
}) => {
  let [dragSourceId, setDragSourceId] = useState<string | null>(null);
  let [dropTarget, setDropTarget] = useState<{
    targetId: string;
    position: DropPosition;
  } | null>(null);

  let resetDrag = () => {
    setDragSourceId(null);
    setDropTarget(null);
  };

  return (
    <Wrapper>
      {tabs.map(tab => (
        <TabSlot key={tab.id}>
          {dropTarget?.targetId === tab.id && dropTarget.position === 'before' && (
            <DropIndicator data-position="before" />
          )}

          <TabButton
            data-active={tab.id === activeId}
            role="button"
            tabIndex={0}
            draggable={Boolean(onReorder)}
            onClick={() => onSelect(tab.id)}
            onKeyDown={event => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              onSelect(tab.id);
            }}
            onDragStart={event => {
              if (!onReorder) return;
              setDragSourceId(tab.id);
              event.dataTransfer.setData('text/plain', tab.id);
              event.dataTransfer.effectAllowed = 'move';
            }}
            onDragEnd={resetDrag}
            onDragOver={event => {
              if (!onReorder) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';

              let rect = event.currentTarget.getBoundingClientRect();
              let position: DropPosition =
                event.clientX - rect.left < rect.width / 2 ? 'before' : 'after';

              setDropTarget({
                targetId: tab.id,
                position
              });
            }}
            onDragLeave={event => {
              if (!onReorder) return;
              let relatedTarget = event.relatedTarget;
              if (relatedTarget instanceof Node && event.currentTarget.contains(relatedTarget)) {
                return;
              }

              setDropTarget(current => (current?.targetId === tab.id ? null : current));
            }}
            onDrop={event => {
              if (!onReorder) return;
              event.preventDefault();

              let sourceId = event.dataTransfer.getData('text/plain');
              let position = dropTarget?.targetId === tab.id ? dropTarget.position : 'before';

              resetDrag();

              if (!sourceId || sourceId === tab.id) return;
              onReorder(sourceId, tab.id, position);
            }}
          >
            {onReorder && (
              <DragHandle>
                <RiDraggable size={14} />
              </DragHandle>
            )}

            {tab.accentColor && (
              <Accent style={{ ['--accent-color' as string]: tab.accentColor }} />
            )}
            <Label>{tab.label}</Label>

            <CloseButton
              type="button"
              onClick={event => {
                event.stopPropagation();
                onClose(tab.id);
              }}
              aria-label={`Close ${tab.label}`}
            >
              <RiCloseLine size={14} />
            </CloseButton>
          </TabButton>

          {dropTarget?.targetId === tab.id && dropTarget.position === 'after' && (
            <DropIndicator data-position="after" />
          )}
        </TabSlot>
      ))}
    </Wrapper>
  );
};
