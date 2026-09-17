import { BubbleMenuView, type BubbleMenuPluginProps } from '@tiptap/extension-bubble-menu';
import { Plugin, PluginKey, type Selection, type Transaction } from '@tiptap/pm/state';
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type Props = Omit<BubbleMenuPluginProps, 'element'> & { children: ReactNode };

export function BubbleMenu(props: Props) {
  let host = useRef<HTMLDivElement | null>(null);
  if (!host.current) host.current = document.createElement('div');
  let latest = useRef(props);
  latest.current = props;
  useEffect(() => {
    let { editor, pluginKey } = props;
    let element = host.current!;
    let menu: BubbleMenuView | null = null;
    let dismissed: Selection | null = null;
    let disposed = false;
    element.style.visibility = 'hidden';
    element.style.position = 'absolute';
    let plugin = new Plugin({
      key: typeof pluginKey === 'string' ? new PluginKey(pluginKey) : pluginKey,
      view: view => {
        let viewMenu = new BubbleMenuView({
          ...props,
          element,
          view,
          updateDelay: 0,
          shouldShow: context => {
            if (disposed || dismissed?.eq(context.state.selection)) return false;
            dismissed = null;
            return latest.current.shouldShow?.(context) ?? false;
          }
        });
        menu = viewMenu;
        return {
          update: (next, previous) => viewMenu.update(next, previous),
          destroy: () => {
            viewMenu.destroy();
            viewMenu.update = () => {};
            viewMenu.updatePosition = () => {};
            viewMenu.show = () => {};
            if (menu === viewMenu) menu = null;
            element.remove();
          }
        };
      }
    });
    editor.registerPlugin(plugin);
    // Tiptap 3.6.1 does not consume keyed show/hide metadata itself.
    let onTransaction = ({ transaction }: { transaction: Transaction }) => {
      let action = transaction.getMeta(pluginKey);
      if (action === 'hide') {
        dismissed = editor.state.selection;
        menu?.hide();
      } else if (action === 'show' && editor.isEditable) {
        dismissed = null;
        menu?.show();
        menu?.updatePosition();
      }
    };
    let onScroll = () => menu?.updatePosition();
    editor.on('transaction', onTransaction);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      disposed = true;
      editor.off('transaction', onTransaction);
      window.removeEventListener('scroll', onScroll, true);
      editor.unregisterPlugin(pluginKey);
      element.remove();
    };
  }, [props.editor, props.pluginKey]);
  return createPortal(<div>{props.children}</div>, host.current);
}
