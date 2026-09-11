export class Store<Value> {
  #value: Value;

  constructor(initialValue: Value) {
    this.#value = initialValue;
  }

  get value(): Value {
    return this.#value;
  }

  get(): Value {
    return this.#value;
  }

  set(newValue: Value) {
    this.#value = newValue;
  }
}
