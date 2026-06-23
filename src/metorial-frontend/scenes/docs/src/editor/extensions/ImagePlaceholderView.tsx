import { useCallback, useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { NodeViewWrapper } from '@tiptap/react';
import type { ReactNodeViewProps } from '@tiptap/react';
import { useImageUpload, type ImageUploadFn } from '../ImageUploadContext';
import { takePendingFile } from './ImagePlaceholder';
import { IconImage, IconClose } from '../icons';

let Wrap = styled(NodeViewWrapper)`
  margin: 8px 0;
`;

let Card = styled.div<{ $dragOver?: boolean; $error?: boolean }>`
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border-radius: 12px;
  background: ${({ theme, $dragOver, $error }) =>
    $error
      ? theme.color.callout.danger.bg
      : $dragOver
        ? theme.color.accentSoft
        : theme.color.bgAlt};
  border: 1.5px dashed
    ${({ theme, $dragOver, $error }) =>
      $error
        ? theme.color.callout.danger.border
        : $dragOver
          ? theme.color.accent
          : theme.color.border};
  color: ${({ theme }) => theme.color.textMuted};
  transition:
    background ${({ theme }) => theme.motion.fast},
    border-color ${({ theme }) => theme.motion.fast};
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.color.bgHover};
  }
`;

let IconBox = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: ${({ theme }) => theme.color.bg};
  border: 1px solid ${({ theme }) => theme.color.border};
  color: ${({ theme }) => theme.color.textMuted};
  flex: none;
`;

let UploadPreview = styled.div`
  position: relative;
  width: 170px;
  height: 96px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid ${({ theme }) => theme.color.border};
  background: ${({ theme }) => theme.color.bg};
  flex: none;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
`;

let UploadOverlay = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.26);
`;

let Spinner = styled.span`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2.5px solid rgba(255, 255, 255, 0.35);
  border-top-color: #fff;
  animation: imgPlaceholderSpin 0.9s linear infinite;

  @keyframes imgPlaceholderSpin {
    to {
      transform: rotate(360deg);
    }
  }
`;

let TextBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;

  & > .title {
    font-size: 14px;
    font-weight: 500;
    color: ${({ theme }) => theme.color.text};
  }

  & > .desc {
    font-size: 12px;
    color: ${({ theme }) => theme.color.textMuted};
  }

  & > .file {
    font-size: 12px;
    color: ${({ theme }) => theme.color.textMuted};
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  & > .error {
    font-size: 12px;
    color: ${({ theme }) => theme.color.callout.danger.text};
  }
`;

let ButtonRow = styled.div`
  display: flex;
  gap: 6px;
  align-items: center;
  flex: none;
`;

let SmallButton = styled.button<{ $primary?: boolean }>`
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 10px;
  font-size: 12px;
  font-weight: 500;
  background: ${({ theme, $primary }) => ($primary ? theme.color.text : theme.color.bg)};
  color: ${({ theme, $primary }) => ($primary ? theme.color.bg : theme.color.text)};
  border: 1px solid
    ${({ theme, $primary }) => ($primary ? theme.color.text : theme.color.border)};
  border-radius: 6px;
  cursor: pointer;
  transition: opacity ${({ theme }) => theme.motion.fast};

  &:hover {
    opacity: 0.85;
  }
`;

let RemoveBtn = styled.button`
  position: absolute;
  top: 6px;
  right: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: ${({ theme }) => theme.color.textMuted};
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.color.bgHover};
    color: ${({ theme }) => theme.color.text};
  }
`;

let HiddenInput = styled.input`
  display: none;
`;

let ProgressDot = styled.span`
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${({ theme }) => theme.color.accent};
  animation: imgPlaceholderPulse 1.2s ease-in-out infinite;

  @keyframes imgPlaceholderPulse {
    0%,
    100% {
      transform: scale(0.6);
      opacity: 0.4;
    }
    50% {
      transform: scale(1);
      opacity: 1;
    }
  }
