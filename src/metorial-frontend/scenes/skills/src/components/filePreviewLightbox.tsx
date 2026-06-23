import { CodeBlock } from '@metorial/code';
import { ManagedFile, useFile } from '@metorial/state';
import { Spinner, Text, theme } from '@metorial/ui';
import * as RadixDialog from '@radix-ui/react-dialog';
import { RiCloseLine } from '@remixicon/react';
import * as pdfjsLib from 'pdfjs-dist';
import { ReactNode, Ref, useEffect, useMemo, useRef, useState } from 'react';
import styled, { keyframes } from 'styled-components';

type PreviewKind = 'image' | 'pdf' | 'video' | 'audio' | 'text' | 'fallback';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

let imageExtensions = new Set(['avif', 'gif', 'jpeg', 'jpg', 'png', 'svg', 'webp']);
let videoExtensions = new Set(['mp4', 'mov', 'm4v', 'webm', 'ogv']);
let audioExtensions = new Set(['aac', 'flac', 'm4a', 'mp3', 'oga', 'ogg', 'wav', 'weba']);
let textExtensions = new Set([
  'csv',
  'css',
  'env',
  'graphql',
  'html',
  'js',
  'json',
  'jsx',
  'log',
  'md',
  'mdx',
  'py',
  'rs',
  'sql',
  'svg',
  'toml',
  'ts',
  'tsx',
  'txt',
  'xml',
  'yaml',
  'yml'
]);

let fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

let fadeOut = keyframes`
  from { opacity: 1; }
  to { opacity: 0; }
`;

let fadeInShift = keyframes`
  from { opacity: 0; transform: translate(-50%, -50%) scale(0.96); }
  to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
`;

let fadeOutShift = keyframes`
  from { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  to { opacity: 0; transform: translate(-50%, -50%) scale(0.96); }
`;

let Overlay = styled(RadixDialog.Overlay)`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10000;
  overflow: hidden;
  background: rgba(100, 100, 100, 0.1);
  backdrop-filter: blur(5px);

  &[data-state='open'] {
    animation: ${fadeIn} 200ms ease-out forwards;
  }

  &[data-state='closed'] {
    animation: ${fadeOut} 200ms ease-in forwards;
  }
`;

let Content = styled(RadixDialog.Content)`
  position: fixed;
  top: 50%;
  left: 50%;
  z-index: 10001;
  transform: translate(-50%, -50%);
  outline: none;

  &[data-state='open'] {
    animation: ${fadeInShift} 200ms ease-out;
  }

  &[data-state='closed'] {
    animation: ${fadeOutShift} 200ms ease-in;
  }
`;

let PreviewFrame = styled.div<{ $imageBackground?: boolean; $pdfBackground?: boolean }>`
  position: relative;
  display: flex;
  flex-direction: column;
  width: min(1280px, calc(100vw - 64px));
  height: min(820px, calc(100vh - 64px));
  border-radius: 18px;
  box-shadow: ${theme.shadows.large};
  overflow: hidden;
  background: ${p =>
    p.$imageBackground
      ? '#070707'
      : p.$pdfBackground
        ? theme.colors.gray200
        : theme.colors.background};
  color: ${p => (p.$imageBackground ? 'white' : theme.colors.gray900)};
`;

let FrameBackdropImage = styled.img`
  position: absolute;
  inset: -52px;
  width: calc(100% + 104px);
  height: calc(100% + 104px);
  object-fit: cover;
  filter: blur(36px) brightness(0.28) saturate(1.2);
  opacity: 0.95;
  transform: scale(1.04);
  pointer-events: none;
`;

let FrameScrim = styled.div`
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at center, rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0.55)),
    rgba(0, 0, 0, 0.22);
  pointer-events: none;
`;

let PreviewHeader = styled.div<{ $imageBackground?: boolean }>`
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  background: ${p => (p.$imageBackground ? 'rgba(0, 0, 0, 0.54)' : 'transparent')};
  backdrop-filter: ${p => (p.$imageBackground ? 'blur(12px)' : 'none')};
  border-bottom: 1px solid
    ${p =>
      p.$imageBackground
        ? 'rgba(255, 255, 255, 0.18)'
        : `color-mix(in srgb, ${theme.colors.foreground} 10%, transparent)`};
`;

let TitleWrap = styled.div<{ $imageBackground?: boolean }>`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: ${p => (p.$imageBackground ? 'white' : 'inherit')};
  text-shadow: ${p => (p.$imageBackground ? '0 1px 2px rgba(0, 0, 0, 0.9)' : 'none')};
`;

