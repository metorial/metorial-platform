import katex from 'katex';
import katexStyles from 'katex/dist/katex.min.css?inline';
import { SandboxedMarkup } from './SandboxedMarkup';

interface Props {
  latex: string;
}

let previewCss = `${katexStyles}
.katex-display { margin: 0; }`;

export function LatexPreview({ latex }: Props) {
  let trimmed = latex.trim();

  if (!trimmed) {
    return (
      <div className="latex-output latex-output--empty">
        Type LaTeX to render an equation...
      </div>
    );
  }

  let html: string | null = null;
  let message: string | null = null;

  try {
    html = katex.renderToString(trimmed, {
      displayMode: true,
      output: 'htmlAndMathml',
      throwOnError: true,
      strict: 'warn',
      trust: false,
      maxSize: 100,
      maxExpand: 1000
    });
  } catch (error: unknown) {
    message =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : 'Invalid LaTeX';
  }

  if (html) {
    return (
      <div className="latex-output">
        <SandboxedMarkup html={html} title="Equation preview" css={previewCss} fit="content" />
      </div>
    );
  }

  return (
    <div className="latex-output latex-output--error">
      <strong>LaTeX error</strong>
      <span>{message ?? 'Invalid LaTeX'}</span>
    </div>
  );
}
