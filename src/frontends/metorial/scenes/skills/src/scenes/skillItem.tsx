import { renderWithLoader } from '@metorial/data-hooks';
import { useStoreItem, useStorePermissions } from '@metorial/state';
import type { ReactNode } from 'react';
import { getSkillFileKind } from '../components/textFile';
import { useSkillWorkspace } from '../components/workspace/context';
import { SkillFileView } from '../components/workspace/fileViews';
import { SkillTextFileEditorScene } from './skillTextFileEditor';

export let SkillItemScene = (p: {
  instanceId: string | null | undefined;
  storeId: string | null | undefined;
  itemId: string | null | undefined;
  renderDocument: (documentId: string | undefined) => ReactNode;
  setRestrictHeight?: (enabled: boolean) => void;
}) => {
  let workspace = useSkillWorkspace();
  let item = useStoreItem(p.instanceId, p.storeId, p.itemId);
  let permissions = useStorePermissions(p.instanceId, p.storeId);

  return renderWithLoader(
    { item, permissions },
    { spaceTop: 20 }
  )(({ item, permissions }) => {
    if (item.data.kind != 'file' || !item.data.file) {
      return p.renderDocument(item.data.document?.id);
    }

    let readOnly =
      !permissions.data.hasFullAccess &&
      !permissions.data.permissions.includes('content_write');
    let kind = getSkillFileKind({
      fileName: item.data.path,
      fileType: item.data.file.fileType
    });

    if (!workspace && kind == 'code') {
      return (
        <SkillTextFileEditorScene
          instanceId={p.instanceId}
          storeId={p.storeId}
          itemId={item.data.id}
          setRestrictHeight={p.setRestrictHeight}
        />
      );
    }

    return (
      <SkillFileView
        instanceId={p.instanceId!}
        storeId={p.storeId!}
        itemId={item.data.id}
        item={item.data}
        readOnly={readOnly}
        onItemChange={() => item.refetch()}
      />
    );
  });
};
