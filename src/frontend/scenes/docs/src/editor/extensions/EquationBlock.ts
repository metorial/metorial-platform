import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { EquationBlockView } from './EquationBlockView';

export interface EquationBlockOptions {
  HTMLAttributes: Record<string, unknown>;
}

function escapeHtml(input: string): string {
  return input.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    equationBlock: {
      setEquationBlock: (attributes?: { latex?: string }) => ReturnType;
    };
  }
}

export let EquationBlock = Node.create<EquationBlockOptions>({
  name: 'equationBlock',

  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addOptions() {
    return {
      HTMLAttributes: {}
    };
  },

  addAttributes() {
    return {
      latex: {
        default: '',
        parseHTML: element => element.getAttribute('data-latex') ?? element.textContent ?? '',
        renderHTML: () => ({})
      }
    };
  },

  parseHTML() {
    return [{ tag: 'equation' }, { tag: 'div[data-equation-block]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    let latex = (node.attrs.latex as string | null) ?? '';
    return [
      'equation',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-equation-block': 'true',
        'data-latex': latex
      }),
      latex
    ];
  },

  addCommands() {
    return {
      setEquationBlock:
        (attributes = {}) =>
        ({ state, commands }) => {
          let attrs = {
            latex: '',
            ...attributes
          };
          let { $from } = state.selection;
          let depth = $from.depth;
          while (depth > 0 && !$from.node(depth).isBlock) {
            depth -= 1;
          }

          if (depth <= 0) {
            return commands.insertContent({
              type: this.name,
              attrs
            });
          }

          let from = $from.before(depth);
          let to = $from.after(depth);
          return commands.insertContentAt(
            { from, to },
            {
              type: this.name,
              attrs
            }
          );
        }
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(EquationBlockView);
  },

  addStorage() {
    return {
      markdown: {
        serialize(
          state: {
            write: (text: string) => void;
            closeBlock: (node: unknown) => void;
          },
          node: { attrs: { latex?: string } }
        ) {
          let latex = escapeHtml(node.attrs.latex ?? '');
          state.write(`<equation>${latex}</equation>`);
          state.closeBlock(node);
        },
        parse: {
          // Handled via parseHTML when html mode is enabled in tiptap-markdown.
        }
      }
    };
  }
});
