// Original source: https://github.com/Azure/fetch-event-source/blob/main/src/parse.ts
// License: https://github.com/Azure/fetch-event-source/blob/main/LICENSE

export interface EventSourceMessage {
  id: string;
  event: string;
  data: string;
  retry?: number;
}

export let getBytes = async (
  stream: ReadableStream<Uint8Array>,
  onChunk: (arr: Uint8Array) => void
) => {
  let reader = stream.getReader();
  while (true) {
    let result = await reader.read();
    if (result.done) break;
    onChunk(result.value);
  }
};

export enum ControlChars {
  NewLine = 10,
  CarriageReturn = 13,
  Space = 32,
  Colon = 58
}

export let getLines = (onLine: (line: Uint8Array, fieldLength: number) => void) => {
  let buffer: Uint8Array | undefined;
  let position: number; // current read position
  let fieldLength: number; // length of the `field` portion of the line
  let discardTrailingNewline = false;

  // return a function that can process each incoming byte chunk:
  return function onChunk(arr: Uint8Array) {
    if (buffer === undefined) {
      buffer = arr;
      position = 0;
      fieldLength = -1;
    } else {
      // we're still parsing the old line. Append the new bytes into buffer:
      buffer = concat(buffer, arr);
    }

    let bufLength = buffer.length;
    let lineStart = 0; // index where the current line starts
    while (position < bufLength) {
      if (discardTrailingNewline) {
        if (buffer[position] === ControlChars.NewLine) {
          lineStart = ++position; // skip to next char
        }

        discardTrailingNewline = false;
      }

      // start looking forward till the end of line:
      let lineEnd = -1; // index of the \r or \n char
      for (; position < bufLength && lineEnd === -1; ++position) {
        switch (buffer[position]) {
          case ControlChars.Colon:
            if (fieldLength === -1) {
              // first colon in line
              fieldLength = position - lineStart;
            }
            break;
          // @ts-ignore:7029 \r case below should fallthrough to \n:
          case ControlChars.CarriageReturn:
            discardTrailingNewline = true;
          case ControlChars.NewLine:
            lineEnd = position;
            break;
        }
      }

      if (lineEnd === -1) {
        // We reached the end of the buffer but the line hasn't ended.
        // Wait for the next arr and then continue parsing:
        break;
      }

      // we've reached the line end, send it out:
      onLine(buffer.subarray(lineStart, lineEnd), fieldLength);
      lineStart = position; // we're now on the next line
      fieldLength = -1;
    }

    if (lineStart === bufLength) {
      buffer = undefined; // we've finished reading it
    } else if (lineStart !== 0) {
      // Create a new view into buffer beginning at lineStart so we don't
      // need to copy over the previous lines when we get the new arr:
      buffer = buffer.subarray(lineStart);
      position -= lineStart;
    }
  };
};

export let getMessages = (
  onId: (id: string) => void,
  onRetry: (retry: number) => void,
  onMessage?: (msg: EventSourceMessage) => void
) => {
  let message = newMessage();
  let decoder = new TextDecoder();

  // return a function that can process each incoming line buffer:
  return function onLine(line: Uint8Array, fieldLength: number) {
    if (line.length === 0) {
      // empty line denotes end of message. Trigger the callback and start a new message:
      onMessage?.(message);
      message = newMessage();
    } else if (fieldLength > 0) {
      // exclude comments and lines with no values
      // line is of format "<field>:<value>" or "<field>: <value>"
      // https://html.spec.whatwg.org/multipage/server-sent-events.html#event-stream-interpretation
      let field = decoder.decode(line.subarray(0, fieldLength));
      let valueOffset = fieldLength + (line[fieldLength + 1] === ControlChars.Space ? 2 : 1);
      let value = decoder.decode(line.subarray(valueOffset));

      switch (field) {
        case 'data':
          // if this message already has data, append the new value to the old.
          // otherwise, just set to the new value:
          message.data = message.data ? message.data + '\n' + value : value; // otherwise,
          break;
        case 'event':
          message.event = value;
          break;
        case 'id':
          onId((message.id = value));
          break;
        case 'retry':
          let retry = parseInt(value, 10);
          if (!isNaN(retry)) {
            // per spec, ignore non-integers
            onRetry((message.retry = retry));
          }
          break;
      }
    }
  };
};

let concat = (a: Uint8Array, b: Uint8Array) => {
  let res = new Uint8Array(a.length + b.length);
  res.set(a);
  res.set(b, a.length);
  return res;
};

let newMessage = (): EventSourceMessage => ({
  data: '',
  event: '',
  id: '',
  retry: undefined
});
