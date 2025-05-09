export class Emitter<T extends Record<string, any>> {
  #listeners = new Map<keyof T, Set<(data: T[keyof T]) => void>>();

  on<K extends keyof T>(event: K, callback: (data: T[K]) => void): () => void {
    if (!this.#listeners.has(event)) this.#listeners.set(event, new Set());
    this.#listeners.get(event)?.add(callback as any);

    return () => {
      this.#listeners.get(event)?.delete(callback as any);
    };
  }

  emit<K extends keyof T>(
    ...[event, data]: T[K] extends void | never | undefined
      ? [K, never | undefined]
      : [K, T[K]]
  ): void {
    this.#listeners.get(event)?.forEach(callback => callback((data ?? undefined) as any));
  }

  clear<K extends keyof T>(event?: K): void {
    if (event) {
      this.#listeners.get(event)?.clear();
    } else {
      this.#listeners.clear();
    }
  }

  once<K extends keyof T>(event: K, callback: (data: T[K]) => void): () => void {
    const wrappedCallback = (data: T[K]) => {
      callback(data);
      this.off(event, wrappedCallback);
    };

    this.on(event, wrappedCallback);

    return () => {
      this.off(event, wrappedCallback);
    };
  }

  private off<K extends keyof T>(event: K, callback: (data: T[K]) => void): void {
    this.#listeners.get(event)?.delete(callback as any);
  }
}
