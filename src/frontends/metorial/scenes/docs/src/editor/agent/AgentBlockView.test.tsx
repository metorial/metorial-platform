import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/state', () => ({ useMetorialAssistantEnabled: () => false }));

vi.mock('./DocsAgentProvider', () => ({
  useDocsAgent: () => ({ canWrite: true, jobs: {} })
}));

vi.mock('@tiptap/react', () => ({
  NodeViewWrapper: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  NodeViewContent: () => <div>Existing document content</div>
}));

import { AgentBlockView } from './AgentBlockView';

describe('disabled assistant document blocks', () => {
  it.each(['idle', 'running', 'review', 'error'])(
    'preserves content without assistant controls or errors for %s blocks',
    status => {
      let markup = renderToStaticMarkup(
        <AgentBlockView
          {...({
            node: {
              attrs: { status, blockId: 'block_1', mode: 'block' },
              textContent: 'Existing document content'
            },
            editor: { isEditable: true }
          } as any)}
        />
      );

      expect(markup).toContain('Existing document content');
      expect(markup).not.toContain('<button');
      expect(markup).not.toContain('<textarea');
      expect(markup).not.toContain('AI writing');
      expect(markup).not.toContain('assistant');
    }
  );
});
