import type { ContentRole } from '@metorial/groundstation-spec';

let shapeVersion = 1;

let maxShapeStringLength = 64;
let maxShapeArgs = 32;
let maxShapePrograms = 32;
let maxShapeFlags = 64;
let maxShapePaths = 16;
let maxShellScanLength = 16 * 1024;

let shellTools = new Set([
  'bash',
  'shell',
  'run_shell_command',
  'exec',
  'exec_command',
  'local_shell'
]);

let pathKeys = new Set(['file_path', 'path', 'notebook_path', 'filepath', 'filename', 'file']);

let languages: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  py: 'python',
  rs: 'rust',
  go: 'go',
  java: 'java',
  kt: 'kotlin',
  rb: 'ruby',
  php: 'php',
  c: 'c',
  h: 'c',
  cc: 'cpp',
  cpp: 'cpp',
  hpp: 'cpp',
  cs: 'csharp',
  swift: 'swift',
  scala: 'scala',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  sql: 'sql',
  html: 'html',
  css: 'css',
  scss: 'css',
  md: 'markdown',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  prisma: 'prisma',
  proto: 'protobuf',
  tf: 'terraform'
};

export type ShapeHints = {
  tool?: string;
  input?: unknown;
  exitCode?: number;
  errorClass?: string;
  errorCode?: string;
  truncated?: boolean;
};

export type Shape = { v: number } & Record<string, unknown>;

let clip = (value: string) =>
  value.length > maxShapeStringLength ? value.slice(0, maxShapeStringLength) : value;

let countLines = (text: string) => {
  if (text.length == 0) return 0;

  let lines = 1;
  let index = text.indexOf('\n');

  while (index != -1) {
    lines++;
    index = text.indexOf('\n', index + 1);
  }

  return text.endsWith('\n') ? lines - 1 : lines;
};

let countOccurrences = (text: string, needle: string) => {
  let count = 0;
  let index = text.indexOf(needle);

  while (index != -1) {
    count++;
    index = text.indexOf(needle, index + needle.length);
  }

  return count;
};

let countUrls = (text: string) =>
  countOccurrences(text, 'http://') + countOccurrences(text, 'https://');

export let fileExtension = (path: string) => {
  let name = path.slice(path.lastIndexOf('/') + 1);
  let dot = name.lastIndexOf('.');

  if (dot <= 0 || dot == name.length - 1) return '';

  return name
    .slice(dot + 1)
    .toLowerCase()
    .slice(0, 16);
};

export let languageOf = (extension: string) => languages[extension] ?? null;

let pathShape = (path: string) => {
  let ext = fileExtension(path);
  let segments = path.split(/[\\/]+/).filter(Boolean);

  return {
    v: shapeVersion,
    ext,
    language: languageOf(ext),
    depth: segments.length,
    absolute: path.startsWith('/') || path.startsWith('\\') || /^[A-Za-z]:[\\/]/.test(path)
  };
};

export let shellShape = (command: string) => {
  let scanned =
    command.length > maxShellScanLength ? command.slice(0, maxShellScanLength) : command;

  let programs: string[] = [];
  let flags: string[] = [];

  let segmentStart = true;
  let quote: string | null = null;
  let quoted = false;
  let token = '';

  let flush = () => {
    let wasQuoted = quoted;
    quoted = false;

    if (token.length == 0) return;

    if (!wasQuoted && token.startsWith('-') && token.length > 1 && !segmentStart) {
      if (flags.length < maxShapeFlags) flags.push(clip(token.split('=')[0]!));
    } else if (segmentStart && !/^[A-Za-z_][A-Za-z0-9_]*=/.test(token)) {
      let name = token.slice(token.lastIndexOf('/') + 1);

      if (name == 'sudo' || name == 'env' || name == 'command' || name == 'time') {
        token = '';
        return;
      }

      if (name && programs.length < maxShapePrograms) programs.push(clip(name));
      segmentStart = false;
    }

    token = '';
  };

  for (let i = 0; i < scanned.length; i++) {
    let char = scanned[i]!;

    if (quote) {
      if (char == quote) quote = null;
      else token += char;

      continue;
    }

    if (char == '"' || char == "'") {
      quote = char;
      quoted = true;
      continue;
    }

    if (char == ' ' || char == '\t' || char == '\n') {
      flush();
      continue;
    }

    if (
      char == '&' &&
      (scanned[i - 1] == '>' || scanned[i - 1] == '<' || scanned[i + 1] == '>')
    ) {
      token += char;
      continue;
    }

    if (char == '|' || char == ';' || char == '&') {
      flush();
      segmentStart = true;
      continue;
    }

    token += char;
  }

  flush();

  return { programs, flags };
};

