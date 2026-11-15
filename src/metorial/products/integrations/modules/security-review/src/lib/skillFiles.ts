import type { SecurityFileKind } from '@metorial-subspace/db';

export let HEAD_BYTES = 4096;
export let AGENT_TEXT_MAX_BYTES = 1024 * 1024;
export let DETECTOR_TEXT_MAX_BYTES = 5 * 1024 * 1024;

let TAR_MAGIC_OFFSET = 257;
let JAVA_CLASS_MIN_MAJOR = 45;

export type FileClassification = {
  kind: SecurityFileKind;
  detectedMime: string | null;
  extension: string | null;
  isDisguised: boolean;
};

type Signature = {
  bytes: number[];
  offset?: number;
  kind: SecurityFileKind;
  mime: string;
};

let ascii = (value: string) => [...value].map(char => char.charCodeAt(0));

let signatures: Signature[] = [
  {
    bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    kind: 'image',
    mime: 'image/png'
  },
  { bytes: [0xff, 0xd8, 0xff], kind: 'image', mime: 'image/jpeg' },
  { bytes: ascii('GIF87a'), kind: 'image', mime: 'image/gif' },
  { bytes: ascii('GIF89a'), kind: 'image', mime: 'image/gif' },
  { bytes: [0x00, 0x00, 0x01, 0x00], kind: 'image', mime: 'image/x-icon' },
  { bytes: [0x49, 0x49, 0x2a, 0x00], kind: 'image', mime: 'image/tiff' },
  { bytes: [0x4d, 0x4d, 0x00, 0x2a], kind: 'image', mime: 'image/tiff' },
  { bytes: ascii('%PDF-'), kind: 'pdf', mime: 'application/pdf' },
  { bytes: ascii('ID3'), kind: 'audio', mime: 'audio/mpeg' },
  { bytes: [0xff, 0xfb], kind: 'audio', mime: 'audio/mpeg' },
  { bytes: [0xff, 0xf3], kind: 'audio', mime: 'audio/mpeg' },
  { bytes: [0xff, 0xf2], kind: 'audio', mime: 'audio/mpeg' },
  { bytes: ascii('OggS'), kind: 'audio', mime: 'audio/ogg' },
  { bytes: ascii('fLaC'), kind: 'audio', mime: 'audio/flac' },
  { bytes: [0x1a, 0x45, 0xdf, 0xa3], kind: 'video', mime: 'video/webm' },
  { bytes: ascii('wOFF'), kind: 'font', mime: 'font/woff' },
  { bytes: ascii('wOF2'), kind: 'font', mime: 'font/woff2' },
  { bytes: ascii('OTTO'), kind: 'font', mime: 'font/otf' },
  { bytes: [0x00, 0x01, 0x00, 0x00], kind: 'font', mime: 'font/ttf' },
  { bytes: ascii('PK\u0003\u0004'), kind: 'archive', mime: 'application/zip' },
  { bytes: ascii('PK\u0005\u0006'), kind: 'archive', mime: 'application/zip' },
  { bytes: ascii('PK\u0007\u0008'), kind: 'archive', mime: 'application/zip' },
  { bytes: [0x1f, 0x8b], kind: 'archive', mime: 'application/gzip' },
  { bytes: ascii('BZh'), kind: 'archive', mime: 'application/x-bzip2' },
  { bytes: [0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00], kind: 'archive', mime: 'application/x-xz' },
  {
    bytes: [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c],
    kind: 'archive',
    mime: 'application/x-7z-compressed'
  },
  { bytes: ascii('Rar!\u001a\u0007'), kind: 'archive', mime: 'application/vnd.rar' },
  { bytes: [0x28, 0xb5, 0x2f, 0xfd], kind: 'archive', mime: 'application/zstd' },
  { bytes: ascii('MSCF'), kind: 'archive', mime: 'application/vnd.ms-cab-compressed' },
  { bytes: ascii('!<arch>\n'), kind: 'archive', mime: 'application/x-archive' },
  {
    bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
    kind: 'archive',
    mime: 'application/x-ole-storage'
  },
  {
    bytes: ascii('ustar'),
    offset: TAR_MAGIC_OFFSET,
    kind: 'archive',
    mime: 'application/x-tar'
  },
  { bytes: [0x7f, 0x45, 0x4c, 0x46], kind: 'executable', mime: 'application/x-elf' },
  { bytes: [0xfe, 0xed, 0xfa, 0xce], kind: 'executable', mime: 'application/x-mach-binary' },
  { bytes: [0xfe, 0xed, 0xfa, 0xcf], kind: 'executable', mime: 'application/x-mach-binary' },
  { bytes: [0xce, 0xfa, 0xed, 0xfe], kind: 'executable', mime: 'application/x-mach-binary' },
  { bytes: [0xcf, 0xfa, 0xed, 0xfe], kind: 'executable', mime: 'application/x-mach-binary' },
  {
    bytes: [0x4d, 0x5a],
    kind: 'executable',
    mime: 'application/vnd.microsoft.portable-executable'
  },
  { bytes: [0x00, 0x61, 0x73, 0x6d], kind: 'executable', mime: 'application/wasm' },
  { bytes: ascii('dex\n'), kind: 'executable', mime: 'application/vnd.android.dex' },
  {
    bytes: ascii('SQLite format 3\u0000'),
    kind: 'unknown_binary',
    mime: 'application/vnd.sqlite3'
  }
];

