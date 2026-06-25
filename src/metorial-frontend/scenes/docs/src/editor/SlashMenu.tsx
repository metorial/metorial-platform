import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode
} from 'react';
import type { Editor, Range } from '@tiptap/core';
import styled from 'styled-components';
import type { Theme } from '../styles/theme';
import { menuEnter, menuExit } from './animations';
import {
  IconText,
  IconH1,
  IconH2,
  IconH3,
  IconBulletList,
  IconOrderedList,
  IconTaskList,
  IconQuote,
  IconCodeBlock,
  IconEquation,
  IconHr,
  IconMermaid,
  IconTable,
  IconImage,
  IconInfo,
  IconWarning,
  IconCheckCircle,
  IconDanger
} from './icons';

let MERMAID_EXAMPLE = `flowchart LR
  A[Start] --> B{Choose}
  B -- Yes --> C[Done]
  B -- No --> D[Retry]`;

let EQUATION_EXAMPLE = String.raw`\int_0^1 x^2 \, dx = \frac{1}{3}`;

export type SlashItem = {
  title: string;
  description: string;
  group: string;
  keywords?: string[];
  icon?: ReactNode;
  iconTone?: 'info' | 'warning' | 'success' | 'danger';
  recommended?: boolean;
  /** Whether this item makes sense as a "turn into" target for an existing block. */
  convertible?: boolean;
  command: (args: { editor: Editor; range: Range }) => void;
};

export let slashItems: SlashItem[] = [
  {
    title: 'Text',
    description: 'Plain paragraph',
    group: 'Basic',
    icon: <IconText />,
    keywords: ['paragraph', 'text', 'plain'],
    recommended: true,
    convertible: true,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setParagraph().run();
    }
  },
  {
    title: 'Heading 1',
    description: 'Big section heading',
    group: 'Basic',
    icon: <IconH1 />,
    keywords: ['title', 'h1', 'heading', 'large'],
    recommended: true,
    convertible: true,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run();
    }
  },
  {
    title: 'Heading 2',
    description: 'Medium section heading',
    group: 'Basic',
    icon: <IconH2 />,
    keywords: ['h2', 'subtitle'],
    recommended: true,
    convertible: true,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run();
    }
  },
  {
    title: 'Heading 3',
    description: 'Small section heading',
    group: 'Basic',
    icon: <IconH3 />,
    keywords: ['h3'],
    recommended: true,
    convertible: true,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run();
    }
  },
  {
    title: 'Bullet list',
    description: 'Simple bulleted list',
    group: 'Lists',
    icon: <IconBulletList />,
    keywords: ['unordered', 'bullets', 'list', 'ul'],
    recommended: true,
    convertible: true,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    }
  },
  {
    title: 'Numbered list',
    description: 'Ordered list with numbers',
    group: 'Lists',
    icon: <IconOrderedList />,
    keywords: ['ordered', 'list', 'ol'],
    recommended: true,
    convertible: true,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    }
  },
  {
    title: 'To-do list',
    description: 'Track tasks with checkboxes',
    group: 'Lists',
    icon: <IconTaskList />,
    keywords: ['todo', 'tasks', 'checkbox'],
    convertible: true,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    }
  },
  {
    title: 'Quote',
    description: 'Capture a quote',
    group: 'Blocks',
    icon: <IconQuote />,
    keywords: ['blockquote', 'quote'],
    recommended: true,
    convertible: true,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    }
  },
  {
    title: 'Code block',
    description: 'Block of code with syntax highlighting',
    group: 'Blocks',
    icon: <IconCodeBlock />,
    keywords: ['code', 'snippet'],
    recommended: true,
    convertible: true,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    }
  },
  {
    title: 'Mermaid diagram',
    description: 'Flowchart, sequence diagram, etc. rendered from text',
    group: 'Blocks',
    icon: <IconMermaid />,
    keywords: ['mermaid', 'diagram', 'flowchart', 'graph', 'chart'],
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({
          type: 'codeBlock',
          attrs: { language: 'mermaid' },
          content: [{ type: 'text', text: MERMAID_EXAMPLE }]
        })
        .run();
    }
  },
  {
    title: 'Equation',
    description: 'LaTeX equation with live preview',
    group: 'Blocks',
    icon: <IconEquation />,
    keywords: ['latex', 'math', 'formula', 'equation'],
    convertible: true,
    command: ({ editor, range }) => {
      let preserveText =
        range.from === range.to ? editor.state.selection.$from.parent.textContent : '';
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setEquationBlock({ latex: preserveText || EQUATION_EXAMPLE })
        .run();
    }
  },
  {
    title: 'Divider',
    description: 'Visually divide blocks',
    group: 'Blocks',
    icon: <IconHr />,
    keywords: ['hr', 'horizontal', 'rule', 'divider'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    }
  },
  {
    title: 'Table',
    description: 'Insert a 3×3 table',
    group: 'Blocks',
    icon: <IconTable />,
    keywords: ['table', 'grid'],
    recommended: true,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run();
    }
  },
  {
    title: 'Image',
    description: 'Upload, paste a URL, or drag-and-drop an image',
    group: 'Media',
    icon: <IconImage />,
    keywords: ['image', 'photo', 'picture', 'upload'],
    recommended: true,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertImagePlaceholder().run();
    }
  },
  {
    title: 'Info callout',
    description: 'Highlighted note',
    group: 'Callouts',
    icon: <IconInfo />,
    iconTone: 'info',
    keywords: ['callout', 'note', 'info'],
    convertible: true,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setCallout({ type: 'info' }).run();
    }
  },
  {
    title: 'Warning callout',
    description: 'Cautionary note',
    group: 'Callouts',
    icon: <IconWarning />,
    iconTone: 'warning',
    keywords: ['callout', 'warning', 'caution'],
    convertible: true,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setCallout({ type: 'warning' }).run();
    }
  },
  {
    title: 'Success callout',
    description: 'Positive note',
    group: 'Callouts',
    icon: <IconCheckCircle />,
    iconTone: 'success',
    keywords: ['callout', 'success', 'tip'],
    convertible: true,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setCallout({ type: 'success' }).run();
    }
  },
  {
    title: 'Danger callout',
    description: 'Critical note',
    group: 'Callouts',
    icon: <IconDanger />,
    iconTone: 'danger',
    keywords: ['callout', 'danger', 'error'],
    convertible: true,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setCallout({ type: 'danger' }).run();
    }
  }
];