let typeOf = (value: unknown) => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';

  return typeof value;
};

let sizeOf = (value: unknown) => {
  if (typeof value == 'string') return value.length;
  if (Array.isArray(value)) return value.length;
  if (value && typeof value == 'object') return Object.keys(value).length;

  return 0;
};

let maxJsonInputLength = 256 * 1024;

let looksLikeJson = (text: string) => text.trimStart().startsWith('{');

let parseJsonObject = (text: string): Record<string, unknown> | null => {
  if (text.length > maxJsonInputLength || !looksLikeJson(text)) return null;

  try {
    let parsed: unknown = JSON.parse(text);

    return parsed && typeof parsed == 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

let toolInputShape = (hints: ShapeHints): Shape => {
  let shape: Shape = { v: shapeVersion, tool: clip(hints.tool ?? 'unknown'), args: [] };
  let input = hints.input;

  if (typeof input == 'string') {
    input = parseJsonObject(input) ?? input;
  }

  if (typeof input == 'string') {
    shape['args'] = [{ key: '_', type: 'string', size: input.length }];
    input = looksLikeJson(input) ? {} : { command: input };
  } else if (input && typeof input == 'object' && !Array.isArray(input)) {
    let args: { key: string; type: string; size: number }[] = [];

    for (let key of Object.keys(input).slice(0, maxShapeArgs)) {
      let value = (input as Record<string, unknown>)[key];
      args.push({ key: clip(key), type: typeOf(value), size: sizeOf(value) });
    }

    shape['args'] = args;
  }

  let record = input && typeof input == 'object' ? (input as Record<string, unknown>) : {};

  if (shellTools.has((hints.tool ?? '').toLowerCase())) {
    let command = record['command'] ?? record['cmd'];
    let text = Array.isArray(command) ? command.join(' ') : command;

    if (typeof text == 'string') Object.assign(shape, shellShape(text));
  }

  let paths: { ext: string; language: string | null }[] = [];

  for (let key of Object.keys(record)) {
    if (paths.length >= maxShapePaths) break;

    let value = record[key];

    if (pathKeys.has(key.toLowerCase()) && typeof value == 'string') {
      let ext = fileExtension(value);
      paths.push({ ext, language: languageOf(ext) });
    }
  }

  if (paths.length > 0) shape['paths'] = paths;

  return shape;
};

let diffShape = (text: string) => {
  let files = 0;
  let added = 0;
  let removed = 0;

  for (let line of text.split('\n')) {
    if (line.startsWith('+++ ')) files++;
    else if (line.startsWith('--- ')) continue;
    else if (line.startsWith('+')) added++;
    else if (line.startsWith('-')) removed++;
  }

  return { v: shapeVersion, files, added, removed };
};

export let computeShape = (
  role: ContentRole,
  text: string,
  hints: ShapeHints = {}
): Shape | undefined => {
  switch (role) {
    case 'prompt':
    case 'response':
      return {
        v: shapeVersion,
        lines: countLines(text),
        code_blocks: Math.floor(countOccurrences(text, '```') / 2),
        urls: countUrls(text)
      };

    case 'tool_input':
      return toolInputShape(hints);

    case 'tool_output': {
      let shape: Shape = {
        v: shapeVersion,
        lines: countLines(text),
        bytes: Buffer.byteLength(text),
        truncated: hints.truncated ?? false
      };

      if (hints.exitCode !== undefined) shape['exit_code'] = hints.exitCode;
      if (hints.errorClass) shape['error_class'] = clip(hints.errorClass);

      return shape;
    }

    case 'path':
      return pathShape(text);

    case 'error_message': {
      let shape: Shape = { v: shapeVersion, class: clip(hints.errorClass ?? 'unknown') };
      if (hints.errorCode) shape['code'] = clip(hints.errorCode);

      return shape;
    }

    case 'diff':
      return diffShape(text);

    default:
      return undefined;
  }
};
