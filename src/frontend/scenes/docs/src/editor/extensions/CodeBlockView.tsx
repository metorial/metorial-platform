import { NodeViewContent, NodeViewWrapper } from '@tiptap/react';
import type { ReactNodeViewProps } from '@tiptap/react';
import { LanguagePicker } from './LanguagePicker';
import { MermaidView } from './MermaidView';

export function CodeBlockView({ node, updateAttributes, editor }: ReactNodeViewProps) {
  let language = (node.attrs.language as string | null) ?? 'plaintext';
  let isMermaid = language === 'mermaid';
  let editable = editor.isEditable;

  return (
    <NodeViewWrapper
      className={'code-block-wrapper' + (isMermaid ? ' code-block-wrapper--mermaid' : '')}
    >
      {editable && (
        <div className="code-block-header" contentEditable={false}>
          <LanguagePicker
            value={language}
            onChange={lang => updateAttributes({ language: lang })}
          />
        </div>
      )}
      <pre>
        <NodeViewContent<'code'> as="code" className={`language-${language}`} />
      </pre>
      {isMermaid && (
        <div className="code-block-preview" contentEditable={false}>
          <MermaidView code={node.textContent} />
        </div>
      )}
    </NodeViewWrapper>
  );
}
