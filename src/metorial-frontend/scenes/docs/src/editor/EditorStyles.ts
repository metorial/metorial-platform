import styled, { css } from 'styled-components';
import { menuEnter } from './animations';

export let proseStyles = css`
  font-family: ${({ theme }) => theme.font.sans};
  color: ${({ theme }) => theme.color.text};
  font-size: 16px;
  line-height: 1.65;

  > *:first-child {
    margin-top: 0;
  }

  > *:last-child {
    margin-bottom: 0;
  }

  p {
    margin: 0.4em 0;
    min-height: 1em;
  }

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    font-weight: 700;
    line-height: 1.25;
    margin: 1.6em 0 0.4em;
    letter-spacing: -0.01em;
  }

  h1 {
    font-size: 2.25em;
    margin-top: 0.6em;
    letter-spacing: -0.02em;
  }
  h2 {
    font-size: 1.6em;
  }
  h3 {
    font-size: 1.3em;
  }
  h4 {
    font-size: 1.1em;
  }
  h5 {
    font-size: 1em;
  }
  h6 {
    font-size: 0.9em;
    color: ${({ theme }) => theme.color.textMuted};
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  strong,
  b {
    font-weight: 700;
  }

  em,
  i {
    font-style: italic;
  }

  s,
  del {
    text-decoration: line-through;
    color: ${({ theme }) => theme.color.textMuted};
  }

  u {
    text-decoration: underline;
    text-decoration-thickness: 1.5px;
    text-underline-offset: 2px;
  }

  mark {
    background: rgba(255, 212, 0, 0.4);
    color: inherit;
    padding: 0 2px;
    border-radius: 2px;
  }

  a {
    color: ${({ theme }) => theme.color.accent};
    text-decoration: underline;
    text-decoration-color: ${({ theme }) => theme.color.accentSoft};
    text-underline-offset: 2px;
    cursor: pointer;
    transition:
      color ${({ theme }) => theme.motion.fast},
      text-decoration-color ${({ theme }) => theme.motion.fast};

    &:hover {
      color: ${({ theme }) => theme.color.accentHover};
      text-decoration-color: ${({ theme }) => theme.color.accent};
    }
  }

  code {
    font-family: ${({ theme }) => theme.font.mono};
    font-size: 0.875em;
    color: ${({ theme }) => theme.color.code};
    background: ${({ theme }) => theme.color.codeBg};
    padding: 0.18em 0.38em;
    border-radius: 4px;
    border: 1px solid ${({ theme }) => theme.color.border};
    word-break: break-word;
  }

  pre {
    margin: 1em 0;
    padding: 1.1em 1.25em;
    background: ${({ theme }) => theme.color.bgAlt};
    border: 1px solid ${({ theme }) => theme.color.border};
    border-radius: ${({ theme }) => theme.size.radius};
    overflow-x: auto;
    font-family: ${({ theme }) => theme.font.mono};
    font-size: 0.85em;
    line-height: 1.55;
    tab-size: 2;

    code {
      background: none;
      border: none;
      padding: 0;
      color: ${({ theme }) => theme.color.text};
      font-size: inherit;
    }
  }

  .code-block-wrapper {
    margin: 1em 0;
    border: 1px solid ${({ theme }) => theme.color.border};
    border-radius: ${({ theme }) => theme.size.radius};
    background: ${({ theme }) => theme.color.bgAlt};
    overflow: hidden;

    > pre {
      margin: 0;
      border: none;
      border-radius: 0;
      background: transparent;
    }
  }

  .code-block-header {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
    padding: 6px 8px;
    background: ${({ theme }) => theme.color.bg};
    border-bottom: 1px solid ${({ theme }) => theme.color.border};
    user-select: none;
  }

  .code-block-lang-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 8px;
    font: inherit;
    font-size: 0.78em;
    font-family: ${({ theme }) => theme.font.mono};
    color: ${({ theme }) => theme.color.textMuted};
    background: transparent;
    border: 1px solid transparent;
    border-radius: 5px;
    cursor: pointer;
    transition: all 0.12s ease;

    &:hover {
      color: ${({ theme }) => theme.color.text};
      background: ${({ theme }) => theme.color.bgAlt};
      border-color: ${({ theme }) => theme.color.border};
    }

    svg {
      opacity: 0.6;
    }
  }

  .code-block-lang-static {
    font-family: ${({ theme }) => theme.font.mono};
    font-size: 0.78em;
    color: ${({ theme }) => theme.color.textMuted};
    padding: 3px 8px;
  }

  .code-block-preview {
    border-top: 1px solid ${({ theme }) => theme.color.border};
    background: ${({ theme }) => theme.color.bg};
    padding: 16px;
  }

  .mermaid-output {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 60px;
    color: ${({ theme }) => theme.color.text};

    svg {
      max-width: 100%;
      height: auto;
    }

    &--empty,
    &--loading {
      color: ${({ theme }) => theme.color.textSubtle};
      font-style: italic;
      font-size: 0.875em;
    }

    &--error {
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
      padding: 10px 12px;
      background: ${({ theme }) => theme.color.callout.danger.bg};
      border: 1px solid ${({ theme }) => theme.color.callout.danger.border};
      border-radius: 6px;
      color: ${({ theme }) => theme.color.callout.danger.text};
      font-size: 0.85em;

      strong {
        font-weight: 600;
      }

      span {
        font-family: ${({ theme }) => theme.font.mono};
        font-size: 0.92em;
        white-space: pre-wrap;
      }
    }
  }

  .mermaid-block {
    display: flex;
    justify-content: center;
    align-items: center;
    margin: 1em 0;
    padding: 16px;
    border: 1px solid ${({ theme }) => theme.color.border};
    border-radius: ${({ theme }) => theme.size.radius};
    background: ${({ theme }) => theme.color.bg};
    color: ${({ theme }) => theme.color.text};
    min-height: 60px;

    svg {
      max-width: 100%;
      height: auto;
    }

    &--empty {
      color: ${({ theme }) => theme.color.textSubtle};
      font-style: italic;
      font-size: 0.875em;
    }

    &--error {
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
      background: ${({ theme }) => theme.color.callout.danger.bg};
      border-color: ${({ theme }) => theme.color.callout.danger.border};
      color: ${({ theme }) => theme.color.callout.danger.text};
      font-size: 0.85em;

      strong {
        font-weight: 600;
      }

      span {
        font-family: ${({ theme }) => theme.font.mono};
        font-size: 0.92em;
        white-space: pre-wrap;
      }
    }
  }

  .equation-block-wrapper {
    margin: 1em 0;
    border: 1px solid ${({ theme }) => theme.color.border};
    border-radius: ${({ theme }) => theme.size.radius};
    background: ${({ theme }) => theme.color.bg};
    overflow: hidden;
  }

  .equation-block-editor {
    border-bottom: 1px solid ${({ theme }) => theme.color.border};
    background: ${({ theme }) => theme.color.bgAlt};
  }

  .equation-block-input {
    display: block;
    width: 100%;
    margin: 0;
    border: 0;
    padding: 12px;
    resize: none;
    outline: 0;
    background: transparent;
    color: ${({ theme }) => theme.color.text};
    font-family: ${({ theme }) => theme.font.mono};
    font-size: 0.88em;
    line-height: 1.5;
    overflow: hidden;
    box-sizing: border-box;

    &::placeholder {
      color: ${({ theme }) => theme.color.textSubtle};
    }
  }

  .equation-block-preview {
    padding: 16px;
    background: ${({ theme }) => theme.color.bg};
  }

  .latex-output {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    min-height: 56px;
    color: ${({ theme }) => theme.color.text};
    overflow-x: auto;
    overflow-y: hidden;

    .katex-display {
      margin: 0;
    }

    &--empty {
      color: ${({ theme }) => theme.color.textSubtle};
      font-style: italic;
      font-size: 0.875em;
    }

    &--error {
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
      padding: 10px 12px;
      background: ${({ theme }) => theme.color.callout.danger.bg};
      border: 1px solid ${({ theme }) => theme.color.callout.danger.border};
      border-radius: 6px;
      color: ${({ theme }) => theme.color.callout.danger.text};
      font-size: 0.85em;

      strong {
        font-weight: 600;
      }

      span {
        font-family: ${({ theme }) => theme.font.mono};
        font-size: 0.92em;
        white-space: pre-wrap;
      }
    }
  }

  blockquote {
    margin: 1em 0;
    padding: 0.2em 1em;
    border-left: 3px solid ${({ theme }) => theme.color.borderStrong};
    color: ${({ theme }) => theme.color.textMuted};
    font-style: italic;
  }

  hr {
    border: none;
    border-top: 1px solid ${({ theme }) => theme.color.border};
    margin: 2em 0;
  }

  ul,
  ol {
    margin: 0.4em 0;
    padding-left: 1.6em;
  }

  ul {
    list-style-type: disc;
  }

  ul ul {
    list-style-type: circle;
  }

  ul ul ul {
    list-style-type: square;
  }

  ol {
    list-style-type: decimal;
  }

  ol ol {
    list-style-type: lower-alpha;
  }

  ol ol ol {
    list-style-type: lower-roman;
  }

  ul li::marker {
    color: ${({ theme }) => theme.color.textSubtle};
  }

  ol li::marker {
    color: ${({ theme }) => theme.color.textSubtle};
    font-variant-numeric: tabular-nums;
  }

  li {
    margin: 0.15em 0;

    > p {
      margin: 0.15em 0;
    }
  }

  ul[data-type='taskList'],
  ul.task-list {
    list-style: none;
    padding-left: 0.2em;

    li {
      display: flex;
      align-items: flex-start;
      gap: 0.55em;
      margin: 0.25em 0;

      > label {
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
        height: 1.65em;
        user-select: none;
      }

      > div {
        flex: 1;
        min-width: 0;

        > p {
          margin: 0;
        }
      }

      input[type='checkbox'] {
        appearance: none;
        -webkit-appearance: none;
        width: 16px;
        height: 16px;
        border: 1.5px solid ${({ theme }) => theme.color.borderStrong};
        border-radius: 4px;
        background: ${({ theme }) => theme.color.bg};
        cursor: pointer;
        position: relative;
        transition: all ${({ theme }) => theme.motion.fast};

        &:hover {
          border-color: ${({ theme }) => theme.color.accent};
        }

        &:checked {
          background: ${({ theme }) => theme.color.accent};
          border-color: ${({ theme }) => theme.color.accent};

          &::after {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            width: 4px;
            height: 8px;
            border: solid white;
            border-width: 0 2px 2px 0;
            transform: translate(-50%, -65%) rotate(45deg);
          }
        }
      }

      &[data-checked='true'] > div {
        color: ${({ theme }) => theme.color.textMuted};
        text-decoration: line-through;
      }
    }
  }

  table,
  .editor-table {
    border-collapse: collapse;
    table-layout: fixed;
    width: 100%;
    overflow: hidden;
    border-radius: ${({ theme }) => theme.size.radiusSm};
    border: 1.5px solid ${({ theme }) => theme.color.borderStrong};

    td,
    th {
      min-width: 1em;
      border: 1px solid ${({ theme }) => theme.color.borderStrong};
      padding: 0.55em 0.75em;
      vertical-align: top;
      position: relative;
      background: transparent;
      font-weight: normal;
      text-align: left;

      > p {
        margin: 0;
      }
    }

    /* Markdown tables always have a header row at row 0 */
    tbody > tr:first-child > th,
    tbody > tr:first-child > td {
      background: ${({ theme }) => theme.color.bgAlt};
      font-weight: 600;
    }

    .selectedCell {
      background: ${({ theme }) => theme.color.accentSoft};
    }
    .selectedCell::after {
      content: '';
      position: absolute;
      inset: 0;
      background: ${({ theme }) => theme.color.accentSoft};
      pointer-events: none;
      z-index: 2;
    }
  }

  /* Table NodeView wrapper with corner + col/row gutters.
     The row gutter (and corner) live OUTSIDE the editor's content column so
     that the table itself can fill the entire content width. */
  .pm-table-wrapper {
    --pm-gutter: 16px;
    --pm-gutter-offset: 5px;
    --pm-gutter-radius: 5px;
    display: grid;
    grid-template-columns: var(--pm-gutter) minmax(0, 1fr);
    grid-template-rows: var(--pm-gutter) auto;
    column-gap: var(--pm-gutter-offset);
    row-gap: var(--pm-gutter-offset);
    margin: 1em 0 1em calc(-1 * (var(--pm-gutter) + var(--pm-gutter-offset)));
    width: calc(100% + var(--pm-gutter) + var(--pm-gutter-offset));
  }

  .pm-table-corner-host {
    grid-column: 1;
    grid-row: 1;
  }
  .pm-table-col-gutter-host {
    grid-column: 2;
    grid-row: 1;
    display: flex;
    align-items: stretch;
    height: var(--pm-gutter);
    overflow: hidden;
  }
  .pm-table-row-gutter-host {
    grid-column: 1;
    grid-row: 2;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    width: var(--pm-gutter);
    overflow: hidden;
  }
  .pm-table-host {
    grid-column: 2;
    grid-row: 2;
    border: 1.5px solid ${({ theme }) => theme.color.borderStrong};
    border-radius: ${({ theme }) => theme.size.radiusSm};
    overflow: hidden;
    min-width: 0;
  }

  .pm-table-host > .editor-table {
    border: 0;
    border-radius: 0;
  }

  /* Read-only mode: hide all table gutters and collapse back to plain table */
  &[contenteditable='false'] .pm-table-corner-host,
  &[contenteditable='false'] .pm-table-col-gutter-host,
  &[contenteditable='false'] .pm-table-row-gutter-host {
    display: none;
  }

  &[contenteditable='false'] .pm-table-wrapper {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto;
    margin: 1em 0;
    width: 100%;
  }

  &[contenteditable='false'] .pm-table-host {
    grid-column: 1;
    grid-row: 1;
  }

  .pm-table-corner,
  .pm-table-col-handle,
  .pm-table-row-handle {
    margin: 0;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: pointer;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    color: inherit;
    border-radius: var(--pm-gutter-radius);
    transition:
      background ${({ theme }) => theme.motion.fast},
      box-shadow ${({ theme }) => theme.motion.fast},
      transform ${({ theme }) => theme.motion.fast},
      opacity ${({ theme }) => theme.motion.fast};
  }

  .pm-table-corner {
    width: 100%;
    height: 100%;
    cursor: grab;

    &:active {
      cursor: grabbing;
    }
  }
  .pm-table-corner__grip {
    width: 8px;
    height: 8px;
    border-radius: 2px;
    background-image: radial-gradient(
      circle at center,
      ${({ theme }) => theme.color.textSubtle} 0.9px,
      transparent 1.2px
    );
    background-size: 4px 4px;
    background-repeat: repeat;
    opacity: 0;
    transition:
      opacity ${({ theme }) => theme.motion.fast},
      background-image ${({ theme }) => theme.motion.fast};
  }

  .pm-table-col-handle {
    flex-shrink: 0;
    height: 100%;
    cursor: grab;

    &:active {
      cursor: grabbing;
    }
  }
  .pm-table-col-handle__grip {
    width: 50%;
    max-width: 22px;
    height: 3px;
    border-radius: 999px;
    background: ${({ theme }) => theme.color.borderStrong};
    opacity: 0;
    transition:
      opacity ${({ theme }) => theme.motion.fast},
      background ${({ theme }) => theme.motion.fast};
  }

  .pm-table-row-handle {
    flex-shrink: 0;
    width: 100%;
    cursor: grab;

    &:active {
      cursor: grabbing;
    }
  }
  .pm-table-row-handle__grip {
    height: 50%;
    max-height: 22px;
    width: 3px;
    border-radius: 999px;
    background: ${({ theme }) => theme.color.borderStrong};
    opacity: 0;
    transition:
      opacity ${({ theme }) => theme.motion.fast},
      background ${({ theme }) => theme.motion.fast};
  }

  /* Reveal grips on hover/focus */
  .pm-table-wrapper:hover .pm-table-corner__grip,
  .pm-table-wrapper:hover .pm-table-col-handle__grip,
  .pm-table-wrapper:hover .pm-table-row-handle__grip,
  .pm-table-wrapper:focus-within .pm-table-corner__grip,
  .pm-table-wrapper:focus-within .pm-table-col-handle__grip,
  .pm-table-wrapper:focus-within .pm-table-row-handle__grip {
    opacity: 0.55;
  }

  .pm-table-corner:hover,
  .pm-table-col-handle:hover,
  .pm-table-row-handle:hover {
    background: ${({ theme }) => theme.color.accentSoft};
  }
  .pm-table-corner:hover .pm-table-corner__grip {
    opacity: 1;
    background-image: radial-gradient(
      circle at center,
      ${({ theme }) => theme.color.accent} 0.9px,
      transparent 1.2px
    );
  }
  .pm-table-col-handle:hover .pm-table-col-handle__grip,
  .pm-table-row-handle:hover .pm-table-row-handle__grip {
    opacity: 1;
    background: ${({ theme }) => theme.color.accent};
  }

  .pm-table-col-handle[data-drag-source='true'],
  .pm-table-row-handle[data-drag-source='true'] {
    opacity: 0.4;
  }

  .pm-table-col-handle[data-drop-target='true'],
  .pm-table-row-handle[data-drop-target='true'] {
    background: ${({ theme }) => theme.color.accentSoft};
    box-shadow: inset 0 0 0 1px ${({ theme }) => theme.color.accent};
  }

  .pm-table-col-handle[data-drop-target='true'] .pm-table-col-handle__grip,
  .pm-table-row-handle[data-drop-target='true'] .pm-table-row-handle__grip {
    opacity: 1;
    background: ${({ theme }) => theme.color.accent};
  }

  img,
  .editor-image {
    max-width: 100%;
    height: auto;
    border-radius: ${({ theme }) => theme.size.radiusSm};
    margin: 0.5em 0;
    display: block;
  }

  /* Callout */
  .callout {
    margin: 1em 0;
    padding: 0.85em 1.1em 0.85em 1.1em;
    border-radius: ${({ theme }) => theme.size.radius};
    border: 1px solid;
    position: relative;

    > *:first-child {
      margin-top: 0;
    }
    > *:last-child {
      margin-bottom: 0;
    }

    &[data-callout-type='info'] {
      background: ${({ theme }) => theme.color.callout.info.bg};
      border-color: ${({ theme }) => theme.color.callout.info.border};
    }
    &[data-callout-type='warning'] {
      background: ${({ theme }) => theme.color.callout.warning.bg};
      border-color: ${({ theme }) => theme.color.callout.warning.border};
    }
    &[data-callout-type='success'] {
      background: ${({ theme }) => theme.color.callout.success.bg};
      border-color: ${({ theme }) => theme.color.callout.success.border};
    }
    &[data-callout-type='danger'] {
      background: ${({ theme }) => theme.color.callout.danger.bg};
      border-color: ${({ theme }) => theme.color.callout.danger.border};
    }
  }

  .ProseMirror-gapcursor:after {
    border-color: ${({ theme }) => theme.color.textMuted};
  }

  .editor-dropcursor {
    border-radius: 999px;
  }

  .ProseMirror-selectednode {
    outline: 2px solid ${({ theme }) => theme.color.accent};
    outline-offset: 2px;
    border-radius: ${({ theme }) => theme.size.radiusSm};
  }
`;

