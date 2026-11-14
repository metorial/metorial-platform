export { createMemorySink, type MemorySink } from './lib/memory';
export { createMongoSink, type MongoWriteStats } from './lib/mongo';
export { createNdjsonSink } from './lib/ndjson';
export { createNoopSink } from './lib/noop';
export { setConfiguredSink as setRecordSink } from './lib/sink';
export { toRecordDocument } from './lib/mapper';
export { eraseCollections, eraseFilter, type EraseScope } from './queues/eraseRecords';
export * from './services';
export { recordsQueueProcessor } from './queues';
