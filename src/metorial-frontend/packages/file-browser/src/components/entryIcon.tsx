import { theme } from '@metorial/ui';
import {
  RiFile3Line,
  RiFileCodeLine,
  RiFileImageLine,
  RiFileTextLine,
  RiFileUnknowLine,
  RiFileZipLine,
  RiFolder2Line,
  RiFolderOpenLine,
  RiLinksLine
} from '@remixicon/react';
import styled from 'styled-components';
import { detectLanguage } from '../lib/language';
import { getImageMimeType } from '../lib/preview';
import { isDirectoryLike } from '../lib/sort';
import type { FileEntry } from '../types';

let archivePattern = /\.(zip|tar|tgz|gz|bz2|xz|7z|rar|zst)$/i;
let textLanguages = new Set(['plaintext', 'markdown', 'mdx', 'log', 'csv', 'tsv']);

let IconWrap = styled.span<{ $tone: 'directory' | 'file' | 'muted' }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  color: ${p =>
    p.$tone == 'directory'
      ? theme.colors.orange800
      : p.$tone == 'file'
        ? theme.colors.blue800
        : theme.colors.gray700};
`;

let SymlinkBadge = styled.span`
  position: relative;
  display: inline-flex;

  & > svg:last-child {
    position: absolute;
    right: -4px;
    bottom: -3px;
    padding: 1px;
    border-radius: 50%;
    background: ${theme.colors.background};
    color: ${theme.colors.gray700};
  }
`;

let getFileGlyph = (entry: Pick<FileEntry, 'path' | 'type'>, size: number) => {
  if (entry.type == 'other') return <RiFileUnknowLine size={size} />;
  if (getImageMimeType(entry.path)) return <RiFileImageLine size={size} />;
  if (archivePattern.test(entry.path)) return <RiFileZipLine size={size} />;

  let language = detectLanguage(entry.path);
  if (language.id == 'plaintext' && !entry.path.toLowerCase().endsWith('.txt')) {
    return <RiFile3Line size={size} />;
  }

  return textLanguages.has(language.id) ? (
    <RiFileTextLine size={size} />
  ) : (
    <RiFileCodeLine size={size} />
  );
};

export let EntryIcon = ({
  entry,
  open,
  size = 16
}: {
  entry: Pick<FileEntry, 'path' | 'type' | 'targetType'>;
  open?: boolean;
  size?: number;
}) => {
  let directory = isDirectoryLike(entry);

  let glyph = directory ? (
    open ? (
      <RiFolderOpenLine size={size} />
    ) : (
      <RiFolder2Line size={size} />
    )
  ) : (
    getFileGlyph(entry, size)
  );

  let tone: 'directory' | 'file' | 'muted' = directory
    ? 'directory'
    : entry.type == 'file'
      ? 'file'
      : 'muted';

  return (
    <IconWrap $tone={tone} aria-hidden>
      {entry.type == 'symlink' ? (
        <SymlinkBadge>
          {glyph}
          <RiLinksLine size={10} />
        </SymlinkBadge>
      ) : (
        glyph
      )}
    </IconWrap>
  );
};
