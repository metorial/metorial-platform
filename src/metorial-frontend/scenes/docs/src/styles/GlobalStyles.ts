import { createGlobalStyle } from 'styled-components';

export let GlobalStyles = createGlobalStyle`
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  html,
  body,
  #root {
    height: 100%;
  }

  html {
    -webkit-text-size-adjust: 100%;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  body {
    margin: 0;
    font-family: ${({ theme }) => theme.font.sans};
    color: ${({ theme }) => theme.color.text};
    line-height: 1.6;
    transition: color ${({ theme }) => theme.motion.base};
  }

  ::selection {
    background: ${({ theme }) => theme.color.selection};
  }

  button {
    font-family: inherit;
    color: inherit;
  }

  /* Scrollbars */
  ::-webkit-scrollbar {
    width: 10px;
    height: 10px;
  }
  ::-webkit-scrollbar-track {
    background: transparent;
  }
  ::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.color.border};
    border-radius: 8px;
    border: 2px solid transparent;
    background-clip: padding-box;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: ${({ theme }) => theme.color.borderStrong};
    background-clip: padding-box;
    border: 2px solid transparent;
  }

  /* Lowlight / hljs token colors that match the editor theme */
  .hljs-comment,
  .hljs-quote {
    color: ${({ theme }) => theme.color.textMuted};
    font-style: italic;
  }
  .hljs-keyword,
  .hljs-selector-tag,
  .hljs-built_in,
  .hljs-name,
  .hljs-tag {
    color: #cc7832;
  }
  .hljs-string,
  .hljs-title,
  .hljs-section,
  .hljs-attribute,
  .hljs-literal,
  .hljs-template-tag,
  .hljs-template-variable,
  .hljs-type,
  .hljs-addition {
    color: #6a8759;
  }
  .hljs-deletion,
  .hljs-selector-attr,
  .hljs-selector-pseudo,
  .hljs-meta {
    color: #ffc66d;
  }
  .hljs-doctag {
    color: ${({ theme }) => theme.color.textMuted};
  }
  .hljs-attr {
    color: #9876aa;
  }
  .hljs-symbol,
  .hljs-bullet,
  .hljs-link {
    color: #6897bb;
  }
  .hljs-emphasis {
    font-style: italic;
  }
  .hljs-strong {
    font-weight: bold;
  }
  .hljs-number {
    color: #6897bb;
  }

`;
