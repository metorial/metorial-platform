import { createGlobalStyle } from 'styled-components';
import { menuEnter, menuExit } from '../editor/animations';

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

  /* Code block language picker (rendered via portal) */
  .code-block-lang-popover {
    position: fixed;
    z-index: 1000;
    width: 240px;
    max-height: 320px;
    display: flex;
    flex-direction: column;
    background: ${({ theme }) => theme.color.bg};
    border: 1px solid ${({ theme }) => theme.color.border};
    border-radius: 12px;
    box-shadow: 0 8px 24px ${({ theme }) => theme.color.shadow};
    overflow: hidden;
    font-family: ${({ theme }) => theme.font.sans};
    transform-origin: top left;
  }

  .code-block-lang-popover[data-state='open'] {
    ${menuEnter(160)}
  }

  .code-block-lang-popover[data-state='closed'] {
    ${menuExit(140)}
    pointer-events: none;
  }

  .code-block-lang-search {
    padding: 8px 10px;
    margin: 6px;
    border: 1px solid ${({ theme }) => theme.color.border};
    border-radius: 6px;
    background: ${({ theme }) => theme.color.bgAlt};
    color: ${({ theme }) => theme.color.text};
    font-size: 13px;
    outline: none;

    &:focus {
      border-color: ${({ theme }) => theme.color.accent};
    }

    &::placeholder {
      color: ${({ theme }) => theme.color.textSubtle};
    }
  }

  .code-block-lang-list {
    list-style: none;
    margin: 0;
    padding: 4px;
    overflow-y: auto;
    flex: 1;
  }

  .code-block-lang-item {
    padding: 6px 10px;
    border-radius: 5px;
    font-family: ${({ theme }) => theme.font.mono};
    font-size: 13px;
    color: ${({ theme }) => theme.color.text};
    cursor: pointer;
    user-select: none;

    &.is-focused {
      background: ${({ theme }) => theme.color.bgAlt};
    }

    &.is-active {
      color: ${({ theme }) => theme.color.accent};
      font-weight: 600;
    }
  }

  .code-block-lang-empty {
    padding: 10px;
    color: ${({ theme }) => theme.color.textSubtle};
    font-size: 13px;
    text-align: center;
  }
`;
