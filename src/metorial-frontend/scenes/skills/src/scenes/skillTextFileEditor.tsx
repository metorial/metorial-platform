import { MonacoCodeEditor } from '@metorial/code-editor-monaco';
import { renderWithLoader } from '@metorial/data-hooks';
import { useStoreItem, useStorePermissions } from '@metorial/state';
import { Input, Popover, Spinner, Text, theme } from '@metorial/ui';
import { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { getSkillCodeEditorLanguage } from '../components/textFile';
import {
  skillFileBasename,
  type SkillTextFileItem,
  useSkillTextFile
} from '../components/useSkillTextFile';

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
  padding: 20px;
`;

let SkillTextFileEditorInner = (p: {
  instanceId: string;
  storeId: string;
  itemId: string;
  item: SkillTextFileItem;
  readOnly: boolean;
  onItemChange: () => void;
  setRestrictHeight?: (enabled: boolean) => void;
}) => {
  let textFile = useSkillTextFile(p);
  let [draftName, setDraftName] = useState(skillFileBasename(p.item.path));
  let language = useMemo(
    () => getSkillCodeEditorLanguage(textFile.fileName),
    [textFile.fileName]
  );

  useEffect(() => {
    p.setRestrictHeight?.(true);
    return () => p.setRestrictHeight?.(false);
  }, [p.setRestrictHeight]);

  useEffect(() => {
    setDraftName(textFile.fileName);
  }, [textFile.fileName]);

  let rename = async () => {
    let renamed = await textFile.rename(draftName);
    if (!renamed) setDraftName(textFile.fileName);
  };

  if (textFile.loadError) {
    return (
      <Center>
        <Text color="red600" size="2">
          {textFile.loadError}
        </Text>
      </Center>
    );
  }

  if (textFile.content == null) {
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
            operationKey={textFile.path}
            side="bottom"
            sideOffset={7}
            trigger={
              <NameTrigger disabled={p.readOnly} title={textFile.fileName} type="button">
                {textFile.fileName}
              </NameTrigger>
            }
          >
            <Popover.Content>
              <NamePopover>
                <Input
                  autoFocus
                  disabled={textFile.isRenaming}
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
          <Text color="gray600" size="1">
            File saved automatically
          </Text>
        </HeaderSide>
      </Header>
      <EditorWrap>
        <MonacoCodeEditor
          ariaLabel={`${textFile.fileName} editor`}
          fileName={textFile.fileName}
          language={language}
          onChange={textFile.setContent}
          readOnly={p.readOnly}
          value={textFile.content}
        />
      </EditorWrap>
      <textFile.uploadFile.RenderError />
      <textFile.modifyStoreItems.RenderError />
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

  return renderWithLoader(
    { item, permissions },
    { spaceTop: 20 }
  )(({ item, permissions }) => (
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