let matches = (head: Uint8Array, signature: Signature) => {
  let offset = signature.offset ?? 0;
  if (head.length < offset + signature.bytes.length) return false;
  return signature.bytes.every((byte, i) => head[offset + i] === byte);
};

let readUint32BigEndian = (head: Uint8Array, offset: number) =>
  ((head[offset]! << 24) |
    (head[offset + 1]! << 16) |
    (head[offset + 2]! << 8) |
    head[offset + 3]!) >>>
  0;

let isJavaClassOrFatMachO = (head: Uint8Array): FileClassification['kind'] | null => {
  if (head.length < 8) return null;
  if (readUint32BigEndian(head, 0) != 0xcafebabe) return null;
  return 'executable';
};

let javaClassMime = (head: Uint8Array) =>
  readUint32BigEndian(head, 4) >= JAVA_CLASS_MIN_MAJOR
    ? 'application/java-vm'
    : 'application/x-mach-binary';

let isPythonBytecode = (head: Uint8Array) => {
  if (head.length < 4 || head[2] !== 0x0d || head[3] !== 0x0a) return false;

  let magic = head[0]! | (head[1]! << 8);
  return (magic >= 3000 && magic <= 3999) || (magic >= 62000 && magic <= 62300);
};

let isoBaseMediaBrand = (head: Uint8Array) => {
  if (head.length < 12) return null;
  if (String.fromCharCode(...head.subarray(4, 8)) != 'ftyp') return null;
  return String.fromCharCode(...head.subarray(8, 12));
};

let isRiff = (head: Uint8Array, form: string) =>
  head.length >= 12 &&
  String.fromCharCode(...head.subarray(0, 4)) == 'RIFF' &&
  String.fromCharCode(...head.subarray(8, 12)) == form;

let sniffText = (head: Uint8Array) => {
  if (head.includes(0)) return false;

  try {
    new TextDecoder('utf-8', { fatal: true }).decode(head, { stream: true });
    return true;
  } catch {
    return false;
  }
};

let imageBrands = new Set(['avif', 'avis', 'heic', 'heix', 'mif1', 'msf1']);
let audioBrands = new Set(['M4A ', 'M4B ', 'F4A ']);

type BinaryMatch = { kind: SecurityFileKind; mime: string; weak?: boolean };

let detectBinary = (head: Uint8Array): BinaryMatch | null => {
  let classOrFat = isJavaClassOrFatMachO(head);
  if (classOrFat) return { kind: classOrFat, mime: javaClassMime(head) };

  if (isPythonBytecode(head)) return { kind: 'executable', mime: 'application/x-python-code' };

  let brand = isoBaseMediaBrand(head);
  if (brand) {
    if (imageBrands.has(brand)) return { kind: 'image', mime: 'image/avif' };
    if (audioBrands.has(brand)) return { kind: 'audio', mime: 'audio/mp4' };
    return { kind: 'video', mime: 'video/mp4' };
  }

  if (isRiff(head, 'WEBP')) return { kind: 'image', mime: 'image/webp' };
  if (isRiff(head, 'WAVE')) return { kind: 'audio', mime: 'audio/wav' };
  if (isRiff(head, 'AVI ')) return { kind: 'video', mime: 'video/x-msvideo' };

  let signature = signatures.find(candidate => matches(head, candidate));
  return signature
    ? { kind: signature.kind, mime: signature.mime, weak: signature.bytes.length < 4 }
    : null;
};

let extensionKinds: Record<string, SecurityFileKind> = {};

let registerExtensions = (kind: SecurityFileKind, extensions: string[]) => {
  for (let extension of extensions) extensionKinds[extension] = kind;
};

