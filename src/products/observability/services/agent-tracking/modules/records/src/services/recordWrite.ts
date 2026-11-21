import { Service } from '@lowerdeck/service';
import type { RecordBatch } from '@mtsrc/agent-tracking-store';
import { storedRecords } from '../lib/persistence';
import { getConfiguredSink } from '../lib/sink';

class RecordWriteServiceImpl {
  async write(d: { batch: RecordBatch }) {
    let records = storedRecords(d.batch.records);
    if (!records.length) return;

    await getConfiguredSink().sink.write({ ...d.batch, records });
  }
}

export let recordWriteService = Service.create(
  'recordWriteService',
  () => new RecordWriteServiceImpl()
).build();
