let textExtensions = new Set([
  'c',
  'cjs',
  'cpp',
  'cs',
  'csv',
  'css',
  'env',
  'go',
  'graphql',
  'h',
  'html',
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

export let getSkillCodeEditorLanguage = (fileName: string) => {
  let extension = getSkillFileExtension(fileName);

  if (extension == 'ts' || extension == 'tsx') return 'typescript';
  if (extension == 'js' || extension == 'jsx' || extension == 'mjs' || extension == 'cjs') {
    return 'javascript';
  }
  if (extension == 'json') return 'json';
  if (extension == 'css') return 'css';
  if (extension == 'html') return 'html';
  if (extension == 'md' || extension == 'mdx') return 'markdown';
  if (extension == 'py') return 'python';
  if (extension == 'rs') return 'rust';
  if (extension == 'sh') return 'shell';
  if (extension == 'sql') return 'sql';
  if (extension == 'xml') return 'xml';
  if (extension == 'yaml' || extension == 'yml') return 'yaml';
  return 'plaintext';
};
