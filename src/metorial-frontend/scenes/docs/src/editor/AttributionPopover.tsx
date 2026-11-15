import type { Editor as TiptapEditor } from '@tiptap/react';
import { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { Avatar } from '../components/Avatar';
import { Popover } from '../components/Popover';
import { getBlockEditorsAtDom } from './extensions/EditorAttribution';

export type AttributionPerson = {
  id: string;
  name: string;
  email?: string;
  imageUrl?: string;
  color: string;
};

let OPEN_DELAY_MS = 150;
let CLOSE_DELAY_MS = 200;

let List = styled.div`
  display: flex;
  flex-direction: column;
  padding: 6px 0;
`;

let Title = styled.div`
  padding: 6px 12px 8px;
  font-size: 11px;
  font-weight: 600;
  color: ${({ theme }) => theme.color.textSubtle};
`;

let Row = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 5px 12px;
  font-size: 13px;
`;

let Name = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: ${({ theme }) => theme.color.text};
`;

let PrimaryBadge = styled.span`
  font-size: 11px;
  font-weight: 600;
  color: ${({ theme }) => theme.color.textMuted};
  background: ${({ theme }) => theme.color.bgActive};
  padding: 1px 6px;
  border-radius: 999px;
`;

let isOverAttributionBar = (event: MouseEvent, block: Element) =>
  event.clientX < block.getBoundingClientRect().left;

export function AttributionPopover({
  editor,
  resolvePerson
}: {
  editor: TiptapEditor;
  resolvePerson: (actorId: string) => AttributionPerson;
}) {
  let [hovered, setHovered] = useState<{
    editors: string[];
    anchor: { left: number; top: number };
  } | null>(null);
  let timerRef = useRef<number | null>(null);
  let overPopoverRef = useRef(false);

  useEffect(() => {
    let root = editor.view.dom;

    let clearTimer = () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = null;
    };

    let scheduleClose = () => {
      clearTimer();
      timerRef.current = window.setTimeout(() => {
        if (!overPopoverRef.current) setHovered(null);
      }, CLOSE_DELAY_MS);
    };

    let onMouseMove = (event: MouseEvent) => {
      let target = event.target instanceof Element ? event.target : null;
      let block = target?.closest<HTMLElement>('.docs-attributed');
      if (!block || !root.contains(block) || !isOverAttributionBar(event, block)) {
        if (hovered) scheduleClose();
        return;
      }

      clearTimer();
      timerRef.current = window.setTimeout(() => {
        let editors = getBlockEditorsAtDom(editor.view, block!);
        if (!editors?.length) return;

        let rect = block!.getBoundingClientRect();
        setHovered({ editors, anchor: { left: rect.left - 8, top: rect.bottom + 4 } });
      }, OPEN_DELAY_MS);
    };

    root.addEventListener('mousemove', onMouseMove);
    root.addEventListener('mouseleave', scheduleClose);

    return () => {
      clearTimer();
      root.removeEventListener('mousemove', onMouseMove);
      root.removeEventListener('mouseleave', scheduleClose);
    };
  }, [editor, hovered]);

  return (
    <Popover
      open={!!hovered}
      anchor={hovered?.anchor ?? { left: 0, top: 0 }}
      width={260}
      onClose={() => setHovered(null)}
    >
      <List
        onMouseEnter={() => {
          overPopoverRef.current = true;
        }}
        onMouseLeave={() => {
          overPopoverRef.current = false;
          setHovered(null);
        }}
      >
        <Title>Edited by</Title>
        {hovered?.editors.map((actorId, index) => {
          let person = resolvePerson(actorId);

          return (
            <Row key={actorId}>
              <Avatar
                name={person.name}
                imageUrl={person.imageUrl}
                email={person.email}
                size={22}
                noTooltip
              />
              <Name>{person.name}</Name>
              {index === 0 && <PrimaryBadge>Primary</PrimaryBadge>}
            </Row>
          );
        })}
      </List>
    </Popover>
  );
}
