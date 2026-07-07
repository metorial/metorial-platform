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

  .docs-remote-selection {
    border-radius: 2px;
  }

  .docs-remote-cursor-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: visible;
    z-index: 8;
  }

  .docs-remote-cursor {
    position: relative;
    display: inline-block;
    width: 0;
    height: 0;
    line-height: 0;
    vertical-align: baseline;
    pointer-events: none;
    z-index: 8;
  }

  .docs-remote-cursor--overlay {
    position: absolute;
    top: 0;
    left: 0;
    display: block;
  }

  .docs-remote-cursor-caret {
    position: absolute;
    top: 0;
    left: -1px;
    width: 2px;
    height: var(--docs-remote-cursor-height, 1.2em);
    border-radius: 1px;
    background: currentColor;
  }

  .docs-remote-cursor-label {
    position: absolute;
    top: -1.35em;
    left: -2px;
    max-width: 160px;
    padding: 2px 6px;
    border-radius: 4px 4px 4px 0;
    color: white;
    font-size: 11px;
    font-weight: 600;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    opacity: 0;
    transition: opacity ${({ theme }) => theme.motion.fast};
  }

  .docs-remote-cursor:hover .docs-remote-cursor-label,
  .docs-remote-cursor-overlay--focused .docs-remote-cursor-label,
  .tiptap-editor:focus-within .docs-remote-cursor-label {
    opacity: 1;
  }

`;
