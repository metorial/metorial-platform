import { Button, Error } from '@metorial/ui';
import { RiUploadCloud2Line } from '@remixicon/react';
import type { CSSProperties, ReactNode } from 'react';
import { describeAccept, describeMaxSize, type FileRejection } from '../lib/accept';
import {
  CopyBlock,
  CopyDescription,
  CopyTitle,
  DropArea,
  FieldLabel,
  FieldWrapper,
  IconBox,
  Messages
} from './styles';
import { useFilePicker } from './useFilePicker';

export interface FileDropzoneProps {
  onFiles: (files: File[]) => void;
  onReject?: (rejections: FileRejection[]) => void;
  accept?: string[];
  maxSize?: number;
  multiple?: boolean;
  disabled?: boolean;
  label?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  browseLabel?: ReactNode;
  icon?: ReactNode;
  error?: ReactNode;
  style?: CSSProperties;
}

export let getDefaultDropTitle = (opts: { accept?: string[]; multiple?: boolean }) => {
  let allowed = describeAccept(opts.accept);

  if (opts.multiple) return allowed ? `Drop ${allowed} files` : 'Drop files here';
  return allowed ? `Drop a ${allowed}` : 'Drop a file here';
};

export let DropzoneDescription = (p: { maxSize?: number; description?: ReactNode }) => {
  let sizeText = describeMaxSize(p.maxSize);
  if (!sizeText && !p.description) return null;

  return (
    <CopyDescription>
      {sizeText ? `${sizeText}.` : null}
      {sizeText && p.description ? ' ' : null}
      {p.description}
    </CopyDescription>
  );
};

export let DropzoneMessages = (p: { error?: ReactNode; rejections: FileRejection[] }) => {
  if (!p.error && !p.rejections.length) return null;

  return (
    <Messages role="alert">
      {p.error ? <Error size={12}>{p.error}</Error> : null}
      {p.rejections.map((rejection, i) => (
        <Error key={i} size={12}>
          {rejection.message}
        </Error>
      ))}
    </Messages>
  );
};

export let FileDropzone = ({
  onFiles,
  onReject,
  accept,
  maxSize,
  multiple = false,
  disabled,
  label,
  title,
  description,
  browseLabel,
  icon,
  error,
  style
}: FileDropzoneProps) => {
  let picker = useFilePicker({ onFiles, onReject, accept, maxSize, multiple, disabled });
  let invalid = !!error || picker.rejections.length > 0;

  return (
    <FieldWrapper style={style}>
      {label ? <FieldLabel>{label}</FieldLabel> : null}

      <DropArea
        {...picker.getRootProps()}
        data-drag-active={picker.isDragActive}
        data-disabled={!!disabled}
        data-invalid={invalid}
      >
        <input {...picker.getInputProps()} />

        <IconBox>{icon ?? <RiUploadCloud2Line size={18} />}</IconBox>

        <CopyBlock>
          <CopyTitle>
            {picker.isDragActive
              ? 'Drop to upload'
              : (title ?? getDefaultDropTitle({ accept, multiple }))}
          </CopyTitle>
          <DropzoneDescription maxSize={maxSize} description={description} />
        </CopyBlock>

        <Button
          type="button"
          size="2"
          variant="outline"
          disabled={disabled}
          onClick={e => {
            e.stopPropagation();
            picker.open();
          }}
        >
          {browseLabel ?? (multiple ? 'Choose Files' : 'Choose File')}
        </Button>
      </DropArea>

      <DropzoneMessages error={error} rejections={picker.rejections} />
    </FieldWrapper>
  );
};
