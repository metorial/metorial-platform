import { useEffect, useMemo, useRef } from 'react';
import type { Editor } from '@tiptap/react';
import type { PluginKey, Selection } from '@tiptap/pm/state';
import { hasEditorOverlay, registerEditorOverlay } from './overlays';

export function useBubbleOverlay(editor: Editor | null, key: PluginKey, onClose?: () => void) {
  let element = useRef<HTMLDivElement | null>(null);
  let unregister = useRef<(() => void) | null>(null);
  let dismissed = useRef<Selection | null>(null);
  let latestClose = useRef(onClose);
  latestClose.current = onClose;
  let lifecycle = useMemo(
    () => ({
      onShow: () => {
        if (!editor || unregister.current) return;
        dismissed.current = null;
        unregister.current = registerEditorOverlay({
          element: () => element.current,
          trigger: () => editor.view.dom,
          close: () => {
            dismissed.current = editor.state.selection;
            unregister.current?.();
            unregister.current = null;
            if (!editor.isDestroyed)
              editor.view.dispatch(editor.state.tr.setMeta(key, 'hide'));
            latestClose.current?.();
          },
          restoreFocus: () => {
            if (!editor.isDestroyed) editor.view.focus();
          }
        });
      },
      onHide: () => {
        unregister.current?.();
        unregister.current = null;
      }
    }),
    [editor, key]
  );
  useEffect(() => () => lifecycle.onHide(), [lifecycle]);
  return {
    element,
    lifecycle,
    canShow: () => {
      if (!editor?.isEditable) return false;
      if (dismissed.current?.eq(editor.state.selection)) return false;
      dismissed.current = null;
      if (!unregister.current && hasEditorOverlay()) return false;
      return true;
    }
  };
}
