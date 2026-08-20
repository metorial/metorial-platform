import { Button, CenteredSpinner, Dialog, Spacer, Spinner, theme } from '@metorial/ui';
import {
  RiCheckLine,
  RiCloseLine,
  RiDeleteBin4Line,
  RiFileUploadLine
} from '@remixicon/react';
import clsx from 'clsx';
import { Fragment, useEffect, useState } from 'react';
import Editor from 'react-avatar-editor';
import { useDropzone } from 'react-dropzone';
import { useMeasure, useWindowSize } from 'react-use';
import styled from 'styled-components';

let Wrapper = styled.div`
  display: flex;
  gap: 25px;
`;

let Image = styled.figure`
  width: 120px;
  aspect-ratio: 1 / 1;
  border-radius: 50%;
  overflow: hidden;
  position: relative;
  display: flex;
  transition: all 0.3s;
  background: #efefef;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .loading {
    position: absolute;
    inset: 0;
    display: flex;
    justify-content: center;
    align-items: center;
  }
  &:hover {
    box-shadow: 0 0 0 5px ${theme.colors.primary};
    background: ${theme.colors.primary};
  }
`;

let Actions = styled.div`
  display: flex;
  align-items: center;
  gap: 15px;
  flex-wrap: wrap;
`;

let EditorWrapper = styled.figure`
  width: fit-content;
  margin: 15px auto 0;
  overflow: hidden;
  position: relative;
`;

let DialogAvatar = styled.figure`
  height: 300px;
  width: 300px;
  border-radius: 50%;
  margin: 35px auto 14px;
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

let Circle = styled.div`
  position: absolute;
  inset: -3px;
  box-shadow: 0 0 0 3px ${theme.colors.primary};
  border-radius: 50%;
`;

let DropIndicator = styled.div`
  position: absolute;
  inset: 0;
  box-shadow: 0 0 0 5px ${theme.colors.primary};
  background: rgba(255, 255, 255, 0.7);
  border-radius: 50%;
  transition: all 0.3s;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;

  p {
    font-weight: 600;
    font-size: 1.4em;
    text-align: center;
    line-height: 1;
  }
  &:not(.active) {
    opacity: 0;
  }
`;

let SpinnerWrapper = styled.div`
  position: absolute;
  top: calc(50% - 15px);
  left: calc(50% - 15px);
  display: flex;
