import {
  RiFile3Line,
  RiFileCodeLine,
  RiFileImageLine,
  RiFileTextLine,
  RiFileZipLine
} from '@remixicon/react';

let archiveSuffixes = ['.zip', '.tar', '.tar.gz', '.tgz', '.gz', '.bz2', '.xz', '.7z', '.rar'];
let imageSuffixes = [
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.svg',
  '.avif',
  '.ico',
  '.bmp'
];
let textSuffixes = ['.txt', '.md', '.log', '.csv', '.tsv'];
let codeSuffixes = [
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.json',
  '.yaml',
  '.yml',
  '.toml',
  '.py',
  '.rs',
  '.go',
  '.sh',
  '.html',
  '.css',
  'dockerfile'
];

let endsWithAny = (name: string, suffixes: string[]) => suffixes.some(s => name.endsWith(s));

export let getUploadFileIcon = (name: string, size = 16) => {
  let lower = name.toLowerCase();

  if (endsWithAny(lower, archiveSuffixes)) return <RiFileZipLine size={size} />;
  if (endsWithAny(lower, imageSuffixes)) return <RiFileImageLine size={size} />;
  if (endsWithAny(lower, codeSuffixes)) return <RiFileCodeLine size={size} />;
  if (endsWithAny(lower, textSuffixes)) return <RiFileTextLine size={size} />;

  return <RiFile3Line size={size} />;
};
