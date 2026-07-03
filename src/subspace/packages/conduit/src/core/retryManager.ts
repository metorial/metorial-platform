export class RetryManager {
  constructor(
    private maxRetries: number,
    private initialBackoffMs: number,
    private backoffMultiplier: number
  ) {}

  async withRetry<T>(
    fn: (attemptNumber: number) => Promise<T>,
    context: string,
    shouldRetry?: (error: Error, attemptNumber: number) => boolean
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn(attempt);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        let retryable = shouldRetry ? shouldRetry(lastError, attempt) : true;

        if (attempt < this.maxRetries && retryable) {
          let backoffMs = this.calculateBackoff(attempt);
          console.warn(
            `${context} failed (attempt ${attempt + 1}/${this.maxRetries + 1}), retrying in ${backoffMs}ms:`,
            lastError.message
          );
          await this.sleep(backoffMs);
        }
      }
    }

    if (lastError) {
      throw lastError;
    }

    throw new Error(`${context} failed after ${this.maxRetries + 1} attempts`);
  }

  calculateBackoff(attempt: number): number {
    return this.initialBackoffMs * this.backoffMultiplier ** attempt;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
