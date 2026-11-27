import * as pdfjsLib from 'pdfjs-dist';
import { useEffect, useRef, useState } from 'react';
import { usePreviewArrayBuffer } from './load';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

export type PdfDocument = pdfjsLib.PDFDocumentProxy;

export let usePdfDocument = (downloadUrl: string | null | undefined) => {
  let { arrayBuffer, error: loadError } = usePreviewArrayBuffer(downloadUrl);
  let [pdf, setPdf] = useState<PdfDocument | null>(null);
  let [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPdf(null);
    setError(null);
    if (!arrayBuffer) return;

    let cancelled = false;
    let loadingTask: pdfjsLib.PDFDocumentLoadingTask;

    try {
      // pdf.js detaches the buffer it receives, so hand it a copy and keep the fetched bytes intact.
      loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer.slice(0)) });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load PDF');
      return;
    }

    loadingTask.promise
      .then(document => {
        if (!cancelled) setPdf(document);
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load PDF');
      });

    return () => {
      cancelled = true;
      void loadingTask.destroy();
    };
  }, [arrayBuffer]);

  return { pdf, error: loadError ?? error, loading: !pdf && !loadError && !error };
};

export let PdfPageCanvas = (p: {
  pdf: PdfDocument;
  pageNumber: number;
  scale?: number;
  width?: number;
  className?: string;
  onRendered?: () => void;
  onError?: (message: string) => void;
}) => {
  let canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let renderTask: { cancel: () => void; promise: Promise<void> } | null = null;

    p.pdf
      .getPage(p.pageNumber)
      .then(async page => {
        if (cancelled) return;

        let base = page.getViewport({ scale: 1 });
        let scale = p.width ? p.width / base.width : (p.scale ?? 1.35);
        let viewport = page.getViewport({ scale });
        let canvas = canvasRef.current;
        let context = canvas?.getContext('2d');
        if (!canvas || !context) return;

        let devicePixelRatio = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * devicePixelRatio);
        canvas.height = Math.floor(viewport.height * devicePixelRatio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
        context.clearRect(0, 0, viewport.width, viewport.height);

        renderTask = page.render({ canvas, canvasContext: context, viewport });
        await renderTask.promise;
        if (!cancelled) p.onRendered?.();
      })
      .catch(err => {
        if (cancelled || err?.name == 'RenderingCancelledException') return;
        p.onError?.(err instanceof Error ? err.message : 'Failed to render PDF');
      });

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [p.pdf, p.pageNumber, p.scale, p.width]);

  return <canvas ref={canvasRef} className={p.className} />;
};
