import type { CSSProperties, ReactNode } from 'react';
import type { FileRejection } from '../lib/accept';
import { DropzoneMessages, FileDropzone } from './fileDropzone';
import { SelectedFileRow } from './selectedFile';
import { FieldLabel, FieldWrapper } from './styles';
import { useFilePicker } from './useFilePicker';

export interface FileInputProps {
  value: File | null;
  onChange: (file: File | null) => void;
  onReject?: (rejections: FileRejection[]) => void;
  accept?: string[];
  maxSize?: number;
  disabled?: boolean;
  label?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  browseLabel?: ReactNode;
  removeLabel?: ReactNode;
  details?: ReactNode;
  progress?: number | null;
  error?: ReactNode;
  style?: CSSProperties;
}

let SelectedFileField = (p: FileInputProps & { value: File }) => {
  let picker = useFilePicker({
    accept: p.accept,
    maxSize: p.maxSize,
    disabled: p.disabled,
    multiple: false,
    noClick: true,
    onReject: p.onReject,
    onFiles: files => p.onChange(files[0] ?? null)
  });

  return (
    <FieldWrapper style={p.style}>
      {p.label ? <FieldLabel>{p.label}</FieldLabel> : null}

      <div {...picker.getRootProps()}>
        <input {...picker.getInputProps()} />

        <SelectedFileRow
          file={p.value}
          disabled={p.disabled}
          details={p.details}
          progress={p.progress}
          dragActive={picker.isDragActive}
          removeLabel={p.removeLabel}
          onRemove={() => p.onChange(null)}
        />
      </div>

      <DropzoneMessages error={p.error} rejections={picker.rejections} />
    </FieldWrapper>
  );
};

export let FileInput = (props: FileInputProps) => {
  if (props.value) return <SelectedFileField {...props} value={props.value} />;

  return (
    <FileDropzone
      accept={props.accept}
      maxSize={props.maxSize}
      disabled={props.disabled}
      label={props.label}
      title={props.title}
      description={props.description}
      browseLabel={props.browseLabel}
      error={props.error}
      style={props.style}
      onReject={props.onReject}
      onFiles={files => props.onChange(files[0] ?? null)}
    />
  );
};