export let EditorScroll = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  background: ${({ theme }) => theme.color.bg};
`;

export let EditorContent = styled.div<{ $readOnly?: boolean }>`
  position: relative;
  max-width: ${({ theme }) => theme.size.contentWidth};
  margin: 0 auto;
  padding: 48px 64px;

  ${({ $readOnly }) =>
    $readOnly &&
    `
    .ProseMirror .code-block-header {
      display: none !important;
    }

    .ProseMirror .pm-table-corner-host,
    .ProseMirror .pm-table-col-gutter-host,
    .ProseMirror .pm-table-row-gutter-host {
      display: none !important;
    }

    .ProseMirror .pm-table-wrapper {
      grid-template-columns: minmax(0, 1fr) !important;
      grid-template-rows: auto !important;
      margin: 1em 0 !important;
      width: 100% !important;
    }

    .ProseMirror .pm-table-host {
      grid-column: 1 !important;
      grid-row: 1 !important;
    }
  `}

  .drag-handle {
    z-index: 5;
    transition:
      opacity ${({ theme }) => theme.motion.fast},
      top 140ms cubic-bezier(0.32, 0.72, 0.34, 1.05),
      left 140ms cubic-bezier(0.32, 0.72, 0.34, 1.05);
  }

  .drag-handle button {
    ${menuEnter(160)}
  }

  /* Belt-and-suspenders: when the BlockHandle React component decides not
     to render its button (e.g. for tables / code blocks) the portal wrapper
     becomes empty. The plugin still positions and shows it on mousemove, so
     hide it explicitly to avoid any chance of a stale button paint. */
  .drag-handle:empty {
    display: none !important;
  }

  .drag-handle[data-dragging='true'] button {
    background: ${({ theme }) => theme.color.bgAlt};
    color: ${({ theme }) => theme.color.text};
    cursor: grabbing;
  }

  @media (max-width: 720px) {
    padding: 32px 20px;

    .drag-handle {
      display: none;
    }
  }

  .ProseMirror {
    outline: none;
    ${proseStyles}

    p.is-editor-empty:first-child::before,
    .is-empty::before {
      color: ${({ theme }) => theme.color.textSubtle};
      content: attr(data-placeholder);
      float: left;
      height: 0;
      pointer-events: none;
    }
  }
`;

export let TitleInput = styled.textarea`
  width: 100%;
  border: 0;
  outline: 0;
  resize: none;
  background: transparent;
  color: ${({ theme }) => theme.color.text};
  font-family: ${({ theme }) => theme.font.sans};
  font-size: 2.6em;
  font-weight: 800;
  line-height: 1.15;
  letter-spacing: -0.02em;
  margin-bottom: 0.4em;
  padding: 0;
  overflow: hidden;

  &::placeholder {
    color: ${({ theme }) => theme.color.textSubtle};
  }
`;
