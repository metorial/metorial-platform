export let skillStandardDirectories = ['scripts', 'references', 'assets'];

export let skillStandardFiles = ['SKILL.md'];

export let isAllowedSkillPath = (path: string) => {
  let normalizedPath = path.replace(/^\/+/, '');
  if (skillStandardFiles.includes(normalizedPath)) return true;
  return skillStandardDirectories.some(dir => normalizedPath.startsWith(`${dir}/`));
};

export let safeNonScriptFileExtensions = [
  'txt',
  'md',
  'markdown',
  'csv',
  'tsv',
  'json',
  'jsonl',
  'xml',
  'yaml',
  'yml',
  'toml',
  'ini',
  'log',
  'pdf',
  'docx',
  'xlsx',
  'pptx',
  'odt',
  'ods',
  'odp',
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'svg',
  'mp3',
  'wav',
  'mp4',
  'mov',
  'zip',
  'tar',
  'gz'
];

export let scriptsFolder = 'scripts';
