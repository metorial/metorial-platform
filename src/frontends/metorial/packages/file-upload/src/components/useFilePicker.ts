import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { splitFiles, toAcceptAttribute, type FileRejection } from '../lib/accept';

export interface FilePickerOptions {
  onFiles: (files: File[]) => void;
  onReject?: (rejections: FileRejection[]) => void;
  accept?: string[];
  maxSize?: number;
  multiple?: boolean;
  disabled?: boolean;
  noClick?: boolean;
}

export let useFilePicker = (opts: FilePickerOptions) => {
  let [rejections, setRejections] = useState<FileRejection[]>([]);

  let dropzone = useDropzone({
    multiple: true,
    noKeyboard: true,
    noClick: opts.noClick,
    disabled: opts.disabled,
    onDrop: files => {
      let { accepted, rejected } = splitFiles(files, opts);

      setRejections(rejected);
      if (rejected.length) opts.onReject?.(rejected);
      if (accepted.length) opts.onFiles(accepted);
    }
  });

  let getInputProps = useCallback(
    () =>
      dropzone.getInputProps({
        accept: toAcceptAttribute(opts.accept),
        multiple: !!opts.multiple
      }),
    [dropzone.getInputProps, opts.accept, opts.multiple]
  );

  return {
    getRootProps: dropzone.getRootProps,
    getInputProps,
    open: dropzone.open,
    isDragActive: dropzone.isDragActive,
    rejections,
    clearRejections: () => setRejections([])
  };
};
