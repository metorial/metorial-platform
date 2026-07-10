import { atom, renderWithLoader, useAtom } from '@metorial/data-hooks';
import {
  StoreItem,
  useAllStoreItems,
  useCreateDocument,
  useModifyStoreItems,
  useStorePermissions,
  useUploadFile
} from '@metorial/state';
import { Box } from '@metorial/ui-product';
import { useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import {
  SkillFileTree,
  SkillFileTreeCreateKind,
  SkillFileTreeNode
} from '../components/fileTree';
import type { SkillSharePanelContext } from '../components/skillSharePanel';

let FileTreeWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
`;

type OptimisticStoreItem = {
  id: string;
  path: string;
  kind: 'file' | 'document' | 'directory';
};

let buildTree = (items: StoreItem[], optimisticItems: OptimisticStoreItem[]) => {
  let nodeMap = new Map<string, SkillFileTreeNode>();
  let realItemPaths = new Set(items.map(item => item.path).filter(Boolean));
  let rootNode: SkillFileTreeNode = {
    id: '/',
    name: 'root',
    path: '/',
    parentPath: null,
    kind: 'directory',
    children: []
  };

  nodeMap.set(rootNode.path, rootNode);

  let ensureNode = (p: {
    path: string;
    name: string;
    parentPath: string | null;
    kind: 'directory' | 'file' | 'document';
    itemId?: string;
    documentId?: string;
    fileId?: string;
    fileType?: string;
    isPending?: boolean;
  }) => {
    let existing = nodeMap.get(p.path);
    if (existing) {
      existing.kind = p.kind;
      existing.itemId = p.itemId ?? existing.itemId;
      existing.documentId = p.documentId ?? existing.documentId;
      existing.fileId = p.fileId ?? existing.fileId;
      existing.fileType = p.fileType ?? existing.fileType;
      existing.isPending = p.isPending ?? existing.isPending;
      return existing;
    }

    let node: SkillFileTreeNode = {
      id: p.path,
      name: p.name,
      path: p.path,
      parentPath: p.parentPath,
      kind: p.kind,
      itemId: p.itemId,
      documentId: p.documentId,
      fileId: p.fileId,
      fileType: p.fileType,
      isPending: p.isPending,
      children: []
    };

    nodeMap.set(node.path, node);

    let parent = p.parentPath ? nodeMap.get(p.parentPath) : rootNode;
    if (parent && !parent.children.some(child => child.path == node.path)) {
      parent.children.push(node);
    }

    return node;
  };

  for (let item of [...items].sort((a, b) => a.path.localeCompare(b.path))) {
    if (!item.path || item.path == '/' || item.path == '.') continue;

    let parts = item.path.split('/').filter(Boolean);
    if (parts.length == 0) continue;

    let parentPath: string | null = '/';
    let currentPath = '';

    for (let i = 0; i < parts.length; i++) {
      let part = parts[i]!;
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      let isLeaf = i == parts.length - 1;

      ensureNode({
        path: currentPath,
        name: part,
        parentPath,
        kind: isLeaf ? item.kind : 'directory',
        itemId: isLeaf ? item.id : undefined,
        documentId: isLeaf ? item.document?.id : undefined,
        fileId: isLeaf ? item.file?.id : undefined,
        fileType: isLeaf ? item.file?.fileType : undefined
      });

      parentPath = currentPath;
    }
  }

  for (let item of optimisticItems) {
    if (realItemPaths.has(item.path)) continue;

    let parts = item.path.split('/').filter(Boolean);
    if (parts.length == 0) continue;

    let parentPath: string | null = '/';
    let currentPath = '';

    for (let i = 0; i < parts.length; i++) {
      let part = parts[i]!;
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      let isLeaf = i == parts.length - 1;

      ensureNode({
        path: currentPath,
        name: part,
        parentPath,
        kind: isLeaf ? item.kind : 'directory',
        isPending: isLeaf
      });

      parentPath = currentPath;
    }
  }

  let sortNodes = (nodes: SkillFileTreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.kind == b.kind) return a.name.localeCompare(b.name);
      if (a.kind == 'directory') return -1;
      if (b.kind == 'directory') return 1;
      if (a.kind == 'document' && b.kind == 'file') return -1;
      if (a.kind == 'file' && b.kind == 'document') return 1;
      return a.name.localeCompare(b.name);
    });

    for (let node of nodes) sortNodes(node.children);
  };

  let nodes = [rootNode];
  sortNodes(nodes);

  return nodes;
};

let getInitialExpandedPaths = (nodes: SkillFileTreeNode[]) =>
  new Set(nodes.filter(node => node.kind == 'directory').map(node => node.path));

let joinStorePath = (parentPath: string, name: string) => {
  let cleanName = name.trim().replace(/^\/+/, '').replace(/\/+$/, '');
  if (parentPath == '/') return cleanName;
  return `${parentPath.replace(/\/+$/, '')}/${cleanName}`;
};

let shouldCreateDocumentForFileName = (name: string) => {
  let normalized = name.trim().toLowerCase();
  let lastDot = normalized.lastIndexOf('.');

  if (lastDot <= 0 || lastDot == normalized.length - 1) return true;

  let extension = normalized.slice(lastDot + 1);
  return extension == 'md' || extension == 'txt';
};

let refetchAtom = atom(0);
export let forceFileTreeRefetch = () => refetchAtom.set(value => value + 1);
let useRefetchOnAtomChange = (cb: () => void) => {
  let cbRef = useRef(cb);
  cbRef.current = cb;

  let atomValue = useAtom(refetchAtom);
  let currentRef = useRef(atomValue);

  useEffect(() => {
    if (currentRef.current !== atomValue) {
      currentRef.current = atomValue;
      cbRef.current();
    }
  }, [atomValue]);
};

let currentStoreHash = atom<string>('0');
export let useCurrentStoreHash = () => useAtom(currentStoreHash);

export let StoreFileViewerScene = (p: {
  instanceId: string | null | undefined;
  storeId: string | null | undefined;
  getDocumentPath: (documentId: string, itemId: string) => string;
  title?: string;
  description?: string;
  readOnly?: boolean;
  shareContext?: SkillSharePanelContext | null;
}) => {
  let storeItems = useAllStoreItems(p.instanceId, p.storeId, {
    order: 'asc',
    type: ['directory', 'document', 'file']
  });
  useRefetchOnAtomChange(() => storeItems.refetch());

  useEffect(() => {
    currentStoreHash.set(
      `${p.storeId}:${storeItems.data
        ?.map(i => i.id + i.updatedAt)
        .sort()
        .join('|')}`
    );
  }, [storeItems.data]);

  let storePermissions = useStorePermissions(p.instanceId, p.storeId);
  let createDocument = useCreateDocument();
  let uploadFile = useUploadFile();
  let modifyStoreItems = useModifyStoreItems();
  let [optimisticItems, setOptimisticItems] = useState<OptimisticStoreItem[]>([]);
  let treeNodes = useMemo(
    () => buildTree(storeItems.data ?? [], optimisticItems),
    [optimisticItems, storeItems.data]
  );
  let [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  let isCreating =
    createDocument.isLoading || uploadFile.isLoading || modifyStoreItems.isLoading;

  let addOptimisticItem = (item: Omit<OptimisticStoreItem, 'id'>) => {
    let id = `pending:${item.path}:${Date.now()}:${Math.random()}`;
    setOptimisticItems(current => [...current, { ...item, id }]);
    return id;
  };

  let removeOptimisticItem = (id: string) => {
    setOptimisticItems(current => current.filter(item => item.id != id));
  };

  let createStoreItem = async (
    parentPath: string,
    kind: SkillFileTreeCreateKind,
    name: string
  ) => {
    if (!p.instanceId || !p.storeId) return;

    let path = joinStorePath(parentPath, name);
    if (kind == 'directory') {
      let optimisticId = addOptimisticItem({ path, kind: 'directory' });

      try {
        await modifyStoreItems.mutate({
          instanceId: p.instanceId,
          storeId: p.storeId,
          operations: [
            {
              type: 'add',
              path
            }
          ]
        });

        await storeItems.refetch();
      } finally {
        removeOptimisticItem(optimisticId);
      }

      return;
    }

    let shouldCreateDocument = kind == 'document' || shouldCreateDocumentForFileName(name);
    let optimisticId = addOptimisticItem({
      path,
      kind: shouldCreateDocument ? 'document' : 'file'
    });

    try {
      if (shouldCreateDocument) {
        let [document] = await createDocument.mutate({
          instanceId: p.instanceId,
          title: name,
          content: ''
        });

        if (!document) return;

        await modifyStoreItems.mutate({
          instanceId: p.instanceId,
          storeId: p.storeId,
          operations: [
            {
              type: 'add',
              documentId: document.id,
              path
            }
          ]
        });
      } else {
        let file = new File([new Blob([''])], name, {
          type: 'application/octet-stream'
        });

        await uploadFile.mutate({
          instanceId: p.instanceId,
          file,
          title: name,
          purpose: 'generic',
          store: {
            id: p.storeId,
            path
          }
        });
      }

      await storeItems.refetch();
    } finally {
      removeOptimisticItem(optimisticId);
    }
  };

  let createStoreFile = async (parentPath: string, file: File) => {
    if (!p.instanceId || !p.storeId) return;

    let path = joinStorePath(parentPath, file.name);
    let shouldCreateDocument = shouldCreateDocumentForFileName(file.name);
    let optimisticId = addOptimisticItem({
      path,
      kind: shouldCreateDocument ? 'document' : 'file'
    });

    try {
      if (shouldCreateDocument) {
        let [document] = await createDocument.mutate({
          instanceId: p.instanceId,
          title: file.name,
          content: await file.text()
        });

        if (!document) return;

        await modifyStoreItems.mutate({
          instanceId: p.instanceId,
          storeId: p.storeId,
          operations: [
            {
              type: 'add',
              documentId: document.id,
              path
            }
          ]
        });
      } else {
        await uploadFile.mutate({
          instanceId: p.instanceId,
          file,
          title: file.name,
          purpose: 'generic',
          store: {
            id: p.storeId,
            path
          }
        });
      }

      await storeItems.refetch();
    } finally {
      removeOptimisticItem(optimisticId);
    }
  };

  let createStoreFiles = async (parentPath: string, files: File[]) => {
    for (let file of files) {
      await createStoreFile(parentPath, file);
    }
  };

  let deleteStoreItem = async (itemId: string) => {
    if (!p.instanceId || !p.storeId) return;

    await modifyStoreItems.mutate({
      instanceId: p.instanceId,
      storeId: p.storeId,
      operations: [
        {
          type: 'remove',
          itemId
        }
      ]
    });

    await storeItems.refetch();
  };

  let renameStoreItem = async (itemId: string, parentPath: string, name: string) => {
    if (!p.instanceId || !p.storeId) return;

    await modifyStoreItems.mutate({
      instanceId: p.instanceId,
      storeId: p.storeId,
      operations: [
        {
          type: 'modify',
          itemId,
          path: joinStorePath(parentPath, name)
        }
      ]
    });

    await storeItems.refetch();
  };

  useEffect(() => {
    if (treeNodes.length == 0) {
      setExpandedPaths(new Set());
      return;
    }

    setExpandedPaths(current =>
      current.size > 0 ? current : getInitialExpandedPaths(treeNodes)
    );
  }, [treeNodes]);

  useEffect(() => {
    if (optimisticItems.length == 0) return;

    let handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [optimisticItems.length]);

  return renderWithLoader({ storeItems, storePermissions })(() => (
    <Box
      title={p.title ?? 'Files'}
      description={
        p.description ??
        'Manage the documents and files in this store. Describe workflows, behaviors, and tasks for agentic workflows.'
      }
    >
      <FileTreeWrap>
        <SkillFileTree
          emptyLabel="This store does not contain any files or documents yet."
          expandedPaths={expandedPaths}
          isCreating={isCreating}
          nodes={treeNodes}
          instanceId={p.instanceId}
          shareContext={p.shareContext}
          canWrite={
            !p.readOnly && !!storePermissions.data?.permissions.includes('content_write')
          }
          onCreate={createStoreItem}
          onDelete={deleteStoreItem}
          onFileSelect={createStoreFile}
          onFilesDrop={createStoreFiles}
          getDocumentPath={p.getDocumentPath}
          onMove={renameStoreItem}
          onRename={renameStoreItem}
          onToggle={path =>
            setExpandedPaths(current => {
              let next = new Set(current);
              if (next.has(path)) next.delete(path);
              else next.add(path);
              return next;
            })
          }
        />
        <createDocument.RenderError />
        <uploadFile.RenderError />
        <modifyStoreItems.RenderError />
      </FileTreeWrap>
    </Box>
  ));
};

export let SkillStoreFileViewerScene = StoreFileViewerScene;
