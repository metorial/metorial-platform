import { EditorView } from '@codemirror/view';
import { MergeView } from '@codemirror/merge';
import { theme } from '@metorial/ui';
import { useEffect, useRef } from 'react';
import { sparkTheme } from './theme';

export let MergeEditor = ({
  original,
  value,
  onChange,
  height = '440px',
  readOnly = false
}: {
  original: string;
  value: string;
  onChange?: (value: string) => void;
  height?: string;
  readOnly?: boolean;
}) => {
  let parentRef = useRef<HTMLDivElement | null>(null);
  let onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!parentRef.current) return;

    let mergeView = new MergeView({
      a: {
        doc: original,
        extensions: [sparkTheme, EditorView.editable.of(false)]
      },
      b: {
        doc: value,
        extensions: [
          sparkTheme,
          EditorView.editable.of(!readOnly),
          EditorView.updateListener.of(update => {
            if (update.docChanged) onChangeRef.current?.(update.state.doc.toString());
          })
        ]
      },
      parent: parentRef.current,
      orientation: 'a-b',
      revertControls: readOnly ? undefined : 'b-to-a',
      highlightChanges: true,
      gutter: true
    });

    return () => mergeView.destroy();
  }, [original, readOnly]);

  return (
    <div
      ref={parentRef}
      style={{
        height,
        overflow: 'auto',
        border: `1px solid ${theme.colors.gray400}`,
        borderRadius: 8
      }}
    />
  );
};
