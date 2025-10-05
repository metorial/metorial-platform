import { Button, Select, theme } from '@metorial/ui';
import {
  RiBold,
  RiCodeBlock,
  RiCodeLine,
  RiItalic,
  RiListOrdered,
  RiListUnordered,
  RiQuoteText,
  RiStrikethrough
} from '@remixicon/react';
import { TextStyleKit } from '@tiptap/extension-text-style';
import { Placeholder } from '@tiptap/extensions';
import type { Editor } from '@tiptap/react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { debounce } from 'lodash';
import { useMemo } from 'react';
import styled from 'styled-components';
import { Markdown } from 'tiptap-markdown';

let Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

let Nav = styled.nav`
  display: flex;
  gap: 10px;
`;

let EditorWrapper = styled.div`
  --black: ${theme.colors.foreground};
  --white: ${theme.colors.background};
  --gray-1: ${theme.colors.gray200};
  --gray-2: ${theme.colors.gray400};
  --gray-3: ${theme.colors.gray600};

  .tiptap {
    outline: none !important;

    p.is-editor-empty:first-child::before {
      color: #999;
      content: attr(data-placeholder);
      float: left;
      height: 0;
      pointer-events: none;
    }

    :first-child {
      margin-top: 0;
    }

    /* List styles */
    ul,
    ol {
      padding: 0 1rem;
      margin: 1.25rem 1rem 1.25rem 0.4rem;

      li p {
        margin-top: 0.25em;
        margin-bottom: 0.25em;
      }
    }

    ul {
      list-style-position: outside;
      list-style-type: disc;
    }

    ol {
      list-style-position: outside;
      list-style-type: decimal;
    }

    /* Heading styles */
    h1,
    h2,
    h3,
    h4,
    h5,
    h6 {
      line-height: 1.1;
      margin-top: 2.5rem;
      text-wrap: pretty;
    }

    h1,
    h2 {
      margin-top: 3.5rem;
      margin-bottom: 1.5rem;
    }

    h1 {
      font-size: 1.4rem;
    }

    h2 {
      font-size: 1.2rem;
    }

    h3 {
      font-size: 1.1rem;
    }

    h4,
    h5,
    h6 {
      font-size: 1rem;
    }

    /* Code and preformatted text styles */
    code {
      background-color: var(--gray-1);
      border-radius: 0.4rem;
      color: var(--black);
      font-size: 0.85rem;
      padding: 0.25em 0.3em;
    }

    pre {
      background: var(--black);
      border-radius: 0.5rem;
      color: var(--white);
      font-family: 'JetBrainsMono', monospace;
      margin: 1.5rem 0;
      padding: 0.75rem 1rem;

      code {
        background: none;
        color: inherit;
        font-size: 0.8rem;
        padding: 0;
      }
    }

    blockquote {
      border-left: 3px solid var(--gray-3);
      margin: 1.5rem 0;
      padding-left: 1rem;
    }

    hr {
      border: none;
      border-top: 1px solid var(--gray-2);
      margin: 2rem 0;
    }
  }
`;

let extensions = [TextStyleKit, StarterKit, Markdown];

