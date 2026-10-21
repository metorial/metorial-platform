import {
  useSkillAssistant,
  type SkillAssistantRequestContext,
  type SkillAssistantWorkspace
} from '@metorial/state';
import type { Editor } from '@tiptap/react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react';
import { setDocsAgentApi, type DocsAgentApi } from './api';
import { AgentEditApplier, agentTargets, type DocumentEditItem } from './applier';
import {
  acceptAgentBlock,
  agentBlockHasContent,
  createAgentJobId,
  findAgentBlock,
  findSectionRange,
  getSelectionContext,
  insertAgentBlock,
  removeAgentBlock,
  resetAgentBlockContent,
  stopUndoCapturing,
  topLevelMarkdown,
  updateAgentBlock
} from './document';
import { createTopLevelRef, resolvePositionRef, topLevelIndexAt } from './positions';
import { clearRewritePreview, setRewritePreview } from './rewritePreview';

export type DocsAgentJob = {
  id: string;
  kind: 'block' | 'summarize' | 'rewrite';
  text: string;
  buildContext: () => SkillAssistantRequestContext | null;
  attempt: number;
  conversationId: string | null;
  status: 'running' | 'review' | 'error';
  error?: string;
  rewrite?: { from: string; to: string };
};

type DocsAgentContextValue = {
  canWrite: boolean;
  jobs: Record<string, DocsAgentJob>;
  focusBlockId: string | null;
  runBlock: (blockId: string, prompt: string) => void;
  retry: (jobId: string) => void;
  cancel: (jobId: string) => void;
  accept: (blockId: string) => void;
  discard: (blockId: string) => void;
  remove: (blockId: string) => void;
};

let DocsAgentContext = createContext<DocsAgentContextValue | null>(null);

export let useDocsAgent = () => useContext(DocsAgentContext);

let getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'The assistant could not finish this request.';

let findRewriteContent = (items: DocumentEditItem[]) => {
  for (let item of items) {
    for (let operation of item.operations) {
      if (operation.target == agentTargets.selection && operation.kind == 'replace') {
        return operation.content;
      }
    }
  }
  return null;
};

let AgentJobRunner = (p: {
  job: DocsAgentJob;
  workspace: SkillAssistantWorkspace;
  documentId: string;
  editor: Editor;
  applier: AgentEditApplier;
  onUpdate: (jobId: string, patch: Partial<DocsAgentJob>) => void;
  onAcceptRewrite: (jobId: string, content: string) => void;
  onDiscard: (jobId: string) => void;
  registerCancel: (jobId: string, cancel: (() => Promise<void>) | null) => void;
}) => {
  let { job } = p;

  let assistant = useSkillAssistant({
    organizationId: p.workspace.organizationId,
    instanceId: p.workspace.instanceId,
    skillId: p.workspace.skillId,
    documentId: p.documentId,
    conversationId: job.conversationId,
    onConversationCreated: conversationId => p.onUpdate(job.id, { conversationId })
  });

  let sentAttemptRef = useRef(0);
  let busyAttemptRef = useRef(0);
  let finishedAttemptRef = useRef(0);
  let [rewriteContent, setRewriteContent] = useState('');

  useEffect(() => {
    p.registerCancel(job.id, assistant.cancel);
    return () => p.registerCancel(job.id, null);
  }, [assistant.cancel, job.id, p.registerCancel]);

  useEffect(() => {
    if (sentAttemptRef.current == job.attempt) return;
    sentAttemptRef.current = job.attempt;

    let context = job.buildContext();
    if (!context) {
      finishedAttemptRef.current = job.attempt;
      p.onUpdate(job.id, {
        status: 'error',
        error: 'This part of the document no longer exists.'
      });
      return;
    }

    setRewriteContent('');
    assistant.send({ text: job.text, context }).catch(error => {
      finishedAttemptRef.current = job.attempt;
      p.onUpdate(job.id, { status: 'error', error: getErrorMessage(error) });
    });
  }, [job.attempt]);

  let edits = assistant.documentEdits;
  useEffect(() => {
    if (!edits.length) return;
    if (job.kind == 'rewrite') {
      let content = findRewriteContent(edits);
      if (content != null) setRewriteContent(content);
      return;
    }
    p.applier.sync(edits, { jobId: job.id });
  }, [edits, job.id, job.kind, p.applier]);

  useEffect(() => {
    if (assistant.isBusy) {
      busyAttemptRef.current = job.attempt;
      return;
    }
    if (busyAttemptRef.current != job.attempt || finishedAttemptRef.current == job.attempt)
      return;
    finishedAttemptRef.current = job.attempt;

    p.applier.flush();
    let hasContent =
      job.kind == 'rewrite' ? !!rewriteContent.trim() : agentBlockHasContent(p.editor, job.id);

    if (assistant.status == 'failed') {
      p.onUpdate(job.id, {
        status: 'error',
        error: assistant.error ?? 'The assistant could not finish this request.'
      });
    } else if (hasContent) {
      p.onUpdate(job.id, { status: 'review', error: undefined });
    } else {
      p.onUpdate(job.id, {
        status: 'error',
        error:
          assistant.status == 'cancelled'
            ? 'Stopped before anything was written.'
            : assistant.lastAssistantText || 'The assistant did not write anything.'
      });
    }
  }, [assistant.isBusy, assistant.status]);

  useEffect(() => {
    if (job.kind != 'rewrite' || !job.rewrite) return;
    setRewritePreview(p.editor, job.id, {
      from: job.rewrite.from,
      to: job.rewrite.to,
      content: rewriteContent,
      status: job.status,
      error: job.error,
      onAccept: () => p.onAcceptRewrite(job.id, rewriteContent),
      onDiscard: () => p.onDiscard(job.id)
    });
  }, [job.error, job.id, job.kind, job.rewrite, job.status, rewriteContent]);

  useEffect(() => () => clearRewritePreview(p.editor, job.id), [job.id, p.editor]);

  return null;
};

