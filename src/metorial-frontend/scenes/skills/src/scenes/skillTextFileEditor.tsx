import { MonacoCodeEditor } from '@metorial/code-editor-monaco';
import { renderWithLoader } from '@metorial/data-hooks';
import {
  useFile,
  useModifyStoreItems,
  useStoreItem,
  useStorePermissions,
  useUploadFile
} from '@metorial/state';
import { Button, Input, Popover, Spinner, Text, theme, toast } from '@metorial/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { getSkillCodeEditorLanguage } from '../components/textFile';
import { forceFileTreeRefetch } from './skillStoreFileViewer';

let Shell = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: ${theme.colors.background};
`;

let Header = styled.header`
  display: flex;
  align-items: center;
  gap: 8px;
  height: 56px;
  padding: 0 14px;
  border-bottom: 1px solid ${theme.colors.gray300};
  background: ${theme.colors.background};
  flex-shrink: 0;
`;

let HeaderSide = styled.div`
  display: flex;
  flex: 1 1 0;
  align-items: center;
  min-width: 0;

  &:last-child {
    justify-content: flex-end;
  }
`;

let NameTrigger = styled.button`
  display: inline-flex;
  align-items: center;
  height: 30px;
  max-width: 280px;
  padding: 0 8px;
  overflow: hidden;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: ${theme.colors.foreground};
  font: inherit;
  font-size: 13.5px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: ${theme.colors.gray300};
  }

  &:disabled {
    color: ${theme.colors.gray600};
    cursor: default;
  }
`;

let NamePopover = styled.div`
  width: 270px;
`;

let EditorWrap = styled.div`
  flex: 1;
  min-height: 0;
  overflow: hidden;
