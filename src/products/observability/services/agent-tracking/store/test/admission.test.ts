import { describe, expect, it } from 'vitest';
import { expectServiceError } from '@mtsrc/agent-tracking-testing';
import { createAdmission } from '../src/admission';

let deferred = () => {
  let resolve!: () => void;
  let promise = new Promise<void>(r => (resolve = r));

  return { promise, resolve };
};

describe('createAdmission', () => {
  it('rejects with sink_busy once a lane is full', async () => {
    let admission = createAdmission({ live: 2, backfill: 1 });
    let gate = deferred();

    let running = [
      admission.run('live', () => gate.promise),
      admission.run('live', () => gate.promise)
    ];

    expect(admission.inFlight('live')).toBe(2);
    await expectServiceError(
      admission.run('live', async () => {}),
      'sink_busy'
    );

    gate.resolve();
    await Promise.all(running);

    expect(admission.inFlight('live')).toBe(0);
    await expect(admission.run('live', async () => 'ok')).resolves.toBe('ok');
  });

  it('keeps lanes independent', async () => {
    let admission = createAdmission({ live: 1, backfill: 1 });
    let gate = deferred();

    let running = admission.run('backfill', () => gate.promise);

    await expectServiceError(
      admission.run('backfill', async () => {}),
      'sink_busy'
    );
    await expect(admission.run('live', async () => 'live')).resolves.toBe('live');

    gate.resolve();
    await running;
  });

  it('frees the slot when the work fails', async () => {
    let admission = createAdmission({ live: 1, backfill: 1 });

    await expect(
      admission.run('live', async () => {
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');

    expect(admission.inFlight('live')).toBe(0);
  });
});
