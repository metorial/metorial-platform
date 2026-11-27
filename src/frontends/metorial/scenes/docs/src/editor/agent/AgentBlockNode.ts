import { AgentBlock } from '@metorial/docs-editor-schema';
import { ReactNodeViewRenderer } from '@tiptap/react';
import type { DocsAgentApi } from './api';
import { AgentBlockView } from './AgentBlockView';

export let AgentBlockNode = AgentBlock.extend({
  addStorage() {
    return {
      ...this.parent?.(),
      api: null as DocsAgentApi | null
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(AgentBlockView);
  }
});
