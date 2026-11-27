import { basename, extname } from './path';

export type CodeEditorLanguage = 'javascript' | 'json' | 'plain';

export interface FileLanguage {
  id: string;
  label: string;
  editor: CodeEditorLanguage;
}

let lang = (
  id: string,
  label: string,
  editor: CodeEditorLanguage = 'plain'
): FileLanguage => ({
  id,
  label,
  editor
});

let javascript = lang('javascript', 'JavaScript', 'javascript');
let typescript = lang('typescript', 'TypeScript', 'javascript');
let json = lang('json', 'JSON', 'json');
let shell = lang('shell', 'Shell');
let yaml = lang('yaml', 'YAML');
let plaintext = lang('plaintext', 'Plain Text');

let byExtension: Record<string, FileLanguage> = {
  '.js': javascript,
  '.mjs': javascript,
  '.cjs': javascript,
  '.jsx': lang('jsx', 'JSX', 'javascript'),
  '.ts': typescript,
  '.mts': typescript,
  '.cts': typescript,
  '.tsx': lang('tsx', 'TSX', 'javascript'),
  '.json': json,
  '.jsonc': json,
  '.json5': json,
  '.map': json,
  '.yaml': yaml,
  '.yml': yaml,
  '.toml': lang('toml', 'TOML'),
  '.ini': lang('ini', 'INI'),
  '.cfg': lang('ini', 'INI'),
  '.conf': lang('conf', 'Config'),
  '.xml': lang('xml', 'XML'),
  '.html': lang('html', 'HTML'),
  '.htm': lang('html', 'HTML'),
  '.css': lang('css', 'CSS'),
  '.scss': lang('scss', 'SCSS'),
  '.less': lang('less', 'Less'),
  '.md': lang('markdown', 'Markdown'),
  '.mdx': lang('mdx', 'MDX'),
  '.py': lang('python', 'Python'),
  '.rb': lang('ruby', 'Ruby'),
  '.rs': lang('rust', 'Rust'),
  '.go': lang('go', 'Go'),
  '.java': lang('java', 'Java'),
  '.kt': lang('kotlin', 'Kotlin'),
  '.swift': lang('swift', 'Swift'),
  '.c': lang('c', 'C'),
  '.h': lang('c', 'C'),
  '.cc': lang('cpp', 'C++'),
  '.cpp': lang('cpp', 'C++'),
  '.hpp': lang('cpp', 'C++'),
  '.cs': lang('csharp', 'C#'),
  '.php': lang('php', 'PHP'),
  '.lua': lang('lua', 'Lua'),
  '.sql': lang('sql', 'SQL'),
  '.graphql': lang('graphql', 'GraphQL'),
  '.gql': lang('graphql', 'GraphQL'),
  '.sh': shell,
  '.bash': shell,
  '.zsh': shell,
  '.fish': shell,
  '.env': lang('dotenv', 'Environment'),
  '.csv': lang('csv', 'CSV'),
  '.tsv': lang('tsv', 'TSV'),
  '.log': lang('log', 'Log'),
  '.txt': plaintext
};

let byFileName: Record<string, FileLanguage> = {
  dockerfile: lang('dockerfile', 'Dockerfile'),
  containerfile: lang('dockerfile', 'Dockerfile'),
  makefile: lang('makefile', 'Makefile'),
  gemfile: lang('ruby', 'Ruby'),
  procfile: lang('procfile', 'Procfile'),
  '.bashrc': shell,
  '.zshrc': shell,
  '.profile': shell,
  '.bash_profile': shell,
  '.gitignore': lang('ignore', 'Ignore File'),
  '.dockerignore': lang('ignore', 'Ignore File'),
  '.npmrc': lang('ini', 'INI'),
  '.editorconfig': lang('ini', 'INI')
};

export let detectLanguage = (path: string): FileLanguage => {
  let name = basename(path).toLowerCase();

  let named = byFileName[name];
  if (named) return named;

  if (name.startsWith('dockerfile.') || name.endsWith('.dockerfile'))
    return byFileName.dockerfile!;
  if (name == '.env' || name.startsWith('.env.')) return byExtension['.env']!;

  return byExtension[extname(path)] ?? plaintext;
};
