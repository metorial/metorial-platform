// Original source: https://github.com/Azure/fetch-event-source/blob/main/src/fetch.ts
// License: https://github.com/Azure/fetch-event-source/blob/main/LICENSE

import { safeFetch } from '../http/fetchSsrf';
import { type EventSourceMessage, getBytes, getLines, getMessages } from './parse';

export let EventStreamContentType = 'text/event-stream';

export interface FetchEventSourceInit extends RequestInit {
  headers?: Record<string, string>;
  onopen?: (response: Response) => Promise<void>;
  onmessage?: (ev: EventSourceMessage) => void;
  onclose?: () => void;
  onerror?: (err: any) => void;
  openWhenHidden?: boolean;
  handleNonStreamResponses?: boolean;
}

export let fetchEventSource = async (
  input: string,
  {
    signal: inputSignal,
    headers: inputHeaders,
    onopen: inputOnOpen,
    onmessage,
    onclose,
    onerror,
    openWhenHidden,
    handleNonStreamResponses,
    ...rest
  }: FetchEventSourceInit
) => {
  // make a copy of the input headers since we may modify it below:
  let headers = { ...inputHeaders };
  if (!headers.accept) {
    headers.accept = EventStreamContentType;
  }

  let response = await safeFetch(input, {
    ...rest,
    headers
  });

  if (response.status >= 400) {
    let text = await response.text();
    let err = new Error(`Error response ${response.status} ${response.statusText}`);
    onerror?.(err);
    return;
  }

  await inputOnOpen?.(response);

  let contentType = response.headers.get('content-type');
  if (!contentType) return;

  if (!contentType.startsWith(EventStreamContentType)) {
    if (!handleNonStreamResponses) {
      let err = new Error(
        `Expected content-type to be ${EventStreamContentType}, Actual: ${contentType}`
      );
      onerror?.(err);
      return;
    }

    let text = await response.text();
    await onmessage?.({
      data: text,
      id: '',
      event: 'message',
      retry: undefined
    });
    onclose?.();
    return;
  }

  await getBytes(
    response.body!,
    getLines(
      getMessages(
        id => {},
        retry => {},
        onmessage
      )
    )
  );

  onclose?.();
};