`;

interface PlaceholderAttrs {
  id: string;
  fileName?: string | null;
  autoUpload?: boolean;
  pendingFileKey?: string | null;
  status?: 'idle' | 'uploading' | 'error';
  errorMessage?: string | null;
}

export function ImagePlaceholderView({
  node,
  editor,
  selected,
  deleteNode
}: ReactNodeViewProps) {
  let upload = useImageUpload();
  let attrs = node.attrs as PlaceholderAttrs;
  let id = attrs.id;
  let fileName = attrs.fileName ?? null;

  let fileInputRef = useRef<HTMLInputElement | null>(null);
  let [dragOver, setDragOver] = useState(false);
  let [showUrl, setShowUrl] = useState(false);
  let [urlValue, setUrlValue] = useState('');
  let [status, setStatus] = useState<'idle' | 'uploading' | 'error'>(attrs.status ?? 'idle');
  let [error, setError] = useState<string | null>(attrs.errorMessage ?? null);
  let [previewUrl, setPreviewUrl] = useState<string | null>(null);
  let [uploadFileName, setUploadFileName] = useState<string | null>(fileName ?? null);
  let editable = editor.isEditable;
  let displayFileName = uploadFileName ?? fileName;

  // Revoke object URLs to avoid leaking blobs in memory.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  /** Run an upload for a given file and swap in the resulting <image>. */
  let startUpload = useCallback(
    async (file: File, uploader: ImageUploadFn) => {
      setUploadFileName(file.name);
      setPreviewUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(file);
      });
      setStatus('uploading');
      setError(null);
      try {
        let src = await uploader(file);
        editor.chain().focus().replaceImagePlaceholder({ id, src, alt: file.name }).run();
      } catch (err) {
        let msg = err instanceof Error ? err.message : 'Image upload failed';
        setPreviewUrl(prev => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
        setStatus('error');
        setError(msg);
      }
    },
    [editor, id]
  );

  // Auto-upload a file that was queued in extension storage when the
  // placeholder was inserted (via drag-and-drop on the editor body).
  // Deferred to a microtask so the `setStatus('uploading')` inside
  // `startUpload` runs outside the effect's commit phase.
  useEffect(() => {
    if (!attrs.autoUpload || !attrs.pendingFileKey) return;
    let file = takePendingFile(editor, attrs.pendingFileKey);
    if (!file) return;
    queueMicrotask(() => startUpload(file, upload));
    // We intentionally only run this once per placeholder mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  let onPickFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  let onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      startUpload(file, upload);
    },
    [startUpload, upload]
  );

  let onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (!Array.from(e.dataTransfer.items ?? []).some(i => i.kind === 'file')) return;
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  let onDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  let onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      let files = Array.from(e.dataTransfer.files ?? []).filter(f =>
        f.type.startsWith('image/')
      );
      if (!files.length) return;
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      startUpload(files[0], upload);
    },
    [startUpload, upload]
  );

  let onSubmitUrl = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      let trimmed = urlValue.trim();
      if (!trimmed) return;
      editor.chain().focus().replaceImagePlaceholder({ id, src: trimmed }).run();
    },
    [editor, id, urlValue]
  );

  let onRemove = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      deleteNode();
    },
    [deleteNode]
  );

  let isUploading = status === 'uploading';
  let isError = status === 'error';

  return (
    <Wrap data-selected={selected ? 'true' : undefined}>
      <Card
        $dragOver={dragOver}
        $error={isError}
        onDragOver={editable ? onDragOver : undefined}
        onDragLeave={editable ? onDragLeave : undefined}
        onDrop={editable ? onDrop : undefined}
        onClick={editable && !isUploading ? onPickFile : undefined}
        contentEditable={false}
      >
        {isUploading && previewUrl ? (
          <UploadPreview>
            <img src={previewUrl} alt={displayFileName ?? 'Uploading image'} />
            <UploadOverlay>
              <Spinner />
            </UploadOverlay>
          </UploadPreview>
        ) : (
          <IconBox>{isUploading ? <ProgressDot /> : <IconImage />}</IconBox>
        )}

        <TextBlock>
          {isUploading ? (
            <>
              <span className="title">Uploading…</span>
              {displayFileName && <span className="file">{displayFileName}</span>}
            </>
          ) : isError ? (
            <>
              <span className="title">Upload failed</span>
              <span className="error">{error}</span>
            </>
          ) : showUrl ? (
            <form onSubmit={onSubmitUrl} style={{ display: 'flex', gap: 6 }}>
              <input
                type="url"
                autoFocus
                placeholder="Paste image URL"
                value={urlValue}
                onChange={e => setUrlValue(e.target.value)}
                onClick={e => e.stopPropagation()}
                style={{
                  flex: 1,
                  height: 28,
                  padding: '0 8px',
                  fontSize: 13,
                  border: '1px solid currentColor',
                  borderRadius: 6,
                  background: 'transparent',
                  color: 'inherit',
                  outline: 'none'
                }}
              />
              <SmallButton type="submit" $primary>
                Embed
              </SmallButton>
            </form>
          ) : (
            <>
              <span className="title">Add an image</span>
              <span className="desc">
                Click to upload, paste a URL, or drag &amp; drop a file
              </span>
            </>
          )}
        </TextBlock>

        {!isUploading && !isError && !showUrl && (
          <ButtonRow onClick={e => e.stopPropagation()}>
            <SmallButton type="button" onClick={onPickFile}>
              Upload
            </SmallButton>
          </ButtonRow>
        )}

        {isError && (
          <ButtonRow onClick={e => e.stopPropagation()}>
            <SmallButton
              type="button"
              onClick={() => {
                setStatus('idle');
                setError(null);
              }}
            >
              Try again
            </SmallButton>
          </ButtonRow>
        )}

        <RemoveBtn
          type="button"
          aria-label="Remove image placeholder"
          title="Remove"
          onClick={onRemove}
        >
          <IconClose />
        </RemoveBtn>

        <HiddenInput ref={fileInputRef} type="file" accept="image/*" onChange={onFileChange} />
      </Card>
    </Wrap>
  );
}