registerExtensions('image', [
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'bmp',
  'ico',
  'tif',
  'tiff',
  'avif',
  'heic'
]);
registerExtensions('pdf', ['pdf']);
registerExtensions('audio', ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac']);
registerExtensions('video', ['mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v']);
registerExtensions('font', ['ttf', 'otf', 'woff', 'woff2']);
registerExtensions('archive', [
  'zip',
  'gz',
  'tgz',
  'tar',
  '7z',
  'rar',
  'bz2',
  'xz',
  'zst',
  'jar',
  'war',
  'apk',
  'docx',
  'xlsx',
  'pptx',
  'doc',
  'xls',
  'ppt',
  'odt',
  'whl',
  'egg',
  'deb',
  'rpm'
]);
registerExtensions('executable', [
  'exe',
  'dll',
  'so',
  'dylib',
  'bin',
  'class',
  'wasm',
  'pyc',
  'pyo',
  'o',
  'a',
  'dex'
]);
registerExtensions('text', [
  'md',
  'markdown',
  'txt',
  'json',
  'yaml',
  'yml',
  'toml',
  'xml',
  'html',
  'css',
  'csv',
  'svg',
  'js',
  'mjs',
  'cjs',
  'ts',
  'tsx',
  'jsx',
  'py',
  'rb',
  'sh',
  'bash',
  'zsh',
  'ps1',
  'bat',
  'cmd',
  'go',
  'rs',
  'java',
  'c',
  'h',
  'cpp',
  'sql',
  'ini',
  'cfg',
  'env',
  'mdx',
  'rst',
  'adoc',
  'tex',
  'log',
  'lock',
  'tsv',
  'jsonl',
  'ndjson',
  'json5',
  'jsonc',
  'ipynb',
  'graphql',
  'gql',
  'proto',
  'tf',
  'hcl',
  'properties',
  'gradle',
  'plist',
  'xsd',
  'xsl',
  'scss',
  'sass',
  'less',
  'vue',
  'svelte',
  'astro',
  'mts',
  'cts',
  'php',
  'kt',
  'kts',
  'swift',
  'scala',
  'lua',
  'pl',
  'r',
  'cs',
  'cc',
  'cxx',
  'hpp',
  'hh',
  'm',
  'dart',
  'ex',
  'exs',
  'erl',
  'hs',
  'clj',
  'fish',
  'ps',
  'gitignore',
  'dockerignore',
  'editorconfig',
  'conf',
  'service',
  'diff',
  'patch'
]);

let textFileNames = new Set([
  'license',
  'licence',
  'readme',
  'notice',
  'authors',
  'contributors',
  'changelog',
  'copying',
  'makefile',
  'dockerfile',
  'procfile',
  'gemfile',
  'rakefile',
  'justfile',
  'codeowners'
]);

let mediaKinds = new Set<SecurityFileKind>(['image', 'pdf', 'audio', 'video', 'font']);
let dangerousKinds = new Set<SecurityFileKind>(['executable', 'archive', 'unknown_binary']);

export let fileExtension = (fileName: string) => {
  let base = fileName.split('/').pop() ?? fileName;
  let index = base.lastIndexOf('.');
  return index > 0 && index < base.length - 1 ? base.slice(index + 1).toLowerCase() : null;
};

export let expectedKindForExtension = (extension: string | null) =>
  extension ? (extensionKinds[extension] ?? null) : null;

let expectedKindForName = (fileName: string): SecurityFileKind | null => {
  let base = (fileName.split('/').pop() ?? fileName).toLowerCase();
  if (textFileNames.has(base)) return 'text';
  if (base.startsWith('.') && base.indexOf('.', 1) == -1) return 'text';
  return expectedKindForExtension(fileExtension(fileName));
};

export let classifyHead = (d: { head: Uint8Array; fileName: string }): FileClassification => {
  let extension = fileExtension(d.fileName);
  let expected = expectedKindForName(d.fileName);

  if (!d.head.length) {
    return { kind: 'empty', detectedMime: null, extension, isDisguised: false };
  }

  let binary = detectBinary(d.head);
  if (binary?.weak && sniffText(d.head)) binary = null;

  if (binary) {
    let isDisguised =
      dangerousKinds.has(binary.kind) &&
      expected !== null &&
      expected !== binary.kind &&
      (expected == 'text' || mediaKinds.has(expected));

    return { kind: binary.kind, detectedMime: binary.mime, extension, isDisguised };
  }

  if (sniffText(d.head)) {
    return { kind: 'text', detectedMime: null, extension, isDisguised: false };
  }

  return {
    kind: 'unknown_binary',
    detectedMime: null,
    extension,
    isDisguised: expected !== null && (expected == 'text' || mediaKinds.has(expected))
  };
};

export let classifyByExtensionOnly = (fileName: string): FileClassification => {
  let extension = fileExtension(fileName);
  let expected = expectedKindForName(fileName);

  return {
    kind: expected ?? 'unknown_binary',
    detectedMime: null,
    extension,
    isDisguised: false
  };
};

export let isBinaryKind = (kind: SecurityFileKind) => kind != 'text' && kind != 'empty';
