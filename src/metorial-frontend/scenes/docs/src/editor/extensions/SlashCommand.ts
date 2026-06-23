import { Extension } from '@tiptap/core';
import Suggestion, { type SuggestionOptions } from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';

export let SlashCommandPluginKey = new PluginKey('slashCommand');

export interface SlashCommandOptions {
  suggestion: Omit<SuggestionOptions, 'editor'>;
}

export let SlashCommand = Extension.create<SlashCommandOptions>({
  name: 'slashCommand',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        startOfLine: false,
        allowSpaces: false,
        pluginKey: SlashCommandPluginKey,
        command: ({ editor, range, props }) => {
          let item = props as {
            command?: (args: { editor: typeof editor; range: typeof range }) => void;
          };
          item.command?.({ editor, range });
        }
      }
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion
      })
    ];
  }
});
