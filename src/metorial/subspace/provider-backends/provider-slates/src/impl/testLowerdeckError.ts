export let badRequestError = (value: unknown) => value;

export class ServiceError extends Error {
  constructor(value: unknown) {
    super(JSON.stringify(value));
  }
}
