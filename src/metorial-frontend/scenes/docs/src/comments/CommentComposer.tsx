import Placeholder from '@tiptap/extension-placeholder';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { useRef, useState, type ComponentType } from 'react';
import styled from 'styled-components';
import { Markdown } from 'tiptap-markdown';
import { Button } from '@metorial/ui';
import { IconBold, IconBulletList, IconItalic, IconOrderedList } from '../editor/icons';
import { commentTypography } from './commentTypography';

let Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

let Box = styled.div<{ $bare?: boolean }>`
  display: flex;
  flex-direction: column;
  min-width: 0;
  border: 1px solid ${({ $bare, theme }) => ($bare ? 'transparent' : theme.color.border)};
  border-radius: ${({ theme }) => theme.size.radius};
  background: ${({ theme }) => theme.color.bg};
  transition: border-color ${({ theme }) => theme.motion.fast};

  &:focus-within {
    border-color: ${({ $bare, theme }) => ($bare ? 'transparent' : theme.color.borderStrong)};
  }
`;

let Content = styled.div<{ $bare?: boolean }>`
  padding: ${({ $bare }) => ($bare ? '0 0 4px' : '8px 10px 4px')};
  max-height: 220px;
  overflow-y: auto;
  cursor: text;

  .ProseMirror {
    ${commentTypography}
    min-height: 42px;
    outline: none;
  }

  .ProseMirror p.is-editor-empty:first-child::before {
    content: attr(data-placeholder);
    float: left;
    height: 0;
    pointer-events: none;
    color: ${({ theme }) => theme.color.textSubtle};
  }
`;

let Footer = styled.div<{ $bare?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
  padding: ${({ $bare }) => ($bare ? '4px 0 0' : '4px 6px 6px')};
`;

let Formatting = styled.div`
  display: flex;
  gap: 2px;
`;

let FormatButton = styled.button<{ $active?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: ${({ theme }) => theme.size.radiusSm};
  background: ${({ $active, theme }) => ($active ? theme.color.bgActive : 'transparent')};
  color: ${({ $active, theme }) => ($active ? theme.color.text : theme.color.textMuted)};
  cursor: pointer;
  transition:
    background ${({ theme }) => theme.motion.fast},
    color ${({ theme }) => theme.motion.fast};

  &:hover {
    background: ${({ theme }) => theme.color.bgHover};
    color: ${({ theme }) => theme.color.text};
  }

  svg {
    width: 14px;
    height: 14px;
  }
`;

let Actions = styled.div`
  display: flex;
  gap: 6px;
  margin-left: auto;
`;

export let CommentComposer = ({
  label,
  submitLabel,
  initialValue = '',
  autoFocus,
  bare,
  loading,
  success,
  RenderError,
  onSubmit,
  onCancel
}: {
  label: string;
  submitLabel: string;
  initialValue?: string;
  autoFocus?: boolean;
  bare?: boolean;
  loading?: boolean;
  success?: boolean;
  RenderError?: ComponentType;
  onSubmit: (body: string) => Promise<boolean>;
  onCancel?: () => void;
}) => {
  let [value, setValue] = useState(initialValue);
  let canSubmit = value.trim().length > 0 && value.trim() !== initialValue.trim();

  let submitRef = useRef<() => void>(() => {});
  let cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;

  let editor = useEditor({
    extensions: [
      StarterKit.configure({
        blockquote: false,
        code: false,
        codeBlock: false,
        dropcursor: false,
        gapcursor: false,
        heading: false,
        horizontalRule: false,
        link: false,
        strike: false,
        underline: false
      }),
      Placeholder.configure({ placeholder: label }),
      Markdown.configure({ html: false, tightLists: true, bulletListMarker: '-' })
    ],
    content: initialValue,
    autofocus: autoFocus ? 'end' : false,
    editorProps: {
      attributes: { 'aria-label': label },
      handleKeyDown: (_view, event) => {
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          submitRef.current();
          return true;
        }
        if (event.key === 'Escape' && cancelRef.current) {
          event.preventDefault();
          cancelRef.current();
          return true;
        }
        return false;
      }
    },
    onUpdate: ({ editor }) => {
      setValue((editor.storage as any).markdown.getMarkdown());
    }
  });

  let active = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: !!editor?.isActive('bold'),
      italic: !!editor?.isActive('italic'),
      bulletList: !!editor?.isActive('bulletList'),
      orderedList: !!editor?.isActive('orderedList')
    })
  });

  let submit = async () => {
    if (!canSubmit || loading) return;
    if (await onSubmit(value.trim())) {
      editor?.commands.clearContent(true);
      setValue('');
    }
  };
  submitRef.current = () => void submit();

  let format = (active: boolean, label: string, icon: React.ReactNode, run: () => void) => (
    <FormatButton
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      $active={active}
      onMouseDown={event => event.preventDefault()}
      onClick={run}
    >
      {icon}
    </FormatButton>
  );

  return (
    <Wrap
      onMouseDown={event => event.stopPropagation()}
      onClick={event => event.stopPropagation()}
    >
      <Box $bare={bare}>
        <Content $bare={bare} onClick={() => editor?.commands.focus()}>
          <EditorContent editor={editor} />
        </Content>

        <Footer $bare={bare}>
          <Formatting>
            {format(active.bold, 'Bold', <IconBold />, () =>
              editor?.chain().focus().toggleBold().run()
            )}
            {format(active.italic, 'Italic', <IconItalic />, () =>
              editor?.chain().focus().toggleItalic().run()
            )}
            {format(active.bulletList, 'Bulleted list', <IconBulletList />, () =>
              editor?.chain().focus().toggleBulletList().run()
            )}
            {format(active.orderedList, 'Numbered list', <IconOrderedList />, () =>
              editor?.chain().focus().toggleOrderedList().run()
            )}
          </Formatting>

          <Actions>
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                size="1"
                disabled={loading}
                onClick={onCancel}
              >
                Cancel
              </Button>
            )}
            <Button
              type="button"
              variant="solid"
              size="1"
              disabled={!canSubmit}
              loading={loading}
              success={success}
              onClick={() => void submit()}
            >
              {submitLabel}
            </Button>
          </Actions>
        </Footer>
      </Box>
      {RenderError && <RenderError />}
    </Wrap>
  );
};
