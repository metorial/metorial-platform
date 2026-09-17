import { createRoot, type Root } from 'react-dom/client';
import { ThemeProvider } from 'styled-components';
import type { SuggestionOptions, SuggestionProps } from '@tiptap/suggestion';
import { filterItems, SlashMenu, type SlashItem, type SlashMenuRef } from './SlashMenu';
import type { Theme } from '../styles/theme';
import { createRef } from 'react';
import { dismissSlash } from './extensions/SlashCommand';
import { registerEditorOverlay } from './overlays';

type ItemsProps = Parameters<NonNullable<SuggestionOptions<SlashItem>['items']>>[0];

export let slashSuggestion = (
  getTheme: () => Theme
): Omit<SuggestionOptions<SlashItem>, 'editor'> => ({
  char: '/',
  startOfLine: false,
  allowSpaces: false,
  allowedPrefixes: null,

  items: ({ query }: ItemsProps) => {
    return filterItems(query).slice(0, 20);
  },

  command: ({ editor, range, props }) => {
    let item = props as unknown as SlashItem;
    item.command({ editor, range });
  },

  render: () => {
    let host: HTMLDivElement | null = null;
    let root: Root | null = null;
    let exitTimer: ReturnType<typeof setTimeout> | null = null;
    let lastProps: SuggestionProps<SlashItem> | null = null;
    let ref = createRef<SlashMenuRef>();
    let unregister: (() => void) | null = null;
    let cleanupPosition: (() => void) | null = null;
    let active = false;

    let positionAt = (rect: DOMRect | null | undefined) => {
      if (!host || !rect) return;
      let padding = 8;
      let menuWidth = host.getBoundingClientRect().width || 280;
      let menuHeight = host.getBoundingClientRect().height || 340;
      let viewportWidth = window.innerWidth;
      let viewportHeight = window.innerHeight;

      let left = rect.left + window.scrollX;
      let top = rect.bottom + window.scrollY + 8;

      if (left + menuWidth + padding > viewportWidth + window.scrollX) {
        left = window.scrollX + viewportWidth - menuWidth - padding;
      }
      if (left < padding) left = padding;

      if (
        rect.bottom + menuHeight + padding > viewportHeight &&
        rect.top - menuHeight - padding > 0
      ) {
        top = rect.top + window.scrollY - menuHeight - 8;
      }

      host.style.left = `${left}px`;
      host.style.top = `${Math.max(window.scrollY + padding, Math.min(top, window.scrollY + viewportHeight - menuHeight - padding))}px`;
    };

    let renderMenu = (props: SuggestionProps<SlashItem>, closing = false) => {
      if (!root) return;
      root.render(
        <ThemeProvider theme={getTheme()}>
          <SlashMenu
            ref={ref}
            items={props.items}
            command={item => props.command(item)}
            closing={closing}
          />
        </ThemeProvider>
      );
    };

    let teardown = () => {
      active = false;
      unregister?.();
      unregister = null;
      cleanupPosition?.();
      cleanupPosition = null;
      if (exitTimer) {
        clearTimeout(exitTimer);
        exitTimer = null;
      }
      root?.unmount();
      root = null;
      if (host && host.parentNode) {
        host.parentNode.removeChild(host);
      }
      host = null;
    };

    return {
      onStart: props => {
        teardown();
        active = true;
        host = document.createElement('div');
        host.style.position = 'absolute';
        host.style.zIndex = '1000';
        host.style.pointerEvents = 'auto';
        host.style.maxWidth = 'calc(100vw - 16px)';
        host.style.maxHeight = 'calc(100vh - 16px)';
        host.style.overflow = 'auto';
        document.body.appendChild(host);
        root = createRoot(host);
        lastProps = props;
        renderMenu(props);
        positionAt(props.clientRect?.());
        unregister = registerEditorOverlay({
          element: () => host,
          trigger: () => props.editor.view.dom,
          close: () => dismissSlash(props.editor.view)
        });
        let reposition = () => {
          let rect = lastProps?.clientRect?.();
          if (!rect) {
            dismissSlash(props.editor.view);
            return;
          }
          positionAt(rect);
        };
        let onFocus = (event: FocusEvent) => {
          let target = event.target as Node;
          if (!host?.contains(target) && !props.editor.view.dom.contains(target))
            dismissSlash(props.editor.view);
        };
        let observer =
          typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(reposition);
        observer?.observe(host);
        window.addEventListener('scroll', reposition, true);
        window.addEventListener('resize', reposition);
        document.addEventListener('focusin', onFocus);
        cleanupPosition = () => {
          observer?.disconnect();
          window.removeEventListener('scroll', reposition, true);
          window.removeEventListener('resize', reposition);
          document.removeEventListener('focusin', onFocus);
        };
      },

      onUpdate: props => {
        lastProps = props;
        renderMenu(props);
        positionAt(props.clientRect?.());
      },

      onKeyDown: props => {
        if (!active || props.event.isComposing) return false;
        if (props.event.key === 'Escape') {
          dismissSlash(props.view);
          return true;
        }
        if (
          props.event.key === 'Enter' &&
          (props.event.shiftKey || !lastProps?.items.length)
        ) {
          dismissSlash(props.view);
          return false;
        }
        if (
          props.event.shiftKey ||
          props.event.metaKey ||
          props.event.ctrlKey ||
          props.event.altKey
        )
          return false;
        return ref.current?.onKeyDown(props.event) ?? false;
      },

      // Re-render the menu in its closing state so the exit animation can
      // play, then actually unmount once it has finished.
      onExit: () => {
        active = false;
        unregister?.();
        unregister = null;
        cleanupPosition?.();
        cleanupPosition = null;
        if (host) host.style.pointerEvents = 'none';
        if (!root || !host) return teardown();
        if (lastProps) renderMenu(lastProps, true);
        exitTimer = setTimeout(teardown, 160);
      }
    };
  }
});