let PreviewTitle = styled.div<{ $imageBackground?: boolean }>`
  color: ${p => (p.$imageBackground ? '#fff' : theme.colors.foreground)};
  font-size: 16px;
  font-weight: 700;
  line-height: 1.2;
  text-shadow: ${p =>
    p.$imageBackground ? '0 1px 2px rgba(0, 0, 0, 1), 0 0 10px rgba(0, 0, 0, 0.85)' : 'none'};
`;

let HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
`;

let HeaderAction = styled.a<{ $imageBackground?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 30px;
  height: 30px;
  padding: 0 10px;
  border-radius: 8px;
  color: ${p => (p.$imageBackground ? 'white' : theme.colors.foreground)};
  background: ${p =>
    p.$imageBackground
      ? 'rgba(255, 255, 255, 0.12)'
      : `color-mix(in srgb, ${theme.colors.foreground} 6%, transparent)`};
  font-size: 12px;
  font-weight: 500;
  text-decoration: none;

  &:hover {
    background: ${p =>
      p.$imageBackground
        ? 'rgba(255, 255, 255, 0.18)'
        : `color-mix(in srgb, ${theme.colors.foreground} 10%, transparent)`};
    text-decoration: none;
  }
`;

let CloseButton = styled(RadixDialog.Close)<{ $imageBackground?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 8px;
  background: ${p =>
    p.$imageBackground
      ? 'rgba(255, 255, 255, 0.12)'
      : `color-mix(in srgb, ${theme.colors.foreground} 6%, transparent)`};
  color: ${p => (p.$imageBackground ? 'white' : theme.colors.foreground)};
  cursor: pointer;
`;

let PreviewBody = styled.div<{ $pdfPreview?: boolean; $codePreview?: boolean }>`
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: ${p => (p.$pdfPreview || p.$codePreview ? '0' : '20px')};
  background: ${p => (p.$pdfPreview ? theme.colors.gray200 : 'transparent')};
`;

let Image = styled.img`
  display: block;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
`;

let PdfPreviewWrap = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  height: 100%;
  min-height: 0;
`;

let PdfCanvasWrap = styled.div`
  display: flex;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: auto;
  padding: 24px 24px 88px;
  box-sizing: border-box;
`;

let PdfCanvas = styled.canvas`
  display: block;
  align-self: flex-start;
  background: white;
  box-shadow: ${theme.shadows.large};
`;

let PdfControls = styled.div`
  position: absolute;
  left: 50%;
  bottom: 18px;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border: 1px solid color-mix(in srgb, ${theme.colors.foreground} 10%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, ${theme.colors.background} 88%, transparent);
  box-shadow: ${theme.shadows.large};
  backdrop-filter: blur(12px);
`;

let PdfButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 30px;
  padding: 0 10px;
  border: none;
  border-radius: 8px;
  color: ${theme.colors.foreground};
  background: color-mix(in srgb, ${theme.colors.foreground} 6%, transparent);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: color-mix(in srgb, ${theme.colors.foreground} 10%, transparent);
  }

  &:disabled {
    opacity: 0.45;
    cursor: default;
  }
`;

let Video = styled.video`
  display: block;
  max-width: 100%;
  max-height: 100%;
  background: black;
`;

let AudioWrap = styled.div`
  width: min(640px, 100%);
  padding: 36px;
`;

let CodePreview = styled.div`
  width: 100%;
  height: 100%;
  overflow: auto;
  align-self: stretch;

  > div {
    min-height: 100%;
    height: auto;
    overflow: visible;
  }
`;

let LoadingFrame = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: min(560px, 80vw);
  height: min(360px, 60vh);
`;

let Fallback = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 48px;
  text-align: center;
`;

let TriggerButton = styled.button`
  all: unset;
  display: flex;
  align-items: center;
  gap: 6px;
  align-self: stretch;
  min-width: 0;
  flex: 1;
  cursor: pointer;
