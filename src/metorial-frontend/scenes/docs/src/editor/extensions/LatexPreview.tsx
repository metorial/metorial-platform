import katex from 'katex';
import 'katex/dist/katex.min.css';

interface Props {
  latex: string;
}

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
      strict: 'warn'
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
    return <div className="latex-output" dangerouslySetInnerHTML={{ __html: html }} />;
  }

  return (
    <div className="latex-output latex-output--error">
      <strong>LaTeX error</strong>
      <span>{message ?? 'Invalid LaTeX'}</span>
    </div>
  );
}
