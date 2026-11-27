import { useLayoutEffect, useMemo, useRef, useState } from 'react';

interface Props {
  html: string;
  title: string;
  css?: string;
  fit: 'container' | 'content';
}

// The frame has no allow-scripts, so nothing inside it can execute even though
// the parent writes into it. allow-same-origin is only there so the parent can
// reach the document to update and measure it.
let sandbox = 'allow-same-origin';

let contentSecurityPolicy =
  "default-src 'none'; style-src 'unsafe-inline'; font-src 'self' https: data:; img-src data:";

let buildSrcDoc = (css: string, fit: Props['fit']) => `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy}">
    <style>
      :root { color-scheme: normal; }
      html, body { margin: 0; padding: 0; background: transparent; overflow: hidden; }
      #root { width: ${fit === 'content' ? 'max-content' : '100%'}; }
      ${css}
    </style>
  </head>
  <body><div id="root"></div></body>
</html>`;

let inheritedStyles = ['color', 'fontFamily', 'fontSize', 'lineHeight'] as const;

export function SandboxedMarkup({ html, title, css = '', fit }: Props) {
  let iframeRef = useRef<HTMLIFrameElement | null>(null);
  let [root, setRoot] = useState<HTMLElement | null>(null);
  let [size, setSize] = useState<{ width: number; height: number } | null>(null);
  let srcDoc = useMemo(() => buildSrcDoc(css, fit), [css, fit]);

  let onLoad = () => {
    setRoot(iframeRef.current?.contentDocument?.getElementById('root') ?? null);
  };

  useLayoutEffect(() => {
    let host = iframeRef.current?.parentElement;
    if (!root || !host) return;
    let hostStyle = window.getComputedStyle(host);
    let body = root.ownerDocument.body;
    for (let property of inheritedStyles) body.style[property] = hostStyle[property];
  });

  useLayoutEffect(() => {
    if (root) root.innerHTML = html;
  }, [root, html]);

  useLayoutEffect(() => {
    if (!root) return;

    let measure = () => {
      let rect = root.getBoundingClientRect();
      let next = { width: Math.ceil(rect.width), height: Math.ceil(rect.height) };
      setSize(prev =>
        prev && prev.width === next.width && prev.height === next.height ? prev : next
      );
    };

    measure();
    let observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [root]);

  return (
    <iframe
      ref={iframeRef}
      title={title}
      sandbox={sandbox}
      srcDoc={srcDoc}
      onLoad={onLoad}
      tabIndex={-1}
      style={{
        display: 'block',
        flexShrink: 0,
        margin: '0 auto',
        border: 0,
        background: 'transparent',
        colorScheme: 'normal',
        pointerEvents: 'none',
        width: fit === 'content' ? (size?.width ?? 0) : '100%',
        height: size?.height ?? 0
      }}
    />
  );
}
