import { preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { getConfiguredSink } from '../lib/sink';
import type { MemorySinkFilter } from '../lib/memory';

class RecordReadbackServiceImpl {
  isAvailable() {
    return !!getConfiguredSink().readback;
  }

  async list(d: MemorySinkFilter) {
    return this.readback().list(d);
  }

  async clear() {
    this.readback().clear();
  }

  async setBusy(d: { busy: boolean }) {
    this.readback().setBusy(d.busy);
  }

  private readback() {
    let readback = getConfiguredSink().readback;

    if (!readback) {
      throw new ServiceError(
        preconditionFailedError({
          message: 'Record readback requires AGENT_TRACKING_SINK=memory.'
        })
      );
    }

    return readback;
  }
}

export let recordReadbackService = Service.create(
  'recordReadbackService',
  () => new RecordReadbackServiceImpl()
).build();
