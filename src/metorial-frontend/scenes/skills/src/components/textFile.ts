let textExtensions = new Set([
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

export let getSkillFileExtension = (fileName: string) =>
  fileName.split('.').pop()?.toLowerCase() ?? '';

export let isSkillTextFile = (file: {
  fileName?: string | null;
  fileType?: string | null;
}) => {
  let extension = getSkillFileExtension(file.fileName ?? '');
  let fileType = file.fileType?.toLowerCase() ?? '';

  return (
    fileType.startsWith('text/') ||
    fileType.includes('json') ||
    fileType.includes('xml') ||
    textExtensions.has(extension)
  );
};

export type SkillFileKind = 'code' | 'table' | 'image' | 'pdf' | 'video' | 'audio' | 'binary';

let imageExtensions = new Set(['avif', 'gif', 'jpeg', 'jpg', 'png', 'svg', 'webp']);
let videoExtensions = new Set(['mp4', 'mov', 'm4v', 'webm', 'ogv']);
let audioExtensions = new Set(['aac', 'flac', 'm4a', 'mp3', 'oga', 'ogg', 'wav', 'weba']);

export let getSkillFileKind = (file: {
  fileName?: string | null;
  fileType?: string | null;
}): SkillFileKind => {
  let extension = getSkillFileExtension(file.fileName ?? '');
  let fileType = file.fileType?.toLowerCase() ?? '';

  if (extension == 'csv' || fileType == 'text/csv') return 'table';
  if (fileType.startsWith('image/') || imageExtensions.has(extension)) return 'image';
  if (fileType == 'application/pdf' || extension == 'pdf') return 'pdf';
  if (fileType.startsWith('video/') || videoExtensions.has(extension)) return 'video';
  if (fileType.startsWith('audio/') || audioExtensions.has(extension)) return 'audio';
  if (isSkillTextFile(file)) return 'code';
  return 'binary';
};

export let formatSkillFileSize = (bytes: number | null | undefined) => {
  if (bytes == null || !Number.isFinite(bytes)) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export let getSkillCodeEditorLanguage = (fileName: string) => {
  let extension = getSkillFileExtension(fileName);

  if (extension == 'ts' || extension == 'tsx') return 'typescript';
  if (extension == 'js' || extension == 'jsx' || extension == 'mjs' || extension == 'cjs') {
    return 'javascript';
  }
  if (extension == 'json') return 'json';
  if (extension == 'css' || extension == 'scss' || extension == 'less') return 'css';
  if (extension == 'html' || extension == 'htm') return 'html';
  if (extension == 'md' || extension == 'mdx') return 'markdown';
  if (extension == 'py') return 'python';
  if (extension == 'rs') return 'rust';
  if (extension == 'sh' || extension == 'bash' || extension == 'zsh') return 'shell';
  if (extension == 'sql') return 'sql';
  if (extension == 'xml') return 'xml';
  if (extension == 'yaml' || extension == 'yml') return 'yaml';
  return 'plaintext';
};
