import { theme } from '@metorial/ui';
import { RiFileCodeLine, RiLinkM, RiToolsLine } from '@remixicon/react';
import React from 'react';
import { styled } from 'styled-components';

export type EvidenceRef =
  | { type: 'file'; path: string; lines: number[] | null }
  | { type: 'url'; url: string }
  | { type: 'tool'; toolKey: string };

let List = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid ${theme.colors.gray300};
  border-radius: 6px;
  overflow: hidden;
`;

let Item = styled.li`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  font-size: 12px;
  color: ${theme.colors.gray800};
  background: ${theme.colors.gray100};
  min-width: 0;

  & + & {
    border-top: 1px solid ${theme.colors.gray300};
  }

  svg {
    flex-shrink: 0;
    color: ${theme.colors.gray600};
  }

  a {
    color: inherit;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
`;

let Mono = styled.span`
  font-family: 'JetBrains Mono', 'SFMono-Regular', Menlo, monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
`;

let Kind = styled.span`
  margin-left: auto;
  flex-shrink: 0;
  font-size: 11px;
  color: ${theme.colors.gray600};
`;

let formatLines = (lines: number[] | null) => {
  if (!lines?.length) return '';
  if (lines.length == 1 || lines[0] == lines[1]) return `:${lines[0]}`;
  return `:${lines[0]}-${lines[1]}`;
};

let stripProtocol = (url: string) => url.replace(/^https?:\/\//, '');

export let EvidenceList = ({ evidence }: { evidence: EvidenceRef[] }) => {
  if (!evidence.length) return null;

  return (
    <List>
      {evidence.map((ref, i) => {
        if (ref.type == 'file') {
          return (
            <Item key={i}>
              <RiFileCodeLine size={14} />
              <Mono>
                {ref.path}
                {formatLines(ref.lines)}
              </Mono>
              <Kind>Source</Kind>
            </Item>
          );
        }

        if (ref.type == 'url') {
          return (
            <Item key={i}>
              <RiLinkM size={14} />
              <Mono>
                <a href={ref.url} target="_blank" rel="noreferrer noopener">
                  {stripProtocol(ref.url)}
                </a>
              </Mono>
              <Kind>Web page</Kind>
            </Item>
          );
        }

        return (
          <Item key={i}>
            <RiToolsLine size={14} />
            <Mono>{ref.toolKey}</Mono>
            <Kind>Tool</Kind>
          </Item>
        );
      })}
    </List>
  );
};
