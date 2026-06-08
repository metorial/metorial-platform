import { Button, Dialog, Spacer, Spinner, theme } from '@metorial/ui';
import {
  RiCheckLine,
  RiCloseLine,
  RiDeleteBin4Line,
  RiFileUploadLine
} from '@remixicon/react';
import clsx from 'clsx';
import { Fragment, useEffect, useState, type ReactNode } from 'react';
import Editor from 'react-avatar-editor';
import { useDropzone } from 'react-dropzone';
import { useMeasure, useWindowSize } from 'react-use';
import { styled } from 'styled-components';

let EditorWrapper = styled('figure')`
  width: fit-content;
  margin: 15px auto 0px auto;
  overflow: hidden;
  position: relative;
`;

let Avatar = styled('figure')`
  height: 300px;
  width: 300px;
  border-radius: 50%;
  margin: 35px auto 14px auto;
  transition: all 0.3s;
  position: relative;
  outline: none;

  &:hover {
    box-shadow: 0 0 0 5px ${theme.colors.primary};
    background: ${theme.colors.primary};
  }

  img {
    height: 100%;
    width: 100%;
    border-radius: 50%;
    object-fit: cover;
  }

  &.loading {
    pointer-events: none;

    img {
      opacity: 0.6;
    }
  }
`;

let Circle = styled('div')`
  position: absolute;
  top: -3px;
  left: -3px;
  right: -3px;
  bottom: -3px;
  box-shadow: 0 0 0 3px ${theme.colors.primary};
  border-radius: 50%;
`;

let DropIndicator = styled('div')`
  position: absolute;
  top: 0px;
  left: 0px;
  right: 0px;
  bottom: 0px;
  box-shadow: 0 0 0 5px ${theme.colors.primary};
  background: rgba(255, 255, 255, 0.7);
  border-radius: 50%;
  transition: all 0.3s;
  pointer-events: none;

  p {
    font-weight: 600;
    font-size: 1.4em;
    padding: 0px;
    text-align: center;
    line-height: 1;
  }

  &:not(.active) {
    opacity: 0;
  }
`;

let SpinnerWrapper = styled('div')`
  position: absolute;
  top: calc(50% - 15px);
  left: calc(50% - 15px);
  display: flex;
`;

let Main = styled('main')`
  text-align: center;
  max-width: 390px;
  margin: 0px auto;
  overflow: hidden;
  transition: all 0.3s;

  .inner {
    padding: 0px 20px;
    display: flex;
    flex-direction: column;

    h1 {
      margin-bottom: 8px;
      font-weight: 600;
      font-size: 28px;
    }

    p {
      font-weight: 600;
      font-size: 17px;
      opacity: 0.5;
    }
  }
`;

let Buttons = styled('footer')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
`;

let RangeInput = styled('input')`
  margin-top: 30px;
  -webkit-appearance: none;
  width: 100%;
  height: 5px;
  border-radius: 5px;
  background: ${theme.colors.gray300};
  outline: none;
  opacity: 0.7;
  transition: opacity 0.2s;

  &:hover {
    opacity: 1;
  }

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 15px;
    height: 15px;
    border-radius: 50%;
    background: ${theme.colors.primary};
    cursor: pointer;
  }

  &::-moz-range-thumb {
    width: 15px;
    height: 15px;
    border-radius: 50%;
    background: ${theme.colors.primary};
    cursor: pointer;
  }