`;

let Center = styled.div`
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  min-height: 0;
`;

let basename = (path: string) => path.split('/').filter(Boolean).pop() ?? path;
let dirname = (path: string) => {
  let parts = path.split('/').filter(Boolean);
  parts.pop();
  return parts.join('/');
};
let pathWithName = (path: string, name: string) => {
  let parent = dirname(path);
  return parent ? `${parent}/${name}` : name;
};

let SkillTextFileEditorInner = (p: {
  instanceId: string;
  storeId: string;
  itemId: string;
  item: NonNullable<ReturnType<typeof useStoreItem>['data']>;
  readOnly: boolean;
  onItemChange: () => void;
  setRestrictHeight?: (enabled: boolean) => void;
}) => {
  let file = useFile(p.instanceId, p.item.file?.id);
  let uploadFile = useUploadFile();
  let modifyStoreItems = useModifyStoreItems();
  let [content, setContent] = useState<string | null>(null);
  let [savedContent, setSavedContent] = useState('');
  let [path, setPath] = useState(p.item.path);
  let [draftName, setDraftName] = useState(basename(p.item.path));
  let [loadError, setLoadError] = useState<string | null>(null);
  let [isRenaming, setIsRenaming] = useState(false);
  let renameInFlight = useRef(false);
  let savedFileIdRef = useRef<string | null>(null);

  useEffect(() => {
    p.setRestrictHeight?.(true);
    return () => p.setRestrictHeight?.(false);
  }, [p.setRestrictHeight]);

  useEffect(() => {
    setPath(p.item.path);
    setDraftName(basename(p.item.path));
  }, [p.item.path]);

  useEffect(() => {
    let downloadUrl = file.data?.downloadUrl;
    if (!downloadUrl) return;

    if (file.data?.id == savedFileIdRef.current) {
      savedFileIdRef.current = null;
      return;
    }

    let cancelled = false;
    setContent(null);
    setLoadError(null);

    fetch(downloadUrl)
      .then(async response => {
        if (!response.ok) throw new Error(`Failed to load file (${response.status})`);
        return response.text();
      })
      .then(value => {
        if (cancelled) return;
        setContent(value);
        setSavedContent(value);
      })
      .catch(error => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Failed to load file');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [file.data?.downloadUrl]);

  let fileName = basename(path);
  let language = useMemo(() => getSkillCodeEditorLanguage(fileName), [fileName]);
  let isSaving = uploadFile.isLoading || modifyStoreItems.isLoading;

  let rename = async () => {
    let name = draftName.trim();
    if (
      p.readOnly ||
      renameInFlight.current ||
      !name ||
      name.includes('/') ||
      name == fileName
    ) {
      if (!name || name.includes('/')) setDraftName(fileName);
      return;
    }

    let nextPath = pathWithName(path, name);
    renameInFlight.current = true;
    setIsRenaming(true);
    try {
      let [, error] = await modifyStoreItems.mutate({
        instanceId: p.instanceId,
        storeId: p.storeId,
        operations: [{ type: 'modify', itemId: p.itemId, path: nextPath }]
      });
      if (error) throw error;
      setPath(nextPath);
      p.onItemChange();
      forceFileTreeRefetch();
    } catch (error) {
      setDraftName(fileName);
      toast.error(error instanceof Error ? error.message : 'Failed to rename file');
    } finally {
      renameInFlight.current = false;
      setIsRenaming(false);
    }
  };

  let save = async () => {
    if (p.readOnly || content == null || content == savedContent || !p.item.file) return;

    let [uploaded, uploadError] = await uploadFile.mutate({
      instanceId: p.instanceId,
      file: new File([content], fileName, {
        type: p.item.file.fileType || 'text/plain'
      }),
      title: fileName,
      purpose: p.item.file.purpose || 'generic'
    });
    if (uploadError) return;
    if (!uploaded) {
      toast.error('File upload completed without a result');
      return;
    }

    let [, modifyError] = await modifyStoreItems.mutate({
      instanceId: p.instanceId,
      storeId: p.storeId,
      operations: [{ type: 'modify', itemId: p.itemId, fileId: uploaded.id }]
    });
    if (modifyError) return;

    savedFileIdRef.current = uploaded.id;
    setSavedContent(content);
    p.onItemChange();
    forceFileTreeRefetch();
  };

  if (file.error || loadError) {
    return (
      <Center>
        <Text color="red600" size="2">
          {loadError ?? file.error?.message ?? 'Failed to load file'}
        </Text>
      </Center>
    );
  }

  if (content == null) {
    return (
      <Center>
        <Spinner size={20} />
      </Center>
    );
  }

  return (
    <Shell>
      <Header>
        <HeaderSide>
          <Popover
            align="start"
            operationKey={path}
            side="bottom"
            sideOffset={7}
            trigger={
              <NameTrigger disabled={p.readOnly} title={fileName} type="button">
                {fileName}
              </NameTrigger>
            }
          >
            <Popover.Content>
              <NamePopover>
                <Input
                  autoFocus
                  disabled={isRenaming}
                  label="Name"
                  value={draftName}
                  onBlur={() => void rename()}
                  onInput={setDraftName}
                  onKeyDown={event => {
                    if (event.key == 'Enter') {
                      event.preventDefault();
                      void rename();
                    }
                  }}
                />
              </NamePopover>
            </Popover.Content>
          </Popover>
        </HeaderSide>
        <HeaderSide>
          <Button
            disabled={p.readOnly || content == savedContent}
            loading={isSaving}
            onClick={() => void save()}
            size="2"
          >
            Save
          </Button>
        </HeaderSide>
      </Header>
      <EditorWrap>
        <MonacoCodeEditor
          ariaLabel={`${fileName} editor`}
          language={language}
          onChange={setContent}
          readOnly={p.readOnly}
          value={content}
        />
      </EditorWrap>
      <uploadFile.RenderError />
      <modifyStoreItems.RenderError />
    </Shell>
  );
};

export let SkillTextFileEditorScene = (p: {
  instanceId: string | null | undefined;
  storeId: string | null | undefined;
  itemId: string | null | undefined;
  setRestrictHeight?: (enabled: boolean) => void;
}) => {
  let item = useStoreItem(p.instanceId, p.storeId, p.itemId);
  let permissions = useStorePermissions(p.instanceId, p.storeId);

  return renderWithLoader({ item, permissions })(({ item, permissions }) => (
    <SkillTextFileEditorInner
      instanceId={p.instanceId!}
      item={item.data}
      itemId={p.itemId!}
      onItemChange={() => item.refetch()}
      readOnly={
        !permissions.data.hasFullAccess &&
        !permissions.data.permissions.includes('content_write')
      }
      setRestrictHeight={p.setRestrictHeight}
      storeId={p.storeId!}
    />
  ));
};
