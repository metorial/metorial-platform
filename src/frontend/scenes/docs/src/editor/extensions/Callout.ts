import { Node, mergeAttributes } from '@tiptap/core';

export type CalloutType = 'info' | 'warning' | 'success' | 'danger';

export interface CalloutOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (attributes?: { type?: CalloutType }) => ReturnType;
      toggleCallout: (attributes?: { type?: CalloutType }) => ReturnType;
      unsetCallout: () => ReturnType;
    };
  }
}

let VALID_TYPES: CalloutType[] = ['info', 'warning', 'success', 'danger'];

let isCalloutType = (value: string | null | undefined): value is CalloutType =>
  !!value && VALID_TYPES.includes(value as CalloutType);

export let Callout = Node.create<CalloutOptions>({
  name: 'callout',

  group: 'block',

  content: 'block+',

  defining: true,

  addOptions() {
    return {
      HTMLAttributes: {}
    };
  },

  addAttributes() {
    return {
      type: {
        default: 'info',
        parseHTML: element => {
          // New custom-tag form: <info>, <warning>, <success>, <danger>.
          let tag = element.tagName.toLowerCase();
          if (isCalloutType(tag)) return tag;
          // Legacy form: <div data-callout-type="...">.
          let attr = element.getAttribute('data-callout-type');
          return isCalloutType(attr) ? attr : 'info';
        },
        renderHTML: attrs => ({
          'data-callout-type': (attrs as { type?: string }).type ?? 'info'
        })
      }
    };
  },

  parseHTML() {
    return [
      // Modern, semantic markdown form.
      ...VALID_TYPES.map(type => ({ tag: type })),
      // Backwards compatibility with documents written before the change.
      { tag: 'div[data-callout-type]' }
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: 'callout'
      }),
      0
    ];
  },

  addCommands() {
    return {
      setCallout:
        attributes =>
        ({ commands }) => {
          return commands.wrapIn(this.name, attributes);
        },
      toggleCallout:
        attributes =>
        ({ commands }) => {
          return commands.toggleWrap(this.name, attributes);
        },
      unsetCallout:
        () =>
        ({ commands }) => {
          return commands.lift(this.name);
        }
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-c': () => this.editor.commands.toggleCallout()
    };
  },

  addStorage() {
    return {
      markdown: {
        serialize(
          state: {
            write: (text: string) => void;
            ensureNewLine: () => void;
            renderContent: (node: unknown) => void;
            closeBlock: (node: unknown) => void;
          },
          node: { attrs: { type?: CalloutType } }
        ) {
          let type = (node.attrs.type ?? 'info') as CalloutType;
          // The blank lines around the inner content are required so that
          // `marked` exits its raw-HTML block mode and parses the body as
          // markdown when the document is read back in.
          state.write(`<${type}>\n\n`);
          state.renderContent(node);
          state.ensureNewLine();
          state.write(`</${type}>`);
          state.closeBlock(node);
        },
        parse: {
          // Handled via parseHTML when html mode is enabled in tiptap-markdown
        }
      }
    };
  }
});
