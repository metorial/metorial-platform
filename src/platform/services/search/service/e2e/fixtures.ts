import { eventually, uniqueId } from '@lowerdeck/testing-tools';
import { expect } from 'vitest';
import { voyager } from './client';

export let uniqueWord = () =>
  Array.from({ length: 14 }, () =>
    String.fromCharCode(97 + Math.floor(Math.random() * 26))
  ).join('');

export let createSource = async (name = 'Test Source') =>
  voyager.source.upsert({ identifier: uniqueId('source'), name });

export let createIndex = async (
  sourceId: string,
  options: { identifier?: string; name?: string } = {}
) =>
  voyager.index.upsert({
    sourceId,
    identifier: options.identifier ?? uniqueId('index'),
    name: options.name ?? 'Test Index'
  });

export let createSourceWithIndex = async (options: { indexIdentifier?: string } = {}) => {
  let source = await createSource();
  let index = await createIndex(source.id, { identifier: options.indexIdentifier });
  return { source, index };
};

type IndexRecordInput = {
  documentId?: string;
  tenantIds?: string[];
  fields?: Record<string, any>;
  body?: string | Record<string, any>;
  metadata?: Record<string, any>;
};

export let indexRecord = async (
  target: { sourceId: string; indexId: string },
  input: IndexRecordInput = {}
) =>
  voyager.record.index({
    ...target,
    documentId: input.documentId ?? uniqueId('doc'),
    tenantIds: input.tenantIds,
    fields: input.fields ?? {},
    body: input.body ?? 'default body',
    metadata: input.metadata
  });

export let searchDocumentIds = async (
  target: { sourceId: string; indexId: string },
  query: string,
  options: { tenantId?: string; filters?: Record<string, any> } = {}
) => {
  let results = await voyager.record.search({ ...target, query, ...options });
  return results.map(r => r.documentId).sort();
};

export let expectSearchToFind = async (
  target: { sourceId: string; indexId: string },
  query: string,
  expected: string[],
  options: { tenantId?: string; filters?: Record<string, any> } = {}
) =>
  eventually(async () => {
    expect(await searchDocumentIds(target, query, options)).toEqual([...expected].sort());
  });
