// Thrown by a handler to answer a conditional request (`If-None-Match`) whose representation
// hasn't changed: the server replies 304 with these headers and no body.
export class NotModified {
  constructor(readonly headers: Record<string, string> = {}) {}
}
