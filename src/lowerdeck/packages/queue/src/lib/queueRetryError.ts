export class QueueRetryError extends Error {
  constructor() {
    super('RETRY');
  }
}
