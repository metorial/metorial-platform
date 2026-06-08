import { useCallback, useLayoutEffect, useRef } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import type { ReactNodeViewProps } from '@tiptap/react';
import { LatexPreview } from './LatexPreview';

export function EquationBlockView({ node, updateAttributes, editor }: ReactNodeViewProps) {
  let latexFromNode = typeof node.attrs.latex === 'string' ? (node.attrs.latex as string) : '';
  let textareaRef = useRef<HTMLTextAreaElement | null>(null);

  let autosizeTextarea = useCallback(() => {
    let el = textareaRef.current;
    if (!el) return;
    let style = window.getComputedStyle(el);
    let lineHeight = Number.parseFloat(style.lineHeight) || 0;
    let paddingTop = Number.parseFloat(style.paddingTop) || 0;
    let paddingBottom = Number.parseFloat(style.paddingBottom) || 0;
    let minHeight = Math.ceil(lineHeight + paddingTop + paddingBottom);
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, minHeight)}px`;
  }, []);

  useLayoutEffect(() => {
    autosizeTextarea();
    let raf = window.requestAnimationFrame(() => {
      autosizeTextarea();
    });
    return () => {
      window.cancelAnimationFrame(raf);
    };
  }, [autosizeTextarea, latexFromNode]);

  let onChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      let next = event.target.value;
      updateAttributes({ latex: next });
      autosizeTextarea();
    },
    [autosizeTextarea, updateAttributes]
  );

  let stopKeyPropagation = useCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
    event.stopPropagation();
  }, []);

  return (
    <NodeViewWrapper className="equation-block-wrapper">
      <div className="equation-block-editor" contentEditable={false}>
        <textarea
          ref={textareaRef}
          className="equation-block-input"
          rows={1}
          value={latexFromNode}
          placeholder={'e.g. \\int_0^1 x^2 \\, dx = \\frac{1}{3}'}
          spellCheck={false}
          readOnly={!editor.isEditable}
          onChange={onChange}
          onKeyDown={stopKeyPropagation}
        />
      </div>
      <div className="equation-block-preview" contentEditable={false}>
        <LatexPreview latex={latexFromNode} />
      </div>
    </NodeViewWrapper>
  );
}