export function filterItems(query: string): SlashItem[] {
  let q = query.toLowerCase().trim();
  if (!q) return slashItems;
  return slashItems.filter(item => {
    let haystack = [item.title, item.description, ...(item.keywords ?? [])]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

let Wrap = styled.div`
  width: 280px;
  max-height: 420px;
  display: flex;
  flex-direction: column;
  background: ${({ theme }) => theme.color.bg};
  border: 1px solid ${({ theme }) => theme.color.border};
  border-radius: 12px;
  box-shadow: 0 8px 24px ${({ theme }) => theme.color.shadow};
  overflow: hidden;
  font-family: ${({ theme }) => theme.font.sans};
  transform-origin: top left;

  &[data-state='open'] {
    ${menuEnter(160)}
  }

  &[data-state='closed'] {
    ${menuExit(140)}
    pointer-events: none;
  }
`;

let Scroll = styled.div`
  padding: 8px;
  overflow-y: auto;
  flex: 1;
`;

let GroupLabel = styled.div`
  padding: 10px 6px 6px;
  font-size: 11px;
  font-weight: 500;
  color: ${({ theme }) => theme.color.textSubtle};

  &:first-child {
    padding-top: 4px;
  }
`;

let Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
  padding: 0 2px 4px;
`;

let tintColor = (theme: Theme, tone?: 'info' | 'warning' | 'success' | 'danger') => {
  if (tone === 'info') return theme.color.callout.info.text;
  if (tone === 'warning') return theme.color.callout.warning.text;
  if (tone === 'success') return theme.color.callout.success.text;
  if (tone === 'danger') return theme.color.callout.danger.text;
  return theme.color.text;
};

let GridBtn = styled.button<{ $tone?: 'info' | 'warning' | 'success' | 'danger' }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  aspect-ratio: 1;
  padding: 0;
  border: 1px solid ${({ theme }) => theme.color.border};
  background: ${({ theme }) => theme.color.bg};
  color: ${({ $tone, theme }) => tintColor(theme, $tone)};
  border-radius: 8px;
  cursor: pointer;
  transition:
    background ${({ theme }) => theme.motion.fast},
    border-color ${({ theme }) => theme.motion.fast};

  &:hover {
    background: ${({ theme }) => theme.color.bgAlt};
    border-color: ${({ theme }) => theme.color.borderStrong};
  }

  svg {
    width: 16px;
    height: 16px;
  }
`;

let RowBtn = styled.button<{ $selected?: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 6px 6px;
  border: 0;
  background: ${({ $selected, theme }) => ($selected ? theme.color.bgAlt : 'transparent')};
  color: ${({ theme }) => theme.color.text};
  border-radius: 6px;
  text-align: left;
  cursor: pointer;
  user-select: none;
  font: inherit;
  font-size: 14px;
`;

let RowIconBox = styled.span<{
  $tone?: 'info' | 'warning' | 'success' | 'danger';
}>`
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid ${({ theme }) => theme.color.border};
  background: ${({ theme }) => theme.color.bg};
  color: ${({ $tone, theme }) => tintColor(theme, $tone)};
  border-radius: 6px;

  svg {
    width: 15px;
    height: 15px;
  }
`;

let RowTitle = styled.span`
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: ${({ theme }) => theme.color.text};
`;

let Empty = styled.div`
  padding: 14px;
  color: ${({ theme }) => theme.color.textSubtle};
  font-size: 13px;
  text-align: center;
`;

export interface SlashMenuRef {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

interface SlashMenuProps {
  items: SlashItem[];
  command: (item: SlashItem) => void;
  /** When true, render with the exit animation `data-state`. */
  closing?: boolean;
}

export let SlashMenu = forwardRef<SlashMenuRef, SlashMenuProps>(
  ({ items, command, closing }, ref) => {
    let dataState = closing ? 'closed' : 'open';
    let [selectedIndex, setSelectedIndex] = useState(0);
    let containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    useLayoutEffect(() => {
      let el = containerRef.current?.querySelector<HTMLElement>(
        `[data-index="${selectedIndex}"]`
      );
      if (el) {
        el.scrollIntoView({ block: 'nearest' });
      }
    }, [selectedIndex]);

    useImperativeHandle(ref, () => ({
      onKeyDown: event => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex(i => (i + items.length - 1) % items.length);
          return true;
        }
        if (event.key === 'ArrowDown') {
          setSelectedIndex(i => (i + 1) % items.length);
          return true;
        }
        if (event.key === 'Enter') {
          let item = items[selectedIndex];
          if (item) command(item);
          return true;
        }
        return false;
      }
    }));

    if (items.length === 0) {
      return (
        <Wrap ref={containerRef} data-state={dataState}>
          <Empty>No matching blocks</Empty>
        </Wrap>
      );
    }

    let groups: Record<string, { item: SlashItem; index: number }[]> = {};
    items.forEach((item, index) => {
      if (!groups[item.group]) groups[item.group] = [];
      groups[item.group].push({ item, index });
    });

    let isFiltered = items.length !== slashItems.length;
    let recommendedItems = isFiltered ? [] : items.filter(i => i.recommended);

    return (
      <Wrap ref={containerRef} data-state={dataState}>
        <Scroll>
          {recommendedItems.length > 0 && (
            <>
              <GroupLabel>Recommended</GroupLabel>
              <Grid>
                {recommendedItems.map(item => (
                  <GridBtn
                    type="button"
                    key={`grid-${item.title}`}
                    $tone={item.iconTone}
                    title={item.title}
                    onClick={() => command(item)}
                  >
                    {item.icon}
                  </GridBtn>
                ))}
              </Grid>
            </>
          )}
          {Object.entries(groups).map(([group, entries]) => (
            <div key={group}>
              <GroupLabel>{group}</GroupLabel>
              {entries.map(({ item, index }) => (
                <RowBtn
                  type="button"
                  key={item.title}
                  data-index={index}
                  $selected={index === selectedIndex}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onClick={() => command(item)}
                  title={item.description}
                >
                  <RowIconBox $tone={item.iconTone}>{item.icon}</RowIconBox>
                  <RowTitle>{item.title}</RowTitle>
                </RowBtn>
              ))}
            </div>
          ))}
        </Scroll>
      </Wrap>
    );
  }
);
SlashMenu.displayName = 'SlashMenu';
