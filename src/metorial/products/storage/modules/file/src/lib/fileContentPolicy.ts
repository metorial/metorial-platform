export let maxBufferedFileSize = 1024 * 1024;

export let textFileExtensions = new Set([
  'c',
  'cjs',
  'cpp',
  'cs',
  'csv',
  'css',
  'scss',
  'less',
  'env',
  'go',
  'graphql',
  'h',
  'html',
  'htm',
  'java',
  'js',
  'json',
  'jsx',
  'log',
  'md',
  'mdx',
  'mjs',
  'php',
  'py',
  'rb',
  'rs',
  'sh',
  'bash',
  'zsh',
  'sql',
  'swift',
  'toml',
  'ts',
  'tsx',
  'txt',
  'xml',
  'yaml',
  'yml'
]);

let getFileExtension = (fileName: string) =>
  fileName.split('.').pop()?.trim().toLowerCase() ?? '';

export let isBufferableTextFile = (d: { fileName: string; size: number }) =>
  d.size < maxBufferedFileSize && textFileExtensions.has(getFileExtension(d.fileName));
