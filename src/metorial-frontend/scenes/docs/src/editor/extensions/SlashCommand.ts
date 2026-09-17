import { Extension } from '@tiptap/core';
import Suggestion, { type SuggestionOptions } from '@tiptap/suggestion';
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { filterItems } from '../SlashMenu';

export let SlashCommandPluginKey = new PluginKey('slashCommand');
export let slashSessionKey = new PluginKey<SlashSession>('slashSession');
type SlashSession = {
  trigger: number | null;
  dismissed: number | null;
  emptyStart: number | null;
};

export function slashContext(state: EditorState) {
  let { $from, empty } = state.selection;
  if (
    !empty ||
    !$from.parent.isTextblock ||
    $from.parent.type.spec.code ||
    $from.marks().some(mark => mark.type.name === 'code')
  )
    return null;
  let text = $from.parent.textBetween(0, $from.parentOffset, '\n', '\ufffc');
  let match = /(?:^|\s)(\/[^\s/]*)$/.exec(text);
  if (!match) return null;
  let query = match[1].slice(1);
  return { trigger: $from.pos - match[1].length, query };
}

export function dismissSlash(view: EditorView) {
  if (view.isDestroyed) return;
  view.dispatch(
    view.state.tr
      .setMeta(slashSessionKey, 'dismiss')
      .setMeta(SlashCommandPluginKey, { exit: true })
  );
}

export interface SlashCommandOptions {
  suggestion: Omit<SuggestionOptions, 'editor'>;
}

export let SlashCommand = Extension.create<SlashCommandOptions>({
  name: 'slashCommand',
  addOptions() {
    return { suggestion: { char: '/' } };
  },
  addProseMirrorPlugins() {
    let editor = this.editor;
    return [
      new Plugin<SlashSession>({
        key: slashSessionKey,
        state: {
          init: () => ({ trigger: null, dismissed: null, emptyStart: null }),
          apply: (tr, previous, _old, state) => {
            let context = slashContext(state);
            if (!context || !editor.isEditable)
              return { trigger: null, dismissed: null, emptyStart: null };
            let mapped =
              previous.trigger == null ? null : tr.mapping.mapResult(previous.trigger, 1);
            let same = mapped && !mapped.deleted && mapped.pos === context.trigger;
            let dismissed = same
              ? previous.dismissed == null
                ? null
                : context.trigger
              : null;
            let emptyStart = same ? previous.emptyStart : null;
            if (tr.getMeta(slashSessionKey) === 'dismiss') dismissed = context.trigger;
            if (!editor.view.composing) {
              if (filterItems(context.query).length) emptyStart = null;
              else {
                let length = Array.from(context.query).length;
                emptyStart = Math.min(emptyStart ?? length, length);
                if (length >= emptyStart + 3) dismissed = context.trigger;
              }
            }
            return { trigger: context.trigger, dismissed, emptyStart };
          }
        }
      }),
      Suggestion({
        ...this.options.suggestion,
        editor,
        pluginKey: SlashCommandPluginKey,
        allowedPrefixes: [' ', '\n', '\t'],
        allow: ({ state, range }) => {
          let context = slashContext(state);
          return (
            !!context &&
            context.trigger === range.from &&
            slashSessionKey.getState(state)?.dismissed !== context.trigger
          );
        }
      })
    ];
  }
});
