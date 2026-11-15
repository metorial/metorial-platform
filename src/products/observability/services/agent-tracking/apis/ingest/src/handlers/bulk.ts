import { ingestService } from '@mtsrc/agent-tracking-module-ingest';
import { readNdjsonLines } from '../body';
import { ingestCallOf, type IngestHandler, type PublicIngestHandler } from '../request';
import { jsonResponse } from '../response';

export let bulkIngestHandler: IngestHandler = async request => {
  let result = await ingestService.ingestBulk({
    call: ingestCallOf(request),
    lines: readNdjsonLines(request.body)
  });

  return jsonResponse(200, result);
};

export let bulkDialectsHandler: PublicIngestHandler = async () =>
  jsonResponse(200, {
    object: 'agent_tracking#bulk_dialects',
    items: await ingestService.listBulkDialects()
  });
