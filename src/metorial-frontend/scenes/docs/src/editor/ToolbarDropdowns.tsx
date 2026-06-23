import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import type { Editor, Range } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import { Tooltip } from '@metorial/ui';
import styled from 'styled-components';
import { BlocksPopover } from './BlocksPopover';
import { slashItems, type SlashItem } from './SlashMenu';
import {
  IconBulletList,
  IconCallout,
  IconChevronDown,
  IconCodeBlock,
  IconEquation,
  IconH1,
  IconH2,
  IconH3,
  IconH4,
  IconH5,
  IconH6,
  IconMore,
  IconOrderedList,
  IconQuote,
  IconTaskList,
  IconText,
  IconType
} from './icons';

let TriggerBtn = styled.button<{ $active?: boolean; $expanded?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 32px;
  padding: 0 6px 0 8px;
  border: 0;
  background: ${({ $active, $expanded, theme }) =>
    $expanded ? theme.color.bgActive : $active ? theme.color.bgActive : 'transparent'};
  color: ${({ $active, theme }) => ($active ? theme.color.accent : theme.color.text)};
  border-radius: ${({ theme }) => theme.size.radiusSm};
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  line-height: 1;
  transition: background ${({ theme }) => theme.motion.fast};

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.color.bgHover};
  }

  & > .label {
    display: inline-flex;
    align-items: center;
    max-width: 110px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  & > svg {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    display: block;
  }

  & > .chevron {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-left: 1px;

    svg {
      width: 12px;
      height: 12px;
      opacity: 0.7;
      display: block;
    }
  }
`;

function useAnchor() {
  let triggerRef = useRef<HTMLButtonElement | null>(null);
  let [open, setOpen] = useState(false);
  let [anchor, setAnchor] = useState<{ left: number; top: number }>({
    left: 0,
    top: 0
  });

  let readAnchor = useCallback((): { left: number; top: number } | null => {
    let el = triggerRef.current;
    if (!el || !el.isConnected) return null;
    let rect = el.getBoundingClientRect();
    if (!Number.isFinite(rect.left) || !Number.isFinite(rect.top)) return null;
    // Detached/hidden elements can transiently report a 0x0 rect at (0,0).
    if (rect.width === 0 && rect.height === 0) return null;
    return { left: rect.left, top: rect.bottom + 4 };
  }, []);

  let updateAnchor = useCallback(() => {
    let next = readAnchor();
    if (!next) return;
    setAnchor(prev => (prev.left === next.left && prev.top === next.top ? prev : next));
  }, [readAnchor]);

  let openMenu = useCallback(() => {
    let next = readAnchor();
    if (next) setAnchor(next);
    setOpen(true);
  }, [readAnchor]);

  let closeMenu = useCallback(() => setOpen(false), []);

  let toggle = useCallback(() => {
    if (open) closeMenu();
    else openMenu();
  }, [open, closeMenu, openMenu]);

  useEffect(() => {
    if (!open) return;
    let raf = 0;
    let tick = () => {
      updateAnchor();
      raf = window.requestAnimationFrame(tick);
    };
    let onViewportChange = () => updateAnchor();
    tick();
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
    };
  }, [open, updateAnchor]);

  return { triggerRef, open, anchor, openMenu, closeMenu, toggle };
}

// ---------- Text type dropdown -------------------------------------------------

let TEXT_TYPE_ITEMS: SlashItem[] = [
  {
    title: 'Text',
    description: 'Plain paragraph',
    group: 'Style',
    icon: <IconText />,
    keywords: ['paragraph', 'text', 'plain', 'p'],
    convertible: true,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).clearNodes().setParagraph().run();
    }
  },
  {
    title: 'Heading 1',
    description: 'Big section heading',
    group: 'Style',
    icon: <IconH1 />,
    keywords: ['title', 'h1'],
    convertible: true,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .clearNodes()
        .setNode('heading', { level: 1 })
        .run();
    }
  },
  {
    title: 'Heading 2',
    description: 'Medium section heading',
    group: 'Style',
    icon: <IconH2 />,
    keywords: ['h2', 'subtitle'],
    convertible: true,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .clearNodes()
        .setNode('heading', { level: 2 })
        .run();
    }
  },
  {
    title: 'Heading 3',
    description: 'Small section heading',
    group: 'Style',
    icon: <IconH3 />,
    keywords: ['h3'],
    convertible: true,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .clearNodes()
        .setNode('heading', { level: 3 })
        .run();
    }
  },
  {
    title: 'Heading 4',
    description: 'Extra small heading',
    group: 'Style',
    icon: <IconH4 />,
    keywords: ['h4'],
    convertible: true,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .clearNodes()
        .setNode('heading', { level: 4 })
        .run();
    }
  },
  {
    title: 'Heading 5',
    description: 'Tiny heading',
    group: 'Style',
    icon: <IconH5 />,
    keywords: ['h5'],
    convertible: true,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .clearNodes()
        .setNode('heading', { level: 5 })
        .run();
    }
  },
  {
    title: 'Heading 6',
    description: 'Smallest heading',
    group: 'Style',
    icon: <IconH6 />,
    keywords: ['h6'],
    convertible: true,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .clearNodes()
        .setNode('heading', { level: 6 })
        .run();
    }
  },
  {
    title: 'Code block',
    description: 'Block of code with syntax highlighting',
    group: 'Containers',
    icon: <IconCodeBlock />,
    keywords: ['code', 'snippet'],
    convertible: true,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).clearNodes().toggleCodeBlock().run();
    }
  },
  {
    title: 'Equation',
    description: 'LaTeX equation with live preview',
    group: 'Containers',
    icon: <IconEquation />,
    keywords: ['equation', 'latex', 'math', 'formula'],
    convertible: true,
    command: ({ editor, range }) => {
      let preserveText =
        range.from === range.to ? editor.state.selection.$from.parent.textContent : '';
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .clearNodes()
        .setEquationBlock({ latex: preserveText })
        .run();
    }
  },
  {
    title: 'Callout',
    description: 'Highlighted note',
    group: 'Containers',
    icon: <IconCallout />,
    keywords: ['callout', 'note', 'admonition'],
    convertible: true,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .clearNodes()
        .setCallout({ type: 'info' })
        .run();
    }
  },
  {
    title: 'Quote',
    description: 'Capture a quote',
    group: 'Containers',
    icon: <IconQuote />,
    keywords: ['blockquote', 'quote'],
    convertible: true,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).clearNodes().toggleBlockquote().run();
    }
  }
];

function getCurrentTextType(editor: Editor): {
  title: string;
  Icon: () => ReactElement;
} {
  if (editor.isActive('codeBlock')) return { title: 'Code', Icon: IconCodeBlock };
  if (editor.isActive('equationBlock')) return { title: 'Equation', Icon: IconEquation };
  if (editor.isActive('callout')) return { title: 'Callout', Icon: IconCallout };
  if (editor.isActive('blockquote')) return { title: 'Quote', Icon: IconQuote };
  for (let level of [1, 2, 3, 4, 5, 6] as const) {
    if (editor.isActive('heading', { level })) {
      let Icon = [IconH1, IconH2, IconH3, IconH4, IconH5, IconH6][level - 1];
      return { title: `Heading ${level}`, Icon };
    }
  }
  return { title: 'Text', Icon: IconText };
}

interface DropdownProps {
  editor: Editor;
}

export function TextTypeDropdown({ editor }: DropdownProps) {
  let { triggerRef, open, anchor, closeMenu, toggle } = useAnchor();
  // Subscribe to editor transactions so the dropdown's label / icon
  // updates as the cursor moves between blocks of different types. The
  // selector falls back to a neutral "Text" entry when the editor is
  // mid-teardown (it briefly fires one last transaction with internal
  // state already nulled out, which would throw inside `isActive`).
  let current = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e || e.isDestroyed) return { title: 'Text', Icon: IconText };
      return getCurrentTextType(e);
    }
  });

  let onSelect = useCallback(
    (item: SlashItem) => {
      let cursor = editor.state.selection.from;
      let range: Range = { from: cursor, to: cursor };
      item.command({ editor, range });
      closeMenu();
    },
    [editor, closeMenu]
  );

  return (
    <>
      <Tooltip content="Text style" side="bottom">
        <TriggerBtn
          ref={triggerRef}
          type="button"
          data-toolbar-dropdown-trigger="true"
          $expanded={open}
          aria-label="Text style"
          onMouseDown={e => e.preventDefault()}
          onClick={toggle}
        >
          <IconType />
          <span className="label">{current.title}</span>
          <span className="chevron">
            <IconChevronDown />
          </span>
        </TriggerBtn>
      </Tooltip>
      <BlocksPopover
        open={open}
        anchor={anchor}
        items={TEXT_TYPE_ITEMS}
        activeTitle={current.title}
        width={240}
        maxHeight={420}
        ignoreClickOnSelector="[data-toolbar-dropdown-trigger]"
        onSelect={onSelect}
        onClose={closeMenu}
      />
    </>
  );
}

// ---------- List dropdown ------------------------------------------------------

let LIST_ITEMS: SlashItem[] = [
  {
    title: 'Bullet list',
    description: 'Simple bulleted list',
    group: 'Lists',
    icon: <IconBulletList />,
    keywords: ['ul', 'unordered'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    }
  },
  {
    title: 'Numbered list',
    description: 'Ordered list with numbers',
    group: 'Lists',
    icon: <IconOrderedList />,
    keywords: ['ol', 'ordered'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    }
  },
  {
    title: 'To-do list',
    description: 'Track tasks with checkboxes',
    group: 'Lists',
    icon: <IconTaskList />,
    keywords: ['todo', 'checkbox', 'task'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    }
  }
];

function getCurrentListType(editor: Editor): {
  title: string;
  Icon: () => ReactElement;
} {
  if (editor.isActive('taskList')) return { title: 'To-do', Icon: IconTaskList };
  if (editor.isActive('orderedList')) return { title: 'Numbered', Icon: IconOrderedList };
  if (editor.isActive('bulletList')) return { title: 'Bullets', Icon: IconBulletList };
  return { title: 'List', Icon: IconBulletList };
}

function getCurrentTurnIntoType(editor: Editor): {
  title: string;
  Icon: () => ReactElement;
} {
  if (editor.isActive('taskList')) return { title: 'To-do list', Icon: IconTaskList };
  if (editor.isActive('orderedList')) return { title: 'Numbered list', Icon: IconOrderedList };
  if (editor.isActive('bulletList')) return { title: 'Bullet list', Icon: IconBulletList };
  if (editor.isActive('codeBlock')) return { title: 'Code block', Icon: IconCodeBlock };
  if (editor.isActive('equationBlock')) return { title: 'Equation', Icon: IconEquation };
  if (editor.isActive('callout')) return { title: 'Callout', Icon: IconCallout };
  if (editor.isActive('blockquote')) return { title: 'Quote', Icon: IconQuote };
  for (let level of [1, 2, 3, 4, 5, 6] as const) {
    if (editor.isActive('heading', { level })) {
      let Icon = [IconH1, IconH2, IconH3, IconH4, IconH5, IconH6][level - 1];
      return { title: `Heading ${level}`, Icon };
    }
  }
  return { title: 'Text', Icon: IconText };
}

export function ListDropdown({ editor }: DropdownProps) {
  let { triggerRef, open, anchor, closeMenu, toggle } = useAnchor();
  // Subscribe to editor transactions so the dropdown reflects the list
  // type the caret is currently inside (and the trigger toggles its
  // active styling accordingly). Same teardown guard as the text-type
  // dropdown: avoid touching a destroyed editor's internals.
  let { current, isActiveList } = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e || e.isDestroyed) {
        return {
          current: { title: 'List', Icon: IconBulletList },
          isActiveList: false
        };
      }
      return {
        current: getCurrentListType(e),
        isActiveList:
          e.isActive('bulletList') || e.isActive('orderedList') || e.isActive('taskList')
      };
    }
  });
  let CurrentIcon = current.Icon;

  let onSelect = useCallback(
    (item: SlashItem) => {
      let cursor = editor.state.selection.from;
      let range: Range = { from: cursor, to: cursor };
      item.command({ editor, range });
      closeMenu();
    },
    [editor, closeMenu]
  );

  return (
    <>
      <Tooltip content="List type" side="bottom">
        <TriggerBtn
          ref={triggerRef}
          type="button"
          data-toolbar-dropdown-trigger="true"
          $active={isActiveList}
          $expanded={open}
          aria-label="List type"
          onMouseDown={e => e.preventDefault()}
          onClick={toggle}
        >
          <CurrentIcon />
          <span className="chevron">
            <IconChevronDown />
          </span>
        </TriggerBtn>
      </Tooltip>
      <BlocksPopover
        open={open}
        anchor={anchor}
        items={LIST_ITEMS}
        activeTitle={current.title}
        width={220}
        maxHeight={260}
        ignoreClickOnSelector="[data-toolbar-dropdown-trigger]"
        onSelect={onSelect}
        onClose={closeMenu}
      />
    </>
  );
}

let TURN_INTO_ITEMS: SlashItem[] = [...TEXT_TYPE_ITEMS, ...LIST_ITEMS];

export function InlineTurnIntoDropdown({ editor }: DropdownProps) {
  let { triggerRef, open, anchor, closeMenu, toggle } = useAnchor();
  let current = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e || e.isDestroyed) return { title: 'Text', Icon: IconText };
      return getCurrentTurnIntoType(e);
    }
  });

  let onSelect = useCallback(
    (item: SlashItem) => {
      let cursor = editor.state.selection.from;
      let range: Range = { from: cursor, to: cursor };
      item.command({ editor, range });
      closeMenu();
    },
    [editor, closeMenu]
  );

  return (
    <>
      <TriggerBtn
        ref={triggerRef}
        type="button"
        data-toolbar-dropdown-trigger="true"
        $expanded={open}
        title="Turn into"
        onMouseDown={e => e.preventDefault()}
        onClick={toggle}
      >
        <IconType />
        <span className="label">{current.title}</span>
        <span className="chevron">
          <IconChevronDown />
        </span>
      </TriggerBtn>
      <BlocksPopover
        open={open}
        anchor={anchor}
        items={TURN_INTO_ITEMS}
        activeTitle={current.title}
        width={240}
        maxHeight={420}
        ignoreClickOnSelector="[data-toolbar-dropdown-trigger]"
        onSelect={onSelect}
        onClose={closeMenu}
      />
    </>
  );
}

// ---------- More dropdown ------------------------------------------------------

export function MoreDropdown({ editor }: DropdownProps) {
  let { triggerRef, open, anchor, closeMenu, toggle } = useAnchor();

  let items = useMemo(() => slashItems, []);

  let onSelect = useCallback(
    (item: SlashItem) => {
      let cursor = editor.state.selection.from;
      let range: Range = { from: cursor, to: cursor };
      item.command({ editor, range });
      closeMenu();
    },
    [editor, closeMenu]
  );

  return (
    <>
      <Tooltip content="Insert block" side="bottom">
        <TriggerBtn
          ref={triggerRef}
          type="button"
          data-toolbar-dropdown-trigger="true"
          $expanded={open}
          aria-label="Insert block"
          onMouseDown={e => e.preventDefault()}
          onClick={toggle}
        >
          <IconMore />
          <span className="label">More</span>
          <span className="chevron">
            <IconChevronDown />
          </span>
        </TriggerBtn>
      </Tooltip>
      <BlocksPopover
        open={open}
        anchor={anchor}
        items={items}
        showSearch
        showRecommended
        searchPlaceholder="Insert block…"
        width={300}
        maxHeight={460}
        ignoreClickOnSelector="[data-toolbar-dropdown-trigger]"
        onSelect={onSelect}
        onClose={closeMenu}
      />
    </>
  );
}
