export class Observable<T> {
  public valueRef: { current: T };
  public listeners = new Set<(value: T) => void>();

  constructor(initialValue: T) {
    this.valueRef = { current: initialValue };
  }

  get value() {
    return this.valueRef.current;
  }

  next(value: T) {
    this.valueRef.current = value;

    for (let listener of this.listeners) {
      listener(value);
    }
  }

  subscribe(listener: (value: T) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  subscribeOnce(listener: (value: T) => void) {
    let unsubscribe = this.subscribe(value => {
      listener(value);
      unsubscribe();
    });
  }

  hasSubscribers() {
    return this.listeners.size > 0;
  }
}
