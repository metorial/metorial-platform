export class Semaphore {
  private available: number;
  private waiters: Array<() => void> = [];

  constructor(permits: number) {
    this.available = Math.max(1, Math.floor(permits));
  }

  async acquire(): Promise<void> {
    if (this.available > 0) {
      this.available--;
      return;
    }

    await new Promise<void>(resolve => {
      this.waiters.push(resolve);
    });
  }

  release(): void {
    let next = this.waiters.shift();
    if (next) {
      // Hand the permit directly to the next waiter (do not increment).
      next();
    } else {
      this.available++;
    }
  }

  getAvailable(): number {
    return this.available;
  }

  getWaiting(): number {
    return this.waiters.length;
  }
}
