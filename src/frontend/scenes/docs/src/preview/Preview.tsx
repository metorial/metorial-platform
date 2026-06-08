import styled from 'styled-components';
import { IconCopy, IconDownload } from '../editor/icons';

let Wrap = styled.aside<{ $width?: number }>`
  display: flex;
  flex-direction: column;
  flex: ${({ $width }) => ($width ? `0 0 ${$width}px` : '1 1 0')};
  width: ${({ $width }) => ($width ? `${$width}px` : 'auto')};
  min-width: 360px;
  border-left: 1px solid ${({ theme }) => theme.color.border};
  background: ${({ theme }) => theme.color.bgAlt};
  min-height: 0;
`;

let Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 11px 16px;
  height: 47px;
  border-bottom: 1px solid ${({ theme }) => theme.color.border};
  background: ${({ theme }) => theme.color.bgAlt};
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: ${({ theme }) => theme.color.textMuted};
  flex-shrink: 0;
`;

let Title = styled.span`
  font-size: 11.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: ${({ theme }) => theme.color.textMuted};
`;

let Actions = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

let IconBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  background: transparent;
  color: ${({ theme }) => theme.color.textMuted};
  border-radius: ${({ theme }) => theme.size.radiusSm};
  cursor: pointer;
  transition: all ${({ theme }) => theme.motion.fast};

  &:hover {
    background: ${({ theme }) => theme.color.bgHover};
    color: ${({ theme }) => theme.color.text};
  }

  svg {
    width: 14px;
    height: 14px;
  }
`;

let Body = styled.div`
  flex: 1;
  overflow-y: auto;
  min-height: 0;
`;

let Source = styled.pre`
  margin: 0;
  padding: 32px 40px 30vh;
  font-family: ${({ theme }) => theme.font.mono};
  font-size: 13px;
  line-height: 1.7;
  color: ${({ theme }) => theme.color.text};
  white-space: pre-wrap;
  word-break: break-word;
  background: ${({ theme }) => theme.color.bgAlt};

  @media (max-width: 960px) {
    padding: 24px;
  }
`;

interface Props {
  markdown: string;
  width?: number;
  onCopy: () => void;
  onDownload: () => void;
}

export function Preview({ markdown, width, onCopy, onDownload }: Props) {
  return (
    <Wrap $width={width}>
      <Header>
        <Title>Markdown</Title>
        <Actions>
          <IconBtn type="button" onClick={onCopy} title="Copy markdown">
            <IconCopy />
          </IconBtn>
          <IconBtn type="button" onClick={onDownload} title="Download .md">
            <IconDownload />
          </IconBtn>
        </Actions>
      </Header>
      <Body>
        <Source>{markdown}</Source>
      </Body>
    </Wrap>
  );
}
