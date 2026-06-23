import { createRoot, type Root } from 'react-dom/client';
import { ThemeProvider } from 'styled-components';
import type { SuggestionOptions, SuggestionProps } from '@tiptap/suggestion';
import { filterItems, SlashMenu, type SlashItem, type SlashMenuRef } from './SlashMenu';
import type { Theme } from '../styles/theme';
import { createRef } from 'react';

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

    let positionAt = (rect: DOMRect | null | undefined) => {
      if (!host || !rect) return;
      let padding = 8;
      let menuWidth = 280;
      let menuHeight = 340;
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
      host.style.top = `${top}px`;
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
        if (exitTimer) {
          clearTimeout(exitTimer);
          exitTimer = null;
        }
        host = document.createElement('div');
        host.style.position = 'absolute';
        host.style.zIndex = '1000';
        host.style.pointerEvents = 'auto';
        document.body.appendChild(host);
        root = createRoot(host);
        lastProps = props;
        renderMenu(props);
        positionAt(props.clientRect?.());
      },

      onUpdate: props => {
        lastProps = props;
        renderMenu(props);
        positionAt(props.clientRect?.());
      },

      onKeyDown: props => {
        if (props.event.key === 'Escape') {
          if (host) host.style.display = 'none';
          return true;
        }
        return ref.current?.onKeyDown(props.event) ?? false;
      },

      // Re-render the menu in its closing state so the exit animation can
      // play, then actually unmount once it has finished.
      onExit: () => {
        if (!root || !host) return teardown();
        if (lastProps) renderMenu(lastProps, true);
        exitTimer = setTimeout(teardown, 160);
      }
    };
  }
});
