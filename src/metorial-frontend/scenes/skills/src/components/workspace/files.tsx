import {
  RiBracesLine,
  RiFileCodeLine,
  RiFileLine,
  RiFilePdf2Line,
  RiFileTextLine,
  RiFolderLine,
  RiImageLine,
  RiRobot2Line,
  RiTableLine
} from '@remixicon/react';

export type WorkspaceStoreItem = {
  id: string;
  kind: 'file' | 'document' | 'directory';
  path: string;
  document?: { id: string } | null;
  file?: { fileType: string } | null;
};

export type WorkspaceFileEntry = {
  id: string;
  name: string;
  path: string;
  kind: 'document' | 'file' | 'directory' | 'agent';
  depth: number;
  href: string | null;
  isMain?: boolean;
};

let codeExtensions = new Set([
  'sh',
  'bash',
  'zsh',
  'py',
  'js',
  'jsx',
  'ts',
  'tsx',
  'rb',
  'go',
  'rs',
  'java',
  'kt',
  'swift',
  'c',
  'h',
  'cpp',
  'cs',
  'php',
  'sql',
  'html',
  'css'
]);
let dataExtensions = new Set(['json', 'yaml', 'yml', 'toml', 'xml', 'ini', 'env']);
let imageExtensions = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'svg',
  'avif',
  'bmp',
  'ico'
]);

export let getExtension = (name: string) => {
  let index = name.lastIndexOf('.');
  return index > 0 ? name.slice(index + 1).toLowerCase() : '';
};

export let normalizeStorePath = (path: string) => path.replace(/^\/+|\/+$/g, '');

export let isSkillDocumentPath = (path: string) =>
  normalizeStorePath(path).toLowerCase() == 'skill.md';

export let WorkspaceFileIcon = (p: {
  kind: WorkspaceFileEntry['kind'];
  name: string;
  size?: number;
}) => {
  let size = p.size ?? 15;
  if (p.kind == 'directory') return <RiFolderLine size={size} />;
  if (p.kind == 'agent') return <RiRobot2Line size={size} />;
  if (p.kind == 'document') return <RiFileTextLine size={size} />;

  let extension = getExtension(p.name);
  if (extension == 'csv' || extension == 'tsv') return <RiTableLine size={size} />;
  if (extension == 'pdf') return <RiFilePdf2Line size={size} />;
  if (imageExtensions.has(extension)) return <RiImageLine size={size} />;
  if (dataExtensions.has(extension)) return <RiBracesLine size={size} />;
  if (codeExtensions.has(extension)) return <RiFileCodeLine size={size} />;
  if (extension == 'md' || extension == 'txt') return <RiFileTextLine size={size} />;
  return <RiFileLine size={size} />;
};

export let buildFileEntries = (
  items: WorkspaceStoreItem[],
  getHref: (documentId: string, itemId: string) => string
): WorkspaceFileEntry[] => {
  let entries = items
    .map(item => ({ item, path: normalizeStorePath(item.path) }))
    .filter(entry => entry.path);

  let known = new Set(entries.map(entry => entry.path));
  let implicitDirectories = new Map<string, WorkspaceFileEntry>();

  for (let entry of entries) {
    let parts = entry.path.split('/');
    for (let i = 1; i < parts.length; i++) {
      let dir = parts.slice(0, i).join('/');
      if (known.has(dir) || implicitDirectories.has(dir)) continue;
      implicitDirectories.set(dir, {
        id: `dir:${dir}`,
        name: parts[i - 1]!,
        path: dir,
        kind: 'directory',
        depth: i - 1,
        href: null
      });
    }
  }

  let all: WorkspaceFileEntry[] = [
    ...implicitDirectories.values(),
    ...entries.map(({ item, path }) => {
      let parts = path.split('/');
      return {
        id: item.id,
        name: parts[parts.length - 1]!,
        path,
        kind: item.kind,
        depth: parts.length - 1,
        href: item.kind == 'directory' ? null : getHref(item.document?.id ?? '', item.id),
        isMain: isSkillDocumentPath(path)
      } satisfies WorkspaceFileEntry;
    })
  ];

  let sortKey = (entry: WorkspaceFileEntry) =>
    entry.path
      .split('/')
      .map((part, index, parts) => {
        let isLeaf = index == parts.length - 1;
        let isDir = !isLeaf || entry.kind == 'directory';
        return `${isDir ? '1' : '2'}${part.toLowerCase()}`;
      })
      .join('/');

  return all.sort((a, b) => {
    if (a.isMain) return -1;
    if (b.isMain) return 1;
    return sortKey(a).localeCompare(sortKey(b));
  });
};
