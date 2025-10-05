import { theme } from '@metorial/ui';
import MarkdownInner from 'react-markdown';
import styled from 'styled-components';

let Wrapper = styled.div`
  p {
    font-size: var(--font-size);
    line-height: 1.4;
    margin-bottom: 16px;

    &:last-child {
      margin-bottom: 0;
    }
  }

  a {
    color: ${theme.colors.primary};
    text-decoration: underline;
  }

  pre {
    background: ${theme.colors.gray400};
    padding: 16px;
    border-radius: 8px;
    overflow-x: auto;
    margin-bottom: 16px;
  }

  code {
    font-family: 'Source Code Pro', monospace;
    background: ${theme.colors.gray400};
    padding: 2px 4px;
    border-radius: 4px;
  }

  h1 {
    font-size: calc(var(--font-size) * 1.5);
    margin-bottom: calc(var(--font-size) * 0.75);
    margin-top: calc(var(--font-size) * 1.5);
  }

  h2 {
    font-size: calc(var(--font-size) * 1.25);
    margin-bottom: calc(var(--font-size) * 0.75);
    margin-top: calc(var(--font-size) * 1.25);
  }

  h3 {
    font-size: calc(var(--font-size) * 1.1);
    margin-bottom: calc(var(--font-size) * 0.5);
    margin-top: calc(var(--font-size) * 1);
  }

  ul {
    padding-left: 20px;
    margin-bottom: 16px;
    list-style-type: disc;
  }

  ol {
    padding-left: 20px;
    margin-bottom: 16px;
    list-style-type: decimal;
  }

  blockquote {
    border-left: 4px solid ${theme.colors.gray600};
    padding-left: 16px;
    color: ${theme.colors.gray700};
    margin-bottom: 16px;
    font-style: italic;
    background: ${theme.colors.gray100};
    padding: 8px 16px;
  }
`;

export let Markdown = (p: { children: string | null | undefined }) => {
  if (!p.children) return null;

  return (
    <Wrapper>
      <MarkdownInner>{p.children}</MarkdownInner>
    </Wrapper>
  );
};
