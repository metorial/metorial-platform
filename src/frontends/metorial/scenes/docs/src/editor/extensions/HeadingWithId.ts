import Heading from '@tiptap/extension-heading';
import { Plugin } from '@tiptap/pm/state';

function slugifyHeading(text: string): string {
  let normalized = text
    .toLowerCase()
    .trim()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'heading';
}

export let HeadingWithId = Heading.extend({
  addAttributes() {
    return {
      ...(this.parent?.() ?? {}),
      id: {
        default: null,
        parseHTML: element => element.getAttribute('id'),
        renderHTML: attributes => {
          let id = (attributes as { id?: string | null }).id;
          return id ? { id } : {};
        }
      }
    };
  },

  addProseMirrorPlugins() {
    return [
      ...(this.parent?.() ?? []),
      new Plugin({
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some(tr => tr.docChanged)) return null;
          let headingType = newState.schema.nodes.heading;
          if (!headingType) return null;

          let used = new Set<string>();
          let tr = newState.tr;
          let changed = false;

          newState.doc.descendants((node, pos) => {
            if (node.type !== headingType) return true;
            let base = slugifyHeading(node.textContent || '');
            let candidate = base;
            let suffix = 2;
            while (used.has(candidate)) {
              candidate = `${base}-${suffix++}`;
            }
            used.add(candidate);

            let currentId = (node.attrs.id as string | null) ?? null;
            if (currentId !== candidate) {
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                id: candidate
              });
              changed = true;
            }
            return true;
          });

          return changed ? tr : null;
        }
      })
    ];
  }
});
