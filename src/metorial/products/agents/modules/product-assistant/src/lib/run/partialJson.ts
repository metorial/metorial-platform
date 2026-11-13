type Frame = {
  type: 'object' | 'array';
  expectKey: boolean;
  keyStart: number | null;
};

let tryParse = (text: string) => {
  try {
    return { ok: true as const, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false as const };
  }
};

let closeFrames = (text: string, frames: Frame[]) => {
  let closing = frames
    .slice()
    .reverse()
    .map(frame => (frame.type == 'object' ? '}' : ']'))
    .join('');

  return text + closing;
};

let stripDanglingSyntax = (text: string, frames: Frame[]) => {
  let result = text.trimEnd();

  while (result.endsWith(',')) result = result.slice(0, -1).trimEnd();

  let frame = frames[frames.length - 1];
  if (frame?.type == 'object' && frame.keyStart !== null && !frame.expectKey) {
    let afterKey = result.slice(frame.keyStart);
    if (/^"(?:[^"\\]|\\.)*"\s*:?\s*$/.test(afterKey)) {
      result = result.slice(0, frame.keyStart).trimEnd();
      while (result.endsWith(',')) result = result.slice(0, -1).trimEnd();
    }
  }

  return result;
};

let closeOpenString = (text: string) => {
  let result = text;

  let unicodeEscape = result.match(/\\u[0-9a-fA-F]{0,3}$/);
  if (unicodeEscape) result = result.slice(0, -unicodeEscape[0].length);

  let trailingBackslashes = result.match(/\\+$/)?.[0].length ?? 0;
  if (trailingBackslashes % 2 == 1) result = result.slice(0, -1);

  return result + '"';
};

export let parsePartialJson = (text: string): unknown => {
  let complete = tryParse(text);
  if (complete.ok) return complete.value;

  let frames: Frame[] = [];
  let inString = false;
  let escaped = false;
  let stringStart = -1;
  let stringIsKey = false;
  let lastBoundary = 0;
  let boundaryFrames: Frame[] = [];

  for (let i = 0; i < text.length; i++) {
    let char = text[i]!;

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char == '\\') {
        escaped = true;
      } else if (char == '"') {
        inString = false;
        if (!stringIsKey) {
          lastBoundary = i + 1;
          boundaryFrames = frames.map(frame => ({ ...frame }));
        }
      }
      continue;
    }

    let frame = frames[frames.length - 1];

    if (char == '"') {
      inString = true;
      stringStart = i;
      stringIsKey = frame?.type == 'object' && frame.expectKey;
      if (stringIsKey && frame) {
        frame.keyStart = i;
        frame.expectKey = false;
      }
      continue;
    }

    if (char == '{' || char == '[') {
      frames.push({
        type: char == '{' ? 'object' : 'array',
        expectKey: char == '{',
        keyStart: null
      });
      lastBoundary = i + 1;
      boundaryFrames = frames.map(frame => ({ ...frame }));
      continue;
    }

    if (char == '}' || char == ']') {
      frames.pop();
      lastBoundary = i + 1;
      boundaryFrames = frames.map(frame => ({ ...frame }));
      continue;
    }

    if (char == ',') {
      if (frame?.type == 'object') {
        frame.expectKey = true;
        frame.keyStart = null;
      }
      lastBoundary = i;
      boundaryFrames = frames.map(frame => ({ ...frame }));
    }
  }

  if (inString) {
    if (stringIsKey) {
      let truncated = stripDanglingSyntax(text.slice(0, stringStart), frames);
      let closed = tryParse(closeFrames(truncated, frames));
      if (closed.ok) return closed.value;
    } else {
      let closed = tryParse(closeFrames(closeOpenString(text), frames));
      if (closed.ok) return closed.value;
    }
  } else {
    let trimmed = stripDanglingSyntax(text, frames);
    let closed = tryParse(closeFrames(trimmed, frames));
    if (closed.ok) return closed.value;
  }

  let fallback = stripDanglingSyntax(text.slice(0, lastBoundary), boundaryFrames);
  let closed = tryParse(closeFrames(fallback, boundaryFrames));
  return closed.ok ? closed.value : undefined;
};
