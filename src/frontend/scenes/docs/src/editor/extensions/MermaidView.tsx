import { useEffect, useState } from 'react';
import { useTheme } from 'styled-components';
import type { Theme } from '../../styles/theme';
import { getMermaid, nextMermaidId } from './mermaid';

interface Props {
  code: string;
}

interface RenderOk {
  kind: 'ok';
  for: string;
  svg: string;
}

interface RenderError {
  kind: 'error';
  for: string;
  message: string;
}

type RenderState = RenderOk | RenderError;

let RENDER_DEBOUNCE_MS = 500;

export function MermaidView({ code }: Props) {
  let theme = useTheme() as Theme;
  let [result, setResult] = useState<RenderState | null>(null);
  let trimmed = code.trim();
  let [debouncedCode, setDebouncedCode] = useState(trimmed);
  let [lastSvg, setLastSvg] = useState<string | null>(null);

  useEffect(() => {
    let timeoutId = window.setTimeout(() => {
      setDebouncedCode(trimmed);
    }, RENDER_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [trimmed]);

  useEffect(() => {
    if (!debouncedCode) return;
    let cancelled = false;
    let id = nextMermaidId();

    getMermaid(theme.name)
      .then(mermaid =>
        mermaid.parse(debouncedCode).then(() => mermaid.render(id, debouncedCode))
      )
      .then(({ svg }) => {
        if (!cancelled) {
          setResult({ kind: 'ok', for: debouncedCode, svg });
          setLastSvg(svg);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          let message =
            e instanceof Error ? e.message : typeof e === 'string' ? e : 'Render failed';
          setResult({ kind: 'error', for: debouncedCode, message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedCode, theme.name]);

  if (!trimmed) {
    return (
      <div className="mermaid-output mermaid-output--empty">
        Type some Mermaid syntax to render a diagram…
      </div>
    );
  }

  let isRendering = debouncedCode !== trimmed || result?.for !== debouncedCode;
  let svg = result?.kind === 'ok' ? result.svg : lastSvg;

  if (!svg && result?.kind === 'error' && result.for === debouncedCode && !isRendering) {
    return (
      <div className="mermaid-output mermaid-output--error">
        <strong>Mermaid error</strong>
        <span>{result.message}</span>
      </div>
    );
  }

  if (!svg) {
    return <div className="mermaid-output mermaid-output--loading">Rendering…</div>;
  }

  return (
    <div
      className={'mermaid-output' + (isRendering ? ' mermaid-output--updating' : '')}
      dangerouslySetInnerHTML={{
        __html: svg
      }}
    />
  );
}