`;

let Main = styled.main`
  text-align: center;
  max-width: 390px;
  margin: 0 auto;
  overflow: hidden;
  transition: all 0.3s;
  .inner {
    padding: 0 20px;
    display: flex;
    flex-direction: column;
  }
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
`;

let Buttons = styled.footer`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
`;

let RangeInput = styled.input`
  margin-top: 30px;
  -webkit-appearance: none;
  width: 100%;
  height: 5px;
  border-radius: 5px;
  background: ${theme.colors.gray300};
  outline: none;
  opacity: 0.7;
  &::-webkit-slider-thumb {
    -webkit-appearance: none;
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

export let AvatarUploader = (d: {
  imageUrl: string;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  isLoading: boolean;
  onUpload: (file: Blob) => Promise<unknown>;
  onRemove?: () => Promise<unknown>;
  title: string;
  description: string;
  uploadLabel: string;
}) => {
  let [stage, setStage] = useState<'overview' | 'edit'>('overview');
  let [zoom, setZoom] = useState(100);
  let [file, setFile] = useState<File>();
  let [editor, setEditor] = useState<Editor>();
  let [cachedImageUrl, setCachedImageUrl] = useState(d.imageUrl);
  let { width } = useWindowSize();
  let [mainInnerRef, { height }] = useMeasure();
  let avatarSize = width > 600 ? 300 : width * 0.5;

  let { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
    multiple: false,
    disabled: d.isLoading || stage != 'overview',
    onDrop: acceptedFiles => {
      if (acceptedFiles[0]) {
        setFile(acceptedFiles[0]);
        setStage('edit');
      }
    }
  });

  useEffect(() => {
    if (!d.isOpen) setCachedImageUrl(d.imageUrl);
  }, [d.imageUrl, d.isOpen]);

  useEffect(() => {
    if (d.isOpen) {
      setStage('overview');
      setZoom(100);
      setFile(undefined);
    }
  }, [d.isOpen]);

  let remove = async () => {
    if (!d.onRemove) return;
    try {
      await d.onRemove();
      d.setIsOpen(false);
    } catch {}
  };

  let save = () => {
    if (!editor) return;
    let isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    editor.getImage().toBlob(
      blob => {
        if (!blob) return;
        d.onUpload(blob)
          .then(() => d.setIsOpen(false))
          .catch(() => {});
      },
      isSafari ? 'image/jpeg' : 'image/webp',
      0.9
    );
  };

  return (
    <Wrapper>
      <Image onClick={() => d.setIsOpen(true)}>
        <img src={d.imageUrl} alt="Current avatar" />
        {d.isLoading && (
          <div className="loading">
            <CenteredSpinner />
          </div>
        )}
      </Image>

      <Actions>
        {d.onRemove ? (
          <Button
            type="button"
            variant="outline"
            disabled={d.isLoading}
            onClick={() => {
              let onRemove = d.onRemove;
              if (onRemove) void onRemove();
            }}
          >
            Remove
          </Button>
        ) : null}

        <Button
          type="button"
          variant="outline"
          disabled={d.isLoading}
          onClick={() => d.setIsOpen(true)}
        >
          {d.uploadLabel}
        </Button>

        <Dialog.Wrapper isOpen={d.isOpen} onOpenChange={d.setIsOpen}>
          <input {...getInputProps()} />
          {stage == 'edit' && file ? (
            <EditorWrapper>
              <div style={{ opacity: d.isLoading ? 0.5 : 1, transition: 'all .3s' }}>
                <Editor
                  ref={e => setEditor(e as any)}
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
              {d.isLoading && (
                <SpinnerWrapper>
                  <Spinner size={30} />
                </SpinnerWrapper>
              )}
            </EditorWrapper>
          ) : (
            <DialogAvatar
              {...getRootProps()}
              onClick={open}
              style={{ width: avatarSize, height: avatarSize }}
              className={clsx({ loading: d.isLoading })}
            >
              <img src={cachedImageUrl} alt="Current avatar" />
              {d.isLoading && (
                <SpinnerWrapper>
                  <Spinner size={30} />
                </SpinnerWrapper>
              )}

              <DropIndicator className={clsx({ active: isDragActive })}>
                <p>Drop to upload</p>
              </DropIndicator>

              <Circle />
            </DialogAvatar>
          )}

          <Main style={{ height: height == 0 ? undefined : height }}>
            <div className="inner" ref={mainInnerRef as any}>
              <Spacer height={stage == 'edit' ? 10 : 40} />
              <h1>{d.title}</h1>
              {stage == 'edit' ? (
                <Fragment>
                  <p>Crop this image to fit.</p>
                  <RangeInput
                    type="range"
                    value={zoom}
                    onChange={e => setZoom(Number(e.target.value))}
                    min={100}
                    max={200}
                  />
                </Fragment>
              ) : (
                <p>{d.description}</p>
              )}
              <Spacer height={50} />
            </div>
          </Main>

          <Buttons>
            <Button
              type="button"
              iconLeft={stage == 'edit' ? <RiCloseLine /> : <RiDeleteBin4Line />}
              variant="outline"
              fullWidth
              disabled={d.isLoading || (stage == 'overview' && !d.onRemove)}
              onClick={() => (stage == 'edit' ? d.setIsOpen(false) : void remove())}
            >
              {stage == 'edit' ? 'Close' : 'Remove'}
            </Button>
            <Button
              type="button"
              iconLeft={stage == 'edit' ? <RiCheckLine /> : <RiFileUploadLine />}
              variant="solid"
              fullWidth
              disabled={d.isLoading}
              onClick={() => (stage == 'edit' ? save() : open())}
            >
              {stage == 'edit' ? 'Save' : 'Change'}
            </Button>
          </Buttons>
        </Dialog.Wrapper>
      </Actions>
    </Wrapper>
  );
};
