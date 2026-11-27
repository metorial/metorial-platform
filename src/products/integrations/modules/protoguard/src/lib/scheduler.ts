let DEFAULT_SLICE_MS = 4;
let DEFAULT_MAX_CHARS_IN_FLIGHT = 64 * 1024 * 1024;
let DEFAULT_MAX_QUEUED_JOBS = 256;

export interface ActiveClock {
  now: () => number;
}

export type ScanJobOutcome<T> =
  | { type: 'completed'; result: T; activeMs: number }
  | { type: 'skipped'; reason: 'backpressure' }
  | { type: 'failed'; error: unknown };

export interface ScanJob<T> {
  chars: number;
  start: (clock: ActiveClock) => Generator<void, T>;
  onSettled: (outcome: ScanJobOutcome<T>) => unknown;
}

interface RunningJob {
  job: ScanJob<any>;
  iterator: Generator<void, any> | null;
  activeMs: number;
  sliceStartedAt: number | null;
}

export interface ScanSchedulerOptions {
  sliceMs?: number;
  maxCharsInFlight?: number;
  maxQueuedJobs?: number;
  now?: () => number;
  defer?: (fn: () => void) => void;
}

// Scans run on the gateway's own event loop, so they are cut into short slices with a
// setImmediate between them; I/O callbacks always get a turn before the next slice. Jobs run one
// at a time, and memory is bounded by the characters of payloads still waiting to be scanned.
export class ScanScheduler {
  private queue: RunningJob[] = [];
  private charsInFlight = 0;
  private isPumpScheduled = false;

  private sliceMs: number;
  private maxCharsInFlight: number;
  private maxQueuedJobs: number;
  private now: () => number;
  private defer: (fn: () => void) => void;

  constructor(opts: ScanSchedulerOptions = {}) {
    this.sliceMs = opts.sliceMs ?? DEFAULT_SLICE_MS;
    this.maxCharsInFlight = opts.maxCharsInFlight ?? DEFAULT_MAX_CHARS_IN_FLIGHT;
    this.maxQueuedJobs = opts.maxQueuedJobs ?? DEFAULT_MAX_QUEUED_JOBS;
    this.now = opts.now ?? (() => performance.now());
    this.defer = opts.defer ?? (fn => setImmediate(fn));
  }

  get stats() {
    return { queuedJobs: this.queue.length, charsInFlight: this.charsInFlight };
  }

  schedule<T>(job: ScanJob<T>) {
    let isQueueFull = this.queue.length >= this.maxQueuedJobs;
    let isOverCharCap =
      this.queue.length > 0 && this.charsInFlight + job.chars > this.maxCharsInFlight;

    if (isQueueFull || isOverCharCap) {
      this.defer(() => this.settle(job, { type: 'skipped', reason: 'backpressure' }));
      return false;
    }

    this.charsInFlight += job.chars;
    this.queue.push({ job, iterator: null, activeMs: 0, sliceStartedAt: null });
    this.schedulePump();

    return true;
  }

  private schedulePump() {
    if (this.isPumpScheduled) return;

    this.isPumpScheduled = true;
    this.defer(() => {
      this.isPumpScheduled = false;
      this.runSlice();
    });
  }

  private runSlice() {
    let running = this.queue[0];
    if (!running) return;

    let sliceStartedAt = this.now();
    running.sliceStartedAt = sliceStartedAt;

    try {
      running.iterator ??= running.job.start({
        now: () =>
          running.activeMs +
          (running.sliceStartedAt == null ? 0 : this.now() - running.sliceStartedAt)
      });

      while (true) {
        let step = running.iterator.next();

        if (step.done) {
          running.activeMs += this.now() - sliceStartedAt;
          this.finish(running, {
            type: 'completed',
            result: step.value,
            activeMs: running.activeMs
          });
          break;
        }

        if (this.now() - sliceStartedAt >= this.sliceMs) {
          running.activeMs += this.now() - sliceStartedAt;
          running.sliceStartedAt = null;
          break;
        }
      }
    } catch (error) {
      this.finish(running, { type: 'failed', error });
    }

    if (this.queue.length) this.schedulePump();
  }

  private finish(running: RunningJob, outcome: ScanJobOutcome<any>) {
    this.queue.shift();
    this.charsInFlight -= running.job.chars;
    running.iterator = null;
    running.sliceStartedAt = null;

    this.defer(() => this.settle(running.job, outcome));
  }

  private settle<T>(job: ScanJob<T>, outcome: ScanJobOutcome<T>) {
    try {
      Promise.resolve(job.onSettled(outcome)).catch(() => {});
    } catch {}
  }
}
