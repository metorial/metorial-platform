import type { Editor } from '@tiptap/core';

export type DocsAgentApi = {
  canWrite: boolean;
  insertAgentBlock: () => void;
  summarizeSection: () => void;
  summarizeSelection: () => void;
  rewriteSelection: (instruction: string) => void;
};

type AgentBlockStorage = { api?: DocsAgentApi | null };

let getStorage = (editor: Editor) =>
  (editor.storage as unknown as { agentBlock?: AgentBlockStorage }).agentBlock;

export let getDocsAgentApi = (editor: Editor | null | undefined) =>
  (editor && getStorage(editor)?.api) || null;

export let setDocsAgentApi = (editor: Editor, api: DocsAgentApi | null) => {
  let storage = getStorage(editor);
  if (storage) storage.api = api;
};
