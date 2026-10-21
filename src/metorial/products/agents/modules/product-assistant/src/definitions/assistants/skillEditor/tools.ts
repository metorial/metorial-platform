import { jsonSchema, tool, type Tool } from 'ai';
import type {
  AgentRunExtension,
  AgentRunStateWriter,
  AgentRunToolAdapter
} from '../../../lib/run/extension';
import {
  documentEndTarget,
  type ActiveDocumentView,
  type BlockEditOperation,
  type SkillWorkspace
} from '../../../lib/skillWorkspace';
import type { DocumentEditOperation, DocumentEditReview, StateItem } from '../../../types';
import type { SkillEditorRequest } from './context';

type DocumentEditItem = Extract<StateItem, { type: 'document/edit' }>;

let operationTypes = ['replace', 'insert_before', 'insert_after', 'delete'] as const;

let contentInput = (description: string) =>
  jsonSchema<{ content: string }>({
    type: 'object',
    properties: { content: { type: 'string', description } },
    required: ['content'],
    additionalProperties: false
  });

let getPartialContent = (partialInput: unknown) => {
  if (!partialInput || typeof partialInput != 'object') return undefined;
  let content = (partialInput as { content?: unknown }).content;
  return typeof content == 'string' ? content : undefined;
};

let getPartialOperations = (partialInput: unknown): Partial<BlockEditOperation>[] => {
  if (!partialInput || typeof partialInput != 'object') return [];
  let operations = (partialInput as { operations?: unknown }).operations;
  return Array.isArray(operations)
    ? operations.filter(
        (op): op is Partial<BlockEditOperation> => !!op && typeof op == 'object'
      )
    : [];
};

let findItem = (writer: AgentRunStateWriter, toolCallId: string) =>
  writer.items.find(
    (item): item is DocumentEditItem =>
      item.type == 'document/edit' && item.toolCallId == toolCallId
  );

let ensureItem = (d: {
  writer: AgentRunStateWriter;
  toolCallId: string;
  documentId: string;
  review: DocumentEditReview;
}) => {
  let existing = findItem(d.writer, d.toolCallId);
  if (existing) return existing;

  d.writer.items.push({
    id: d.writer.createItemId(),
    type: 'document/edit',
    toolCallId: d.toolCallId,
    documentId: d.documentId,
    status: 'running',
    review: d.review,
    operations: []
  });

  return findItem(d.writer, d.toolCallId)!;
};

let syncOperations = (item: DocumentEditItem, next: DocumentEditOperation[]) => {
  next.forEach((operation, index) => {
    let current = item.operations[index];
    if (!current) {
      item.operations.push(operation);
      return;
    }

    if (current.kind != operation.kind) current.kind = operation.kind;
    if (current.target != operation.target) current.target = operation.target;
    if (current.targetEnd != operation.targetEnd) current.targetEnd = operation.targetEnd;
    if (current.ref != operation.ref) current.ref = operation.ref;
    if (current.refEnd != operation.refEnd) current.refEnd = operation.refEnd;
    if (current.content != operation.content) current.content = operation.content;
    if (current.finished != operation.finished) current.finished = operation.finished;
    if (current.error != operation.error) current.error = operation.error;
  });

  if (item.operations.length > next.length) item.operations.splice(next.length);
};

let createAdapter = (d: {
  documentId: string;
  review: DocumentEditReview;
  preview: (partialInput: unknown) => DocumentEditOperation[];
  final: (toolCallId: string, input: unknown) => DocumentEditOperation[];
}): AgentRunToolAdapter => {
  let inputs = new Map<string, unknown>();
  let item = (writer: AgentRunStateWriter, toolCallId: string) =>
    ensureItem({ writer, toolCallId, documentId: d.documentId, review: d.review });

  return {
    onInputStart: ({ toolCallId, writer }) => {
      item(writer, toolCallId);
    },
    onInputDelta: ({ toolCallId, partialInput, writer }) => {
      syncOperations(item(writer, toolCallId), d.preview(partialInput));
    },
    onStart: ({ toolCallId, input, writer }) => {
      inputs.set(toolCallId, input);
      syncOperations(item(writer, toolCallId), d.preview(input));
    },
    onDone: ({ toolCallId, output, writer }) => {
      let current = item(writer, toolCallId);
      syncOperations(current, d.final(toolCallId, inputs.get(toolCallId)));
      inputs.delete(toolCallId);
      current.output = output;
      current.status = 'completed';
    },
    onError: ({ toolCallId, error, writer }) => {
      let current = item(writer, toolCallId);
      inputs.delete(toolCallId);
      for (let operation of current.operations) {
        operation.finished = true;
        operation.error = error;
      }
      current.error = { message: error };
      current.status = 'failed';
    }
  };
};

let fixedTargetTool = (d: {
  name: string;
  description: string;
  contentDescription: string;
  documentId: string;
  operation: Omit<DocumentEditOperation, 'content' | 'finished'>;
}) => {
  let toPreview = (content: string | undefined, finished: boolean) =>
    content === undefined ? [] : [{ ...d.operation, content, finished }];

  return {
    tool: tool({
      description: d.description,
      inputSchema: contentInput(d.contentDescription),
      execute: async ({ content }) =>
        content.trim()
          ? { ok: true, status: 'The content is shown to the user for review.' }
          : { error: 'content must not be empty' }
    }),
    adapter: createAdapter({
      documentId: d.documentId,
      review: 'pending',
      preview: partialInput => toPreview(getPartialContent(partialInput), false),
      final: (_toolCallId, input) => toPreview(getPartialContent(input), true)
    })
  };
};