let MenuBar = ({ editor }: { editor: Editor }) => {
  // Read the current editor's state, and re-render the component when it changes
  const editorState = useEditorState({
    editor,
    selector: ctx => {
      return {
        isBold: ctx.editor.isActive('bold') ?? false,
        canBold: ctx.editor.can().chain().toggleBold().run() ?? false,
        isItalic: ctx.editor.isActive('italic') ?? false,
        canItalic: ctx.editor.can().chain().toggleItalic().run() ?? false,
        isStrike: ctx.editor.isActive('strike') ?? false,
        canStrike: ctx.editor.can().chain().toggleStrike().run() ?? false,
        isCode: ctx.editor.isActive('code') ?? false,
        canCode: ctx.editor.can().chain().toggleCode().run() ?? false,
        canClearMarks: ctx.editor.can().chain().unsetAllMarks().run() ?? false,
        isParagraph: ctx.editor.isActive('paragraph') ?? false,
        isHeading1: ctx.editor.isActive('heading', { level: 1 }) ?? false,
        isHeading2: ctx.editor.isActive('heading', { level: 2 }) ?? false,
        isHeading3: ctx.editor.isActive('heading', { level: 3 }) ?? false,
        isHeading4: ctx.editor.isActive('heading', { level: 4 }) ?? false,
        isHeading5: ctx.editor.isActive('heading', { level: 5 }) ?? false,
        isHeading6: ctx.editor.isActive('heading', { level: 6 }) ?? false,
        isBulletList: ctx.editor.isActive('bulletList') ?? false,
        isOrderedList: ctx.editor.isActive('orderedList') ?? false,
        isCodeBlock: ctx.editor.isActive('codeBlock') ?? false,
        isBlockquote: ctx.editor.isActive('blockquote') ?? false,
        canUndo: ctx.editor.can().chain().undo().run() ?? false,
        canRedo: ctx.editor.can().chain().redo().run() ?? false
      };
    }
  });

  return (
    <Nav>
      <Select
        items={[
          { id: 'paragraph', label: 'Paragraph' },
          { id: 'h1', label: 'Heading 1' },
          { id: 'h2', label: 'Heading 2' },
          { id: 'h3', label: 'Heading 3' },
          { id: 'h4', label: 'Heading 4' },
          { id: 'h5', label: 'Heading 5' },
          { id: 'h6', label: 'Heading 6' }
        ]}
        value={
          editorState.isParagraph
            ? 'paragraph'
            : editorState.isHeading1
              ? 'h1'
              : editorState.isHeading2
                ? 'h2'
                : editorState.isHeading3
                  ? 'h3'
                  : editorState.isHeading4
                    ? 'h4'
                    : editorState.isHeading5
                      ? 'h5'
                      : editorState.isHeading6
                        ? 'h6'
                        : 'paragraph'
        }
        onChange={value => {
          if (value === 'paragraph') {
            editor.chain().focus().setParagraph().run();
          } else if (value === 'h1') {
            editor.chain().focus().toggleHeading({ level: 1 }).run();
          } else if (value === 'h2') {
            editor.chain().focus().toggleHeading({ level: 2 }).run();
          } else if (value === 'h3') {
            editor.chain().focus().toggleHeading({ level: 3 }).run();
          } else if (value === 'h4') {
            editor.chain().focus().toggleHeading({ level: 4 }).run();
          } else if (value === 'h5') {
            editor.chain().focus().toggleHeading({ level: 5 }).run();
          } else if (value === 'h6') {
            editor.chain().focus().toggleHeading({ level: 6 }).run();
          }
        }}
      />

      <Button
        iconLeft={<RiBold />}
        title="Bold"
        variant={editorState.isBold ? 'solid' : 'outline'}
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={!editorState.canBold}
      />

      <Button
        iconLeft={<RiItalic />}
        title="Italic"
        variant={editorState.isItalic ? 'solid' : 'outline'}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        disabled={!editorState.canItalic}
      />

      <Button
        iconLeft={<RiStrikethrough />}
        title="Strike"
        variant={editorState.isStrike ? 'solid' : 'outline'}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        disabled={!editorState.canStrike}
      />

      <Button
        iconLeft={<RiCodeLine />}
        title="Code"
        variant={editorState.isCode ? 'solid' : 'outline'}
        onClick={() => editor.chain().focus().toggleCode().run()}
        disabled={!editorState.canCode}
      />

      <Button
        iconLeft={<RiListUnordered />}
        title="Bullet List"
        variant={editorState.isBulletList ? 'solid' : 'outline'}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />

      <Button
        iconLeft={<RiListOrdered />}
        title="Ordered List"
        variant={editorState.isOrderedList ? 'solid' : 'outline'}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />

      <Button
        iconLeft={<RiCodeBlock />}
        title="Code Block"
        variant={editorState.isCodeBlock ? 'solid' : 'outline'}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      />

      <Button
        iconLeft={<RiQuoteText />}
        title="Blockquote"
        variant={editorState.isBlockquote ? 'solid' : 'outline'}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      />
    </Nav>
  );
};

export let TextEditor = (p: {
  content: string;
  onChange?: (content: string) => void;
  placeholder: string;
}) => {
  let debouncedUpdate = useMemo(
    () =>
      debounce(p.onChange || (() => {}), 300, {
        leading: false,
        trailing: true
      }),
    [p.onChange]
  );

  let ext = useMemo(
    () => [
      ...extensions,
      Placeholder.configure({
        placeholder: p.placeholder,
        showOnlyWhenEditable: true,
        showOnlyCurrent: false
      })
    ],
    [p.placeholder]
  );

  let editor = useEditor({
    extensions: ext,
    content: p.content,
    onUpdate: ({ editor }) => {
      // @ts-ignore
      debouncedUpdate(editor.storage.markdown.getMarkdown());
    }
  });
  return (
    <Wrapper>
      <MenuBar editor={editor} />
      <EditorWrapper>
        <EditorContent editor={editor} style={{ minHeight: 250 }} placeholder="Hello world" />
      </EditorWrapper>
    </Wrapper>
  );
};
