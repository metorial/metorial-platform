import { BINARY_BASE64_MIN_CHARS, MAX_DEPTH, MAX_SEGMENTS } from './budget';
import type { PathPart, ScanDirection, ScanPayload, Segment } from './types';

export let OBJECT_KEY_PATH_MARKER = '$key';

let OBJECT_KEY_MIN_SCAN_CHARS = 32;

let BINARY_CONTENT_TYPES = new Set(['image', 'audio', 'video']);

let BASE64_ONLY = /^[A-Za-z0-9+/=_\-\r\n]+$/;
let DATA_URI_PREFIX = /^data:[^,]{0,200};base64,/i;

interface Frame {
  container: unknown[] | Record<string, unknown>;
  keys: string[] | null;
  index: number;
  path: PathPart[];
  contentType: string | null;
}

export interface SegmentWalkStats {
  segmentCount: number;
  isTruncated: boolean;
}

export type WalkedSegment = Omit<Segment, 'globalOffset'>;

let classify = (d: {
  key: string | null;
  value: string;
  parentContentType: string | null;
}) => {
  if (d.key == 'blob') return 'binary' as const;
  if (
    d.key == 'data' &&
    d.parentContentType &&
    BINARY_CONTENT_TYPES.has(d.parentContentType)
  ) {
    return 'binary' as const;
  }
  if (DATA_URI_PREFIX.test(d.value.slice(0, 256))) return 'binary' as const;
  if (d.value.length >= BINARY_BASE64_MIN_CHARS && BASE64_ONLY.test(d.value)) {
    return 'binary' as const;
  }

  return 'text' as const;
};

let getContentType = (value: Record<string, unknown>) =>
  typeof value.type == 'string' ? value.type : null;

let toFrame = (value: object, path: PathPart[]): Frame =>
  Array.isArray(value)
    ? { container: value, keys: null, index: 0, path, contentType: null }
    : {
        container: value as Record<string, unknown>,
        keys: Object.keys(value),
        index: 0,
        path,
        contentType: getContentType(value as Record<string, unknown>)
      };

// Iterative with one frame per container, so neither deep nesting nor arrays with millions of
// elements allocate more than the current path. Cycle-safe because in-memory payloads are not
// guaranteed to be plain JSON.
export function* walkSegments(
  payload: ScanPayload,
  stats: SegmentWalkStats = { segmentCount: 0, isTruncated: false }
): Generator<WalkedSegment> {
  let roots: [ScanDirection, unknown][] = [
    ['input', payload.input],
    ['output', payload.output],
    ['tool_definition', payload.toolDefinition]
  ];

  for (let [direction, root] of roots) {
    let rootPath: PathPart[] = [{ type: 'key', key: direction }];

    if (typeof root == 'string') {
      if (!root.length) continue;

      stats.segmentCount++;
      yield {
        direction,
        path: rootPath,
        value: root,
        kind: classify({ key: null, value: root, parentContentType: null })
      };
      continue;
    }

    if (typeof root != 'object' || root === null) continue;

    let seen = new WeakSet<object>([root]);
    let frames: Frame[] = [toFrame(root, rootPath)];

    while (frames.length) {
      let frame = frames[frames.length - 1]!;
      let length = frame.keys ? frame.keys.length : (frame.container as unknown[]).length;

      if (frame.index >= length) {
        frames.pop();
        continue;
      }

      let index = frame.index++;
      let key = frame.keys ? frame.keys[index]! : null;
      let value =
        key === null
          ? (frame.container as unknown[])[index]
          : (frame.container as Record<string, unknown>)[key];

      let part: PathPart = key === null ? { type: 'index', index } : { type: 'key', key };
      let path = [...frame.path, part];

      if (stats.segmentCount >= MAX_SEGMENTS) {
        stats.isTruncated = true;
        return;
      }

      if (key !== null && key.length >= OBJECT_KEY_MIN_SCAN_CHARS) {
        stats.segmentCount++;
        yield {
          direction,
          path: [...frame.path, { type: 'key', key: OBJECT_KEY_PATH_MARKER }],
          value: key,
          kind: 'text'
        };
      }

      if (typeof value == 'string') {
        if (!value.length) continue;

        stats.segmentCount++;
        yield {
          direction,
          path,
          value,
          kind: classify({ key, value, parentContentType: frame.contentType })
        };
        continue;
      }

      if (typeof value != 'object' || value === null) continue;
      if (seen.has(value)) continue;

      if (frames.length >= MAX_DEPTH) {
        stats.isTruncated = true;
        continue;
      }

      seen.add(value);
      frames.push(toFrame(value, path));
    }
  }
}

export let measurePayloadChars = (payload: ScanPayload) => {
  let total = 0;
  for (let segment of walkSegments(payload)) total += segment.value.length;

  return total;
};

export let formatPath = (path: PathPart[], keyTransform: (key: string) => string = k => k) =>
  path
    .map((part, index) => {
      if (part.type == 'index') return `[${part.index}]`;
      let key = keyTransform(part.key);
      return index == 0 ? key : `.${key}`;
    })
    .join('');