`;

let getExtension = (fileName: string) => fileName.split('.').pop()?.toLowerCase() ?? '';

let getCodeLanguage = (fileName: string) => {
  let extension = getExtension(fileName);

  if (extension == 'tsx') return 'tsx';
  if (extension == 'ts') return 'typescript';
  if (extension == 'jsx') return 'jsx';
  if (extension == 'js' || extension == 'mjs' || extension == 'cjs') return 'javascript';
  if (extension == 'json') return 'json';
  if (extension == 'md' || extension == 'mdx') return 'markdown';
  if (extension == 'sh') return 'bash';
  if (extension == 'yml' || extension == 'yaml') return 'yaml';
  if (extension == 'html') return 'html';
  if (extension == 'css') return 'css';
  if (extension == 'sql') return 'sql';
  if (extension == 'py') return 'python';
  if (extension == 'rs') return 'rust';
  if (extension == 'xml') return 'xml';

  return 'text';
};

let getPreviewKind = (file: ManagedFile | null | undefined): PreviewKind => {
  if (!file) return 'fallback';

  let extension = getExtension(file.fileName || file.title);
  let fileType = file.fileType?.toLowerCase() ?? '';

  if (fileType.startsWith('image/') || imageExtensions.has(extension)) return 'image';
  if (fileType == 'application/pdf' || extension == 'pdf') return 'pdf';
  if (fileType.startsWith('video/') || videoExtensions.has(extension)) return 'video';
  if (fileType.startsWith('audio/') || audioExtensions.has(extension)) return 'audio';
  if (
    fileType.startsWith('text/') ||
    fileType.includes('json') ||
    fileType.includes('xml') ||
    textExtensions.has(extension)
  ) {
    return 'text';
  }

  return 'fallback';
};

let usePreviewObjectUrl = (downloadUrl: string) => {
  let [objectUrl, setObjectUrl] = useState<string | null>(null);
  let [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let createdObjectUrl: string | null = null;

    setObjectUrl(null);
    setError(null);

    fetch(downloadUrl)
      .then(async response => {
        if (!response.ok) throw new Error(`Failed to load file (${response.status})`);
        return await response.blob();
      })
      .then(blob => {
        if (cancelled) return;
        createdObjectUrl = URL.createObjectURL(blob);
        setObjectUrl(createdObjectUrl);
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load file');
      });

    return () => {
      cancelled = true;
      if (createdObjectUrl) URL.revokeObjectURL(createdObjectUrl);
    };
  }, [downloadUrl]);

  return { objectUrl, error };
};

let usePreviewArrayBuffer = (downloadUrl: string) => {
  let [arrayBuffer, setArrayBuffer] = useState<ArrayBuffer | null>(null);
  let [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setArrayBuffer(null);
    setError(null);

    fetch(downloadUrl)
      .then(async response => {
        if (!response.ok) throw new Error(`Failed to load file (${response.status})`);
        return await response.arrayBuffer();
      })
      .then(buffer => {
        if (!cancelled) setArrayBuffer(buffer);
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load file');
      });

    return () => {
      cancelled = true;
    };
  }, [downloadUrl]);

  return { arrayBuffer, error };
};

let ObjectUrlLoadingState = (p: { error: string | null }) => {
  if (p.error) {
    return (
      <Fallback>
        <Text color="red600" size="2">
          {p.error}
        </Text>
      </Fallback>
    );
  }

  return (
    <LoadingFrame>
      <Spinner size={18} />
    </LoadingFrame>
  );
};

let ImageFilePreview = (p: { downloadUrl: string; title: string }) => {
  let { objectUrl, error } = usePreviewObjectUrl(p.downloadUrl);
  if (!objectUrl) return <ObjectUrlLoadingState error={error} />;
  return <Image alt={p.title} src={objectUrl} />;
};

let ImageFrameBackground = (p: { downloadUrl: string }) => {
  let { objectUrl } = usePreviewObjectUrl(p.downloadUrl);
  if (!objectUrl) return null;

  return (
    <>
      <FrameBackdropImage alt="" src={objectUrl} />
      <FrameScrim />
    </>
  );
};

let VideoFilePreview = (p: { downloadUrl: string }) => {
  let { objectUrl, error } = usePreviewObjectUrl(p.downloadUrl);
  if (!objectUrl) return <ObjectUrlLoadingState error={error} />;
  return <Video controls src={objectUrl} />;
};

let AudioFilePreview = (p: { downloadUrl: string }) => {
  let { objectUrl, error } = usePreviewObjectUrl(p.downloadUrl);
  if (!objectUrl) return <ObjectUrlLoadingState error={error} />;

  return (
    <AudioWrap>
      <audio controls src={objectUrl} style={{ width: '100%' }} />
    </AudioWrap>
  );
};

let PdfFilePreview = (p: { downloadUrl: string }) => {
  let canvasRef = useRef<HTMLCanvasElement | null>(null);
  let { arrayBuffer, error } = usePreviewArrayBuffer(p.downloadUrl);
  let [pageNumber, setPageNumber] = useState(1);
  let [pageCount, setPageCount] = useState<number | null>(null);
  let [renderError, setRenderError] = useState<string | null>(null);
  let [rendering, setRendering] = useState(false);

  useEffect(() => {
    setPageNumber(1);
    setPageCount(null);
    setRenderError(null);
  }, [p.downloadUrl]);

  useEffect(() => {
    if (!arrayBuffer) return;

    let cancelled = false;
    let renderTask: { cancel: () => void; promise: Promise<void> } | null = null;
    let loadingTask: pdfjsLib.PDFDocumentLoadingTask | null = null;

    setRendering(true);
    setRenderError(null);

    try {
      // pdf.js transfers/detaches the buffer it receives. Keep the state-held buffer intact
      // so changing pages can create a fresh document from the same fetched bytes.
      loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer.slice(0)) });
    } catch (err) {
      setRenderError(err instanceof Error ? err.message : 'Failed to load PDF');
      setRendering(false);
      return;
    }

    loadingTask.promise
      .then(async pdf => {
        if (cancelled) {
          await pdf.destroy();
          return;
        }

        let nextPageNumber = Math.min(pageNumber, pdf.numPages);
        setPageCount(pdf.numPages);
        if (nextPageNumber != pageNumber) {
          setPageNumber(nextPageNumber);
          await pdf.destroy();
          return;
        }

        let page = await pdf.getPage(nextPageNumber);
        let viewport = page.getViewport({ scale: 1.35 });
        let canvas = canvasRef.current;
        let context = canvas?.getContext('2d');

        if (!canvas || !context || cancelled) {
          await pdf.destroy();
          return;
        }

        let devicePixelRatio = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * devicePixelRatio);
        canvas.height = Math.floor(viewport.height * devicePixelRatio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
        context.clearRect(0, 0, viewport.width, viewport.height);

        renderTask = page.render({ canvas, canvasContext: context, viewport });
        await renderTask.promise;
        await pdf.destroy();
      })
      .catch(err => {
        if (cancelled || err?.name == 'RenderingCancelledException') return;
        setRenderError(err instanceof Error ? err.message : 'Failed to render PDF');
      })
      .finally(() => {
        if (!cancelled) setRendering(false);
      });

    return () => {
      cancelled = true;
      renderTask?.cancel();
      void loadingTask?.destroy();
    };
  }, [arrayBuffer, pageNumber]);

  if (error || renderError) {
    return (
      <Fallback>
        <Text color="red600" size="2">
          {error ?? renderError}
        </Text>
      </Fallback>
    );
  }

  if (!arrayBuffer) {
    return (
      <LoadingFrame>
        <Spinner size={18} />
      </LoadingFrame>
    );
  }

  return (
    <PdfPreviewWrap>
      <PdfCanvasWrap>
        <PdfCanvas ref={canvasRef} />
      </PdfCanvasWrap>
      <PdfControls>
        <PdfButton
          disabled={rendering || pageNumber <= 1}
          type="button"
          onClick={() => setPageNumber(p => Math.max(1, p - 1))}
        >
          Previous
        </PdfButton>
        <Text color="gray600" size="2">
          {pageCount ? `Page ${pageNumber} of ${pageCount}` : 'Loading PDF...'}
        </Text>
        <PdfButton
          disabled={rendering || pageCount == null || pageNumber >= pageCount}
          type="button"
          onClick={() => setPageNumber(p => (pageCount ? Math.min(pageCount, p + 1) : p))}
        >
          Next
        </PdfButton>
      </PdfControls>
    </PdfPreviewWrap>
  );
};

let TextFilePreview = (p: { downloadUrl: string; title: string }) => {
  let [content, setContent] = useState<string | null>(null);
  let [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setContent(null);
    setError(null);

    fetch(p.downloadUrl)
      .then(async response => {
        if (!response.ok) throw new Error(`Failed to load file (${response.status})`);
        return await response.text();
      })
      .then(text => {
        if (!cancelled) setContent(text);
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load file');
      });

    return () => {
      cancelled = true;
    };
  }, [p.downloadUrl]);

  if (error) {
    return (
      <Fallback>
        <Text color="red600" size="2">
          {error}
        </Text>
      </Fallback>
    );
  }

  if (content == null) {
    return (
      <LoadingFrame>
        <Spinner size={18} />
      </LoadingFrame>
    );
  }

  return (
    <CodePreview>
      <CodeBlock
        code={content}
        language={getCodeLanguage(p.title)}
        lineNumbers
        padding="20px"
        variant="seamless"
      />
    </CodePreview>
  );
};

let PreviewContent = (p: {
  file: ManagedFile | null | undefined;
  downloadUrl: string | null;
  title: string;
}) => {
  if (!p.file || !p.downloadUrl) {
    return (
      <LoadingFrame>
        <Spinner size={18} />
      </LoadingFrame>
    );
  }

  let kind = getPreviewKind(p.file);

  if (kind == 'image') return <ImageFilePreview downloadUrl={p.downloadUrl} title={p.title} />;
  if (kind == 'pdf') return <PdfFilePreview downloadUrl={p.downloadUrl} />;
  if (kind == 'video') return <VideoFilePreview downloadUrl={p.downloadUrl} />;
  if (kind == 'audio') return <AudioFilePreview downloadUrl={p.downloadUrl} />;
  if (kind == 'text') return <TextFilePreview downloadUrl={p.downloadUrl} title={p.title} />;

  return (
    <Fallback>
      <Text size="3" weight="strong">
        Preview unavailable
      </Text>
      <Text color="gray600" size="2">
        This file type cannot be previewed in the browser.
      </Text>
    </Fallback>
  );
};

export let SkillFilePreviewLightbox = (p: {
  instanceId: string | null | undefined;
  fileId: string;
  title: string;
  children: ReactNode;
  triggerRef?: Ref<HTMLButtonElement>;
  onOpenChange?: (open: boolean) => void;
}) => {
  let [open, setOpen] = useState(false);
  let file = useFile(open ? p.instanceId : null, open ? p.fileId : null);
  let downloadUrl = file.data?.downloadUrl ?? null;
  let downloadUrlDownload = useMemo(() => {
    if (!file.data?.downloadUrl) return null;
    try {
      let url = new URL(file.data.downloadUrl);
      url.searchParams.set('download', '1');
      return url.toString();
    } catch {
      return file.data.downloadUrl;
    }
  }, [file.data?.downloadUrl]);
  let previewKind = useMemo(() => getPreviewKind(file.data), [file.data]);
  let isImagePreview = downloadUrl != null && previewKind == 'image';
  let isPdfPreview = downloadUrl != null && previewKind == 'pdf';
  let isCodePreview = downloadUrl != null && previewKind == 'text';

  return (
    <RadixDialog.Root
      open={open}
      onOpenChange={nextOpen => {
        setOpen(nextOpen);
        p.onOpenChange?.(nextOpen);
      }}
    >
      <RadixDialog.Trigger asChild>
        <TriggerButton data-tree-primary-action ref={p.triggerRef} type="button">
          {p.children}
        </TriggerButton>
      </RadixDialog.Trigger>

      <RadixDialog.Portal>
        <Overlay onClick={e => e.stopPropagation()} />
        <Content onClick={e => e.stopPropagation()}>
          <PreviewFrame $imageBackground={isImagePreview} $pdfBackground={isPdfPreview}>
            {downloadUrl && previewKind == 'image' ? (
              <ImageFrameBackground downloadUrl={downloadUrl} />
            ) : null}
            <RadixDialog.Title asChild>
              <PreviewHeader $imageBackground={isImagePreview}>
                <TitleWrap $imageBackground={isImagePreview}>
                  <PreviewTitle $imageBackground={isImagePreview}>
                    {file.data?.fileName ?? p.title}
                  </PreviewTitle>
                </TitleWrap>

                <HeaderActions>
                  {downloadUrl ? (
                    <>
                      <HeaderAction
                        $imageBackground={isImagePreview}
                        href={downloadUrlDownload!}
                        download
                        aria-label="Download file"
                      >
                        Download
                      </HeaderAction>
                      <HeaderAction
                        $imageBackground={isImagePreview}
                        href={downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Open file in new tab"
                      >
                        Open
                      </HeaderAction>
                    </>
                  ) : null}
                  <CloseButton
                    $imageBackground={isImagePreview}
                    aria-label="Close file preview"
                    type="button"
                  >
                    <RiCloseLine size={18} />
                  </CloseButton>
                </HeaderActions>
              </PreviewHeader>
            </RadixDialog.Title>

            <PreviewBody $pdfPreview={isPdfPreview} $codePreview={isCodePreview}>
              <PreviewContent file={file.data} downloadUrl={downloadUrl} title={p.title} />
            </PreviewBody>
          </PreviewFrame>

          {file.error ? (
            <Fallback>
              <Text color="red600" size="2">
                {file.error instanceof Error ? file.error.message : 'Failed to load file'}
              </Text>
            </Fallback>
          ) : null}
        </Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
};
