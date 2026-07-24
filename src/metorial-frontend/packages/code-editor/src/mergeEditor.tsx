import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { MergeView } from '@codemirror/merge';
import { useEffect, useRef } from 'react';
import { sparkTheme } from './theme';

export let MergeEditor = ({
  original,
  value,
  onChange,
  height,
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
        extensions: [sparkTheme, EditorState.readOnly.of(true), EditorView.editable.of(false)]
      },
      b: {
        doc: value,
        extensions: [
          sparkTheme,
          EditorState.readOnly.of(readOnly),
          EditorView.editable.of(!readOnly)
        ]
      },
      parent: parentRef.current,
      orientation: 'a-b',
      revertControls: readOnly ? undefined : 'b-to-a',
      highlightChanges: true,
      gutter: true
    });

    // MergeView supplies its own transaction dispatcher. That bypasses the normal
    // update-listener route, so observe the editable pane's dispatcher directly.
    // Read after the original dispatcher has applied the transaction.
    let currentValue = value;
    let dispatch = mergeView.b.dispatch.bind(mergeView.b) as (...transactions: any[]) => void;
    mergeView.b.dispatch = (...transactions) => {
      dispatch(...transactions);
      let nextValue = mergeView.b.state.doc.toString();
      if (nextValue == currentValue) return;
      currentValue = nextValue;
      onChangeRef.current?.(nextValue);
    };

    return () => mergeView.destroy();
  }, [original, readOnly]);

  return (
    <div
      ref={parentRef}
      style={{
        ...(height ? { height, overflow: 'auto' } : {})
      }}
    />
  );
};
