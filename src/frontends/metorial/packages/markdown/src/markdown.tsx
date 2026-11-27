import { theme } from '@metorial/ui';
import MarkdownInner from 'react-markdown';
import styled from 'styled-components';

let Wrapper = styled.div`
  font-size: 14px;

  & > p:first-child,
  ol:first-child,
  ul:first-child {
    margin-top: 0;
  }

  & > p:last-child,
  ol:last-child,
  ul:last-child {
    margin-bottom: 0;
  }

  p {
    font-size: var(--font-size);
    line-height: 1.4;
    margin: 0 0 10px 0;
  }

  p:last-child {
    margin-bottom: 0;
  }

  a {
    color: ${theme.colors.primary};
    text-decoration: underline;
  }

  pre {
    background: ${theme.colors.gray300};
    padding: 16px;
    border-radius: 8px;
    overflow-x: auto;
    margin: 0 0 10px 0;
    font-family: 'Source Code Pro', monospace;

    code {
      background: none;
      padding: 0;
      border-radius: 0;
      font-size: 12px;
    }
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
    margin: 0 0 10px 0;
    list-style-type: disc;

    li:not(:last-child) {
      margin-bottom: 5px;
    }
  }

  ol {
    padding-left: 20px;
    margin: 0 0 10px 0;
    list-style-type: decimal;

    li:not(:last-child) {
      margin-bottom: 5px;
    }
  }

  blockquote {
    border-left: 4px solid ${theme.colors.gray600};
    padding-left: 16px;
    color: ${theme.colors.gray700};
    margin: 0 0 10px 0;
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