let createDocumentTools = (d: { view: ActiveDocumentView; writable: boolean }) => {
  let resolved = new Map<string, DocumentEditOperation[]>();
  let tools: Record<string, Tool> = {};
  let adapters: Record<string, AgentRunToolAdapter> = {};

  tools.read_document = tool({
    description:
      'Read the open document as numbered blocks like "[b3] ## Heading". Large documents are returned in chunks; pass from to continue.',
    inputSchema: jsonSchema<{ from?: string; to?: string }>({
      type: 'object',
      properties: {
        from: { type: 'string', description: 'First block id to return, e.g. "b12"' },
        to: { type: 'string', description: 'Last block id to return' }
      },
      additionalProperties: false
    }),
    execute: async input => {
      if (!d.view.hasPendingBlocks) await d.view.refresh();
      return await d.view.read(input);
    }
  });

  if (!d.writable) return { tools, adapters };

  tools.edit_document = tool({
    description:
      'Edit the open document with block operations. Changes are applied in the editor immediately, in order.',
    inputSchema: jsonSchema<{ operations: BlockEditOperation[] }>({
      type: 'object',
      properties: {
        operations: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: [...operationTypes] },
              target: {
                type: 'string',
                description: `Block id from read_document, "doc_start", "${documentEndTarget}", or "@title"`
              },
              targetEnd: {
                type: 'string',
                description: 'Optional last block id (inclusive) for replace and delete'
              },
              content: {
                type: 'string',
                description: 'Markdown for replace and insert operations'
              }
            },
            required: ['type', 'target'],
            additionalProperties: false
          }
        }
      },
      required: ['operations'],
      additionalProperties: false
    }),
    execute: async ({ operations }, { toolCallId }) => {
      let results = await d.view.applyOperations({ toolCallId, operations, checkStale: true });
      resolved.set(
        toolCallId,
        results.map(result => result.operation)
      );

      let failed = results
        .map((result, index) => ({ index, error: result.error }))
        .filter(result => result.error);

      return failed.length
        ? {
            applied: results.length - failed.length,
            failed,
            status: 'Some operations failed. Successful operations were applied.'
          }
        : { applied: results.length, status: 'All operations were applied.' };
    }
  });

  adapters.edit_document = createAdapter({
    documentId: d.view.documentId,
    review: 'direct',
    preview: partialInput =>
      getPartialOperations(partialInput)
        .map(operation => d.view.toPreviewOperation(operation))
        .filter((operation): operation is DocumentEditOperation => !!operation),
    final: toolCallId => {
      let operations = resolved.get(toolCallId) ?? [];
      resolved.delete(toolCallId);
      return operations;
    }
  });

  return { tools, adapters };
};

export let createSkillEditorTools = (d: {
  request: SkillEditorRequest;
  workspace: SkillWorkspace;
}) => {
  let tools: Record<string, Tool> = {};
  let adapters: Record<string, AgentRunToolAdapter> = {};
  let documentId = d.request.document?.id;
  let view = d.workspace.view;

  if (view) {
    let documentTools = createDocumentTools({ view, writable: d.request.mode == 'document' });
    Object.assign(tools, documentTools.tools);
    Object.assign(adapters, documentTools.adapters);
  }

  let addFixedTool = (fixed: ReturnType<typeof fixedTargetTool>, name: string) => {
    tools[name] = fixed.tool;
    adapters[name] = fixed.adapter;
  };

  if (documentId && d.request.mode == 'block' && d.request.blockRef) {
    addFixedTool(
      fixedTargetTool({
        name: 'write_block',
        description: 'Write the complete markdown content of the AI block.',
        contentDescription: 'Markdown content for the block',
        documentId,
        operation: { kind: 'replace', target: 'block', ref: d.request.blockRef }
      }),
      'write_block'
    );
  }

  if (documentId && d.request.mode == 'rewrite' && d.request.selection) {
    addFixedTool(
      fixedTargetTool({
        name: 'replace_selection',
        description: "Replace the user's selected text with the rewritten markdown.",
        contentDescription: 'Replacement markdown for the selection',
        documentId,
        operation: {
          kind: 'replace',
          target: 'selection',
          ref: d.request.selection.from,
          refEnd: d.request.selection.to
        }
      }),
      'replace_selection'
    );
  }

  if (documentId && d.request.mode == 'summarize') {
    let target = d.request.target;
    let operation: Omit<DocumentEditOperation, 'content' | 'finished'> =
      target?.type == 'selection' && d.request.selection
        ? { kind: 'insert_after', target: 'selection', ref: d.request.selection.to }
        : target?.ref
          ? { kind: 'insert_after', target: 'anchor', ref: target.ref }
          : { kind: 'insert_after', target: documentEndTarget };

    addFixedTool(
      fixedTargetTool({
        name: 'insert_after',
        description: 'Insert the summary into the document after the summarized content.',
        contentDescription: 'Markdown summary',
        documentId,
        operation
      }),
      'insert_after'
    );
  }

  let extension: AgentRunExtension = {
    tools: adapters,
    onEvent: ({ event, writer }) => {
      if (event.type != 'tool.done' && event.type != 'tool.error') return;

      let result = d.workspace.takeToolResult(event.toolCallId);
      if (!result) return;

      if (result.documentOperations.length && documentId) {
        writer.items.push({
          id: writer.createItemId(),
          type: 'document/edit',
          toolCallId: event.toolCallId,
          documentId,
          status: 'completed',
          review: 'direct',
          operations: result.documentOperations
        });
      }

      if (result.changes.length) {
        writer.items.push({
          id: writer.createItemId(),
          type: 'skill/changes',
          changes: result.changes
        });
      }
    }
  };

  return { tools, extension };
};