export let DocsAgentProvider = (p: {
  editor: Editor | null;
  documentId: string;
  workspace: SkillAssistantWorkspace | null;
  enabled: boolean;
  canWrite: boolean;
  setTitle: (title: string) => void;
  setFrontMatter: (frontMatter: string) => void;
  children: ReactNode;
}) => {
  let [jobs, setJobs] = useState<Record<string, DocsAgentJob>>({});
  let [applier, setApplier] = useState<AgentEditApplier | null>(null);
  let [focusBlockId, setFocusBlockId] = useState<string | null>(null);
  let cancelFnsRef = useRef(new Map<string, () => Promise<void>>());
  let jobsRef = useRef(jobs);
  jobsRef.current = jobs;
  let setTitleRef = useRef(p.setTitle);
  setTitleRef.current = p.setTitle;
  let setFrontMatterRef = useRef(p.setFrontMatter);
  setFrontMatterRef.current = p.setFrontMatter;

  let editor = p.enabled ? p.editor : null;
  let workspace = p.workspace;
  let canWrite = !!editor && !!workspace && p.canWrite;

  useEffect(() => {
    if (!editor) return;

    let next = new AgentEditApplier({
      editor,
      documentId: p.documentId,
      setTitle: title => setTitleRef.current(title),
      setFrontMatter: frontMatter => setFrontMatterRef.current(frontMatter)
    });
    setApplier(next);

    return () => {
      next.destroy();
      setApplier(null);
    };
  }, [editor, p.documentId]);

  let registerDocument = workspace?.registerDocument;
  useEffect(() => {
    if (!editor || !applier || !registerDocument) return;

    return registerDocument({
      documentId: p.documentId,
      canWrite: p.canWrite,
      getRequestContext: () => {
        let selection = getSelectionContext(editor);
        return selection ? { selection } : {};
      },
      applyEdits: items => applier.sync(items)
    });
  }, [applier, editor, p.canWrite, p.documentId, registerDocument]);

  let updateJob = useCallback(
    (jobId: string, patch: Partial<DocsAgentJob>) => {
      let job = jobsRef.current[jobId];
      if (!job) return;

      if (editor && job.kind != 'rewrite' && patch.status) {
        updateAgentBlock(editor, jobId, { status: patch.status });
      }

      setJobs(current =>
        current[jobId] ? { ...current, [jobId]: { ...current[jobId]!, ...patch } } : current
      );
    },
    [editor]
  );

  let removeJob = useCallback((jobId: string) => {
    setJobs(current => {
      if (!current[jobId]) return current;
      let next = { ...current };
      delete next[jobId];
      return next;
    });
  }, []);

  let startJob = useCallback(
    (job: Omit<DocsAgentJob, 'attempt' | 'conversationId' | 'status'>) => {
      setJobs(current => {
        let existing = current[job.id];
        return {
          ...current,
          [job.id]: {
            ...job,
            attempt: (existing?.attempt ?? 0) + 1,
            conversationId: existing?.conversationId ?? null,
            status: 'running',
            error: undefined
          }
        };
      });
    },
    []
  );

  let cancel = useCallback((jobId: string) => {
    void cancelFnsRef.current.get(jobId)?.();
  }, []);

  let registerCancel = useCallback((jobId: string, fn: (() => Promise<void>) | null) => {
    if (fn) cancelFnsRef.current.set(jobId, fn);
    else cancelFnsRef.current.delete(jobId);
  }, []);

  let blockContext = useCallback(
    (blockId: string, build: (blockRef: string) => SkillAssistantRequestContext) => () => {
      if (!editor) return null;
      let found = findAgentBlock(editor.state.doc, blockId);
      let blockRef = found ? createTopLevelRef(editor.state, found.index) : null;
      return blockRef ? build(blockRef) : null;
    },
    [editor]
  );

  let runBlock = useCallback(
    (blockId: string, prompt: string) => {
      if (!editor || !canWrite || !prompt.trim()) return;

      updateAgentBlock(editor, blockId, { status: 'running', prompt });
      resetAgentBlockContent(editor, blockId);
      startJob({
        id: blockId,
        kind: 'block',
        text: prompt,
        buildContext: blockContext(blockId, blockRef => ({
          mode: 'block',
          documentId: p.documentId,
          placement: 'inline',
          blockRef
        }))
      });
    },
    [blockContext, canWrite, editor, p.documentId, startJob]
  );

  let retry = useCallback(
    (jobId: string) => {
      if (!editor || !canWrite) return;
      let job = jobsRef.current[jobId];

      if (!job) {
        let found = findAgentBlock(editor.state.doc, jobId);
        if (found?.node.attrs.mode == 'block' && found.node.attrs.prompt) {
          runBlock(jobId, found.node.attrs.prompt as string);
        }
        return;
      }

      if (job.kind != 'rewrite') {
        updateAgentBlock(editor, jobId, { status: 'running' });
        resetAgentBlockContent(editor, jobId);
      }
      startJob(job);
    },
    [canWrite, editor, runBlock, startJob]
  );

  let accept = useCallback(
    (blockId: string) => {
      if (!editor) return;
      cancel(blockId);
      acceptAgentBlock(editor, blockId);
      removeJob(blockId);
    },
    [cancel, editor, removeJob]
  );

  let remove = useCallback(
    (blockId: string) => {
      if (!editor) return;
      cancel(blockId);
      removeAgentBlock(editor, blockId);
      removeJob(blockId);
    },
    [cancel, editor, removeJob]
  );

  let discard = useCallback(
    (blockId: string) => {
      if (!editor) return;
      let found = findAgentBlock(editor.state.doc, blockId);
      if (found?.node.attrs.mode != 'block') return remove(blockId);

      cancel(blockId);
      resetAgentBlockContent(editor, blockId);
      updateAgentBlock(editor, blockId, { status: 'idle' });
      removeJob(blockId);
    },
    [cancel, editor, remove, removeJob]
  );

  let discardJob = useCallback(
    (jobId: string) => {
      cancel(jobId);
      removeJob(jobId);
    },
    [cancel, removeJob]
  );

  let acceptRewrite = useCallback(
    (jobId: string, content: string) => {
      let job = jobsRef.current[jobId];
      if (!editor || !job?.rewrite) return;

      let from = resolvePositionRef(editor.state, job.rewrite.from);
      let to = resolvePositionRef(editor.state, job.rewrite.to);
      removeJob(jobId);
      if (from == null || to == null || to < from) return;

      stopUndoCapturing(editor);
      editor.chain().focus().insertContentAt({ from, to }, content.trim()).run();
      stopUndoCapturing(editor);
    },
    [editor, removeJob]
  );

  let api = useMemo<DocsAgentApi | null>(() => {
    if (!editor) return null;

    let insertionIndex = () => {
      let doc = editor.state.doc;
      let index = topLevelIndexAt(doc, editor.state.selection.from);
      let current = doc.maybeChild(index);
      let replaceEmpty =
        !!current?.isTextblock &&
        current.type.name == 'paragraph' &&
        current.content.size == 0;
      return { index: replaceEmpty ? index : index + 1, cursorIndex: index, replaceEmpty };
    };

    return {
      canWrite,

      insertAgentBlock: () => {
        if (!canWrite) return;
        let blockId = createAgentJobId();
        let { index, replaceEmpty } = insertionIndex();
        insertAgentBlock(editor, {
          index,
          blockId,
          mode: 'block',
          status: 'idle',
          replaceEmpty
        });
        setFocusBlockId(blockId);
      },

      summarizeSection: () => {
        if (!canWrite) return;
        let { index, cursorIndex, replaceEmpty } = insertionIndex();
        let range = findSectionRange(editor.state.doc, editor.state.selection.from);
        let text = topLevelMarkdown(editor, range, replaceEmpty ? cursorIndex : undefined);
        if (!text.trim()) return;

        let blockId = createAgentJobId();
        insertAgentBlock(editor, {
          index,
          blockId,
          mode: 'summarize',
          status: 'running',
          replaceEmpty
        });
        startJob({
          id: blockId,
          kind: 'summarize',
          text: 'Summarize this section.',
          buildContext: blockContext(blockId, blockRef => ({
            mode: 'summarize',
            documentId: p.documentId,
            placement: 'inline',
            target: { type: 'section', ref: blockRef, text }
          }))
        });
      },

      summarizeSelection: () => {
        if (!canWrite) return;
        let selection = getSelectionContext(editor);
        if (!selection) return;

        let doc = editor.state.doc;
        let index = topLevelIndexAt(doc, editor.state.selection.to) + 1;
        let blockId = createAgentJobId();
        editor.commands.setTextSelection(editor.state.selection.to);
        insertAgentBlock(editor, { index, blockId, mode: 'summarize', status: 'running' });
        startJob({
          id: blockId,
          kind: 'summarize',
          text: 'Summarize the selected text.',
          buildContext: blockContext(blockId, blockRef => ({
            mode: 'summarize',
            documentId: p.documentId,
            placement: 'inline',
            target: { type: 'selection', ref: blockRef, text: selection.text }
          }))
        });
      },

      rewriteSelection: instruction => {
        if (!canWrite || !instruction.trim()) return;
        let selection = getSelectionContext(editor);
        if (!selection) return;

        editor.commands.setTextSelection(editor.state.selection.to);
        startJob({
          id: createAgentJobId(),
          kind: 'rewrite',
          text: instruction,
          rewrite: { from: selection.from, to: selection.to },
          buildContext: () => ({
            mode: 'rewrite',
            documentId: p.documentId,
            placement: 'inline',
            selection
          })
        });
      }
    };
  }, [blockContext, canWrite, editor, p.documentId, startJob]);

  useEffect(() => {
    if (!editor) return;
    setDocsAgentApi(editor, api);
    return () => setDocsAgentApi(editor, null);
  }, [api, editor]);

  let value = useMemo<DocsAgentContextValue | null>(
    () =>
      editor && workspace
        ? { canWrite, jobs, focusBlockId, runBlock, retry, cancel, accept, discard, remove }
        : null,
    [
      accept,
      canWrite,
      cancel,
      discard,
      editor,
      focusBlockId,
      jobs,
      remove,
      retry,
      runBlock,
      workspace
    ]
  );

  return (
    <DocsAgentContext.Provider value={value}>
      {p.children}
      {editor &&
        workspace &&
        applier &&
        Object.values(jobs).map(job => (
          <AgentJobRunner
            key={job.id}
            job={job}
            workspace={workspace}
            documentId={p.documentId}
            editor={editor}
            applier={applier}
            onUpdate={updateJob}
            onAcceptRewrite={acceptRewrite}
            onDiscard={discardJob}
            registerCancel={registerCancel}
          />
        ))}
    </DocsAgentContext.Provider>
  );
};