`;

let getImageExtension = (type: string) => {
  if (type === 'image/jpeg') return 'jpg';
  if (type === 'image/png') return 'png';
  if (type === 'image/webp') return 'webp';
  return 'webp';
};

let getFileBasename = (fileName: string | undefined) => {
  let fallback = 'image';
  if (!fileName) return fallback;

  let withoutExtension = fileName.replace(/\.[^/.]+$/, '').trim();
  return withoutExtension || fallback;
};

export let ImageUploader = ({
  isOpen,
  setIsOpen,
  onReset,
  onSave,
  photoUrl,
  label,
  description
}: {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onReset?: () => Promise<unknown>;
  onSave: (file: File | Blob) => Promise<unknown>;
  photoUrl: string;
  label: ReactNode;
  description: ReactNode;
}) => {
  let [mainVisible, setMainVisible] = useState(true);
  let [loading, setLoading] = useState(false);
  let [stage, setStage] = useState('overview');
  let [zoom, setZoom] = useState(100);
  let [file, setFile] = useState<File>();
  let [editor, setEditorRef] = useState<Editor>();
  let [cachedPhotoUrl, setCachedPhotoUrl] = useState(() => photoUrl);

  let { width } = useWindowSize();
  let [mainInnerRef, { height }] = useMeasure();

  let avatarSize = width > 600 ? 300 : width * 0.5;

  let { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp']
    },
    multiple: false,
    disabled: loading || stage != 'overview',
    onDrop: acceptedFiles => {
      setStage('edit');
      if (acceptedFiles.length > 0) setFile(acceptedFiles[0]);
    }
  });

  useEffect(() => {
    if (!isOpen) setCachedPhotoUrl(photoUrl);
  }, [isOpen, photoUrl]);

  useEffect(() => {
    if (isOpen) {
      setMainVisible(true);
      setLoading(false);
      setStage('overview');
      setZoom(100);
      setFile(undefined);
    }
  }, [isOpen]);

  return (
    <Dialog.Wrapper isOpen={isOpen} onOpenChange={setIsOpen}>
      <input {...getInputProps()} />

      {stage == 'edit' && file ? (
        <EditorWrapper>
          <div style={{ opacity: loading ? 0.5 : 1, transition: 'all .3s' }}>
            <Editor
              ref={e => setEditorRef(e as any)}
              image={file}
              width={avatarSize}
              height={avatarSize}
              border={20}
              borderRadius={150}
              color={[255, 255, 255, 0.6]}
              scale={zoom / 100}
              rotate={0}
            />
          </div>

          {loading && (
            <SpinnerWrapper>
              <Spinner size={30} />
            </SpinnerWrapper>
          )}
        </EditorWrapper>
      ) : (
        <Avatar
          {...getRootProps()}
          onClick={() => {
            open();
          }}
          style={{ width: avatarSize, height: avatarSize }}
          className={clsx({ loading })}
        >
          <img src={cachedPhotoUrl} alt="Current avatar" />

          {loading && (
            <SpinnerWrapper>
              <Spinner size={30} />
            </SpinnerWrapper>
          )}

          <DropIndicator className={clsx({ active: isDragActive })}>
            <p>Drop it like it's hot.</p>
          </DropIndicator>

          <Circle />
        </Avatar>
      )}

      <Main
        style={
          mainVisible
            ? { height: height == 0 ? undefined : height }
            : { height: 45, opacity: 0, pointerEvents: 'none', userSelect: 'none' }
        }
      >
        <div className="inner" ref={mainInnerRef as any}>
          <Spacer height={stage == 'edit' ? 10 : 40} />

          <h1>{label}</h1>

          {stage == 'edit' ? (
            <Fragment>
              <p>Crop this image to fit.</p>

              <RangeInput
                type="range"
                value={zoom}
                onChange={e => setZoom(e.target.value as any)}
                min={100}
                max={200}
              />
            </Fragment>
          ) : (
            <Fragment>
              <p>{description}</p>
            </Fragment>
          )}

          <Spacer height={50} />
        </div>
      </Main>

      <Buttons>
        <Button
          iconLeft={stage == 'edit' ? <RiCloseLine /> : <RiDeleteBin4Line />}
          variant="outline"
          fullWidth
          disabled={!isOpen || loading || !onReset}
          onClick={() => {
            if (!onReset) return;

            if (stage == 'edit') {
              setIsOpen(false);
            } else {
              setMainVisible(false);
              setLoading(true);

              onReset()
                .catch(() => {})
                .finally(() => {
                  setIsOpen(false);
                  setLoading(false);
                });
            }
          }}
        >
          {stage == 'edit' ? 'Close' : 'Remove'}
        </Button>
        <Button
          iconLeft={stage == 'edit' ? <RiCheckLine /> : <RiFileUploadLine />}
          variant="solid"
          disabled={!isOpen || loading}
          fullWidth
          onClick={() => {
            if (stage == 'edit') {
              if (!editor || !file) return;

              setLoading(true);
              let isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
              let inputFileName = file.name;

              let outputType = isSafari ? 'image/jpeg' : 'image/webp';

              editor.getImage().toBlob(
                blob => {
                  if (!blob) return;

                  let outputFile = new File(
                    [blob],
                    `${getFileBasename(inputFileName)}.${getImageExtension(outputType)}`,
                    {
                      type: outputType,
                      lastModified: Date.now()
                    }
                  );

                  onSave(outputFile)
                    .catch(() => {})
                    .finally(() => {
                      setIsOpen(false);
                      setLoading(false);
                    });
                },
                outputType,
                0.9
              );
            } else {
              open();
            }
          }}
        >
          {stage == 'edit' ? 'Save' : 'Change'}
        </Button>
      </Buttons>
    </Dialog.Wrapper>
  );
};
