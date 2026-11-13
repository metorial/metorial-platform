import { Service } from '@lowerdeck/service';
import type { RecordBatch } from '@mtsrc/agent-tracking-store';
import { getConfiguredSink } from '../lib/sink';

class RecordWriteServiceImpl {
  async write(d: { batch: RecordBatch }) {
    await getConfiguredSink().sink.write(d.batch);
  }
}

export let recordWriteService = Service.create(
  'recordWriteService',
  () => new RecordWriteServiceImpl()
).build();
