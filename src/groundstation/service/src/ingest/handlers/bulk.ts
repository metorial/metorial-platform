import { notImplementedError } from '@lowerdeck/error';
import type { BulkDialect } from '@metorial/groundstation-spec';
import type { IngestHandler } from '../request';
import { errorResponse, jsonResponse } from '../response';

export let bulkIngestHandler: IngestHandler = async () => errorResponse(notImplementedError());

export let bulkDialectsHandler: IngestHandler = async () => {
  let items: BulkDialect[] = [];

  return jsonResponse(200, { object: 'groundstation#bulk_dialects', items });
};
