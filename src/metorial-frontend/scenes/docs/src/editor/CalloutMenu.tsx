import { useCallback, useMemo } from 'react';
import { BubbleMenu } from '@tiptap/react/menus';
import type { Editor } from '@tiptap/react';
import { PluginKey } from '@tiptap/pm/state';
import styled from 'styled-components';
import { menuEnter } from './animations';
import type { CalloutType } from './extensions/Callout';
import { IconTrash } from './icons';

let Floating = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  background: ${({ theme }) => theme.color.bgElevated};
  border: 1px solid ${({ theme }) => theme.color.border};
  border-radius: 10px;
  box-shadow: ${({ theme }) => theme.shadow.lg};
  transform-origin: center bottom;
  ${menuEnter(140)}
`;

let TypeBtn = styled.button<{ $type: CalloutType; $active?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 10px;
  border: 1px solid
    ${({ theme, $type, $active }) =>
      $active ? theme.color.callout[$type].text : theme.color.callout[$type].border};
  background: ${({ theme, $type, $active }) =>
    $active ? theme.color.callout[$type].bg : 'transparent'};
  color: ${({ theme, $type }) => theme.color.callout[$type].text};
  border-radius: ${({ theme }) => theme.size.radiusSm};
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition:
    background ${({ theme }) => theme.motion.fast},
    border-color ${({ theme }) => theme.motion.fast};
  text-transform: capitalize;

  &:hover {
    background: ${({ theme, $type }) => theme.color.callout[$type].bg};
  }

  &::before {
    content: '';
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: ${({ theme, $type }) => theme.color.callout[$type].text};
  }
`;

let Divider = styled.span`
  display: inline-block;
  width: 1px;
  height: 18px;
  margin: 0 2px;
  background: ${({ theme }) => theme.color.border};
`;

let RemoveBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  background: transparent;
  color: ${({ theme }) => theme.color.danger};
  border-radius: ${({ theme }) => theme.size.radiusSm};
  cursor: pointer;
  transition: background ${({ theme }) => theme.motion.fast};

  &:hover {
    background: ${({ theme }) => theme.color.callout.danger.bg};
  }

  svg {
    width: 14px;
    height: 14px;
  }
`;

let TYPES: CalloutType[] = ['info', 'warning', 'success', 'danger'];

let calloutMenuPluginKey = new PluginKey('calloutMenu');
let CALLOUT_MENU_OPTIONS = {
  placement: 'top',
  offset: 8,
  flip: false,
  shift: { padding: 8 }
} as const;

let calloutShouldShow = ({ editor }: { editor: Editor }) => editor.isActive('callout');

function findActiveCalloutDOM(editor: Editor): HTMLElement | null {
  let { $head } = editor.state.selection;
  for (let depth = $head.depth; depth >= 0; depth--) {
    let node = $head.node(depth);
    if (node.type.name === 'callout') {
      let pos = depth === 0 ? 0 : $head.before(depth);
      let dom = editor.view.nodeDOM(pos);
      return dom instanceof HTMLElement ? dom : null;
    }
  }
  return null;
}

interface Props {
  editor: Editor | null;
}

export function CalloutMenu({ editor }: Props) {
  let setType = useCallback(
    (type: CalloutType) => {
      if (!editor) return;
      editor.chain().focus().updateAttributes('callout', { type }).run();
    },
    [editor]
  );

  let removeCallout = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().unsetCallout().run();
  }, [editor]);

  let options = useMemo(() => CALLOUT_MENU_OPTIONS, []);

  let getReferencedVirtualElement = useCallback(() => {
    if (!editor) return null;
    let dom = findActiveCalloutDOM(editor);
    if (!dom) return null;
    return {
      getBoundingClientRect: () => dom.getBoundingClientRect(),
      contextElement: dom
    };
  }, [editor]);

  if (!editor) return null;

  let activeType = (editor.getAttributes('callout').type ?? 'info') as CalloutType;

  return (
    <BubbleMenu
      editor={editor}
      pluginKey={calloutMenuPluginKey}
      options={options}
      shouldShow={calloutShouldShow}
      getReferencedVirtualElement={getReferencedVirtualElement}
    >
      <Floating onMouseDown={e => e.preventDefault()}>
        {TYPES.map(t => (
          <TypeBtn
            key={t}
            type="button"
            $type={t}
            $active={activeType === t}
            title={`${t.charAt(0).toUpperCase()}${t.slice(1)} callout`}
            onClick={() => setType(t)}
          >
            {t}
          </TypeBtn>
        ))}
        <Divider />
        <RemoveBtn type="button" title="Remove callout" onClick={removeCallout}>
          <IconTrash />
        </RemoveBtn>
      </Floating>
    </BubbleMenu>
  );
}
