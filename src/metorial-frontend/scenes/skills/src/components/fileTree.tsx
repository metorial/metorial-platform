import { ContextMenu, Menu, Spinner, Text, theme } from '@metorial/ui';
import * as RadixCollapsible from '@radix-ui/react-collapsible';
import {
  RiAddLine,
  RiArrowRightSLine,
  RiFile3Line,
  RiFileTextLine,
  RiFolder2Line,
  RiFolderOpenLine,
  RiMore2Line
} from '@remixicon/react';
import type { DragEvent, MouseEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { SkillFilePreviewLightbox } from './filePreviewLightbox';
import type { SkillSharePanelContext } from './skillSharePanel';

export type SkillFileTreeNode = {
  id: string;
  name: string;
  path: string;
  parentPath: string | null;
  kind: 'directory' | 'file' | 'document';
  itemId?: string;
  documentId?: string;
  fileId?: string;
  fileType?: string;
  isPending?: boolean;
  children: SkillFileTreeNode[];
};

let getSkillShareNavigationState = (shareContext?: SkillSharePanelContext | null) =>
  shareContext ? { metorialSkillShare: shareContext } : undefined;

let TreeRoot = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
`;

let TreeItemStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1px;
`;

let TreeRowButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
  flex: 1;
  min-height: 30px;
  padding: 3px 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;

  &:hover {
    background: color-mix(in srgb, ${theme.colors.foreground} 4%, transparent);
  }
`;

let TreeRowLink = styled(Link)`
  display: flex;
  align-items: center;
  gap: 8px;
  align-self: stretch;
  min-width: 0;
  flex: 1;
  color: inherit;
  text-decoration: none;
  border-radius: 6px;

  &:hover {
    color: inherit;
    text-decoration: none;
  }
`;

let TreeRowShell = styled.div<{ $dropTarget?: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 30px;
  padding: 3px 8px;
  border: none;
  border-radius: 6px;
  background: ${p =>
    p.$dropTarget
      ? `color-mix(in srgb, ${theme.colors.blue800} 14%, transparent)`
      : 'transparent'};
  color: inherit;
  transition:
    background 0.2s ease,
    color 0.2s ease;

  &:hover {
    background: ${p =>
      p.$dropTarget
        ? `color-mix(in srgb, ${theme.colors.blue800} 18%, transparent)`
        : `color-mix(in srgb, ${theme.colors.foreground} 4%, transparent)`};
  }
`;

let TreeIndent = styled.div<{ $depth: number }>`
  width: ${p => p.$depth * 10}px;
  flex: 0 0 auto;
`;

let TreeChevron = styled(RiArrowRightSLine)<{ $open: boolean }>`
  flex: 0 0 auto;
  transition: transform 0.2s ease;
  transform: rotate(${p => (p.$open ? 90 : 0)}deg);
  color: color-mix(in srgb, ${theme.colors.foreground} 56%, transparent);
  width: 14px;
  height: 14px;
`;

let TreeIconWrap = styled.span<{ $kind: SkillFileTreeNode['kind'] }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  color: ${p =>
    p.$kind == 'directory'
      ? theme.colors.orange800
      : p.$kind == 'document'
        ? theme.colors.purple800
        : theme.colors.blue800};
`;

let ChevronSpacer = styled.div`
  width: 14px;
  flex: 0 0 auto;
`;

let TreeLabel = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
`;

let TreeAction = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: color-mix(in srgb, ${theme.colors.foreground} 58%, transparent);
  cursor: pointer;
  flex: 0 0 auto;
  transition:
    background 0.2s ease,
    color 0.2s ease;

  &:hover {
    background: color-mix(in srgb, ${theme.colors.foreground} 8%, transparent);
    color: ${theme.colors.foreground};
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
`;

let TreeSpinnerWrap = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex: 0 0 auto;
`;

let TreeNameWrap = styled.div`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

let ChildrenWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1px;
`;

let EmptyState = styled.div`
  min-height: 30px;
  padding: 3px 8px;
`;

let DirectoryMessage = styled.div`
  padding: 3px 8px 3px 34px;
`;

let HiddenFileInput = styled.input`
  display: none;
`;

let CreateInput = styled.input<{ $hasError?: boolean }>`
  width: 100%;
  min-width: 0;
  height: 24px;
  padding: 0 8px;
  border-radius: 6px;
  border: 1px solid
    ${p =>
      p.$hasError
        ? theme.colors.red600
        : `color-mix(in srgb, ${theme.colors.foreground} 18%, transparent)`};
  background: ${theme.colors.background};
  color: ${theme.colors.foreground};
  font: inherit;
  font-size: 13px;
  outline: none;
`;

let CreateInputWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1;
`;

export type SkillFileTreeCreateKind = 'file' | 'document' | 'directory';

let TreeIcon = (p: { kind: SkillFileTreeNode['kind']; open?: boolean }) => {
  if (p.kind == 'directory') {
    return p.open ? <RiFolderOpenLine size={16} /> : <RiFolder2Line size={16} />;
  }

  if (p.kind == 'document') return <RiFileTextLine size={16} />;
  return <RiFile3Line size={16} />;
};

let getDisplayName = (node: SkillFileTreeNode) => {
  if (node.kind != 'directory') return node.name;
  if (node.path == '/') return '/';
  return node.name;
};

let storeItemDragType = 'application/x-metorial-store-item';

type StoreItemDragData = {
  itemId: string;
  path: string;
  parentPath: string;
  name: string;
  kind: 'file' | 'document';
};

let dragEventHasFiles = (e: DragEvent) => Array.from(e.dataTransfer.types).includes('Files');
let dragEventHasStoreItem = (e: DragEvent) =>
  Array.from(e.dataTransfer.types).includes(storeItemDragType);

let isNestedTreeActionClick = (e: MouseEvent) => {
  let target = e.target;
  if (!(target instanceof Element)) return false;

  return !!target.closest(
    'a, button, input, textarea, select, [role="menuitem"], [data-tree-primary-action], [data-tree-action]'
  );
};

let getStoreItemDragData = (e: DragEvent): StoreItemDragData | null => {
  try {
    let raw = e.dataTransfer.getData(storeItemDragType);
    if (!raw) return null;

    let data = JSON.parse(raw) as Partial<StoreItemDragData>;
    if (
      !data.itemId ||
      !data.path ||
      !data.parentPath ||
      !data.name ||
      (data.kind != 'file' && data.kind != 'document')
    ) {
      return null;
    }

    return {
      itemId: data.itemId,
      path: data.path,
      parentPath: data.parentPath,
      name: data.name,
      kind: data.kind
    };
  } catch {
    return null;
  }
};

let NewItemRow = (p: {
  depth: number;
  kind: SkillFileTreeCreateKind;
  disabled?: boolean;
  existingNames: string[];
  onCancel: () => void;
  onCreate: (name: string) => Promise<void>;
}) => {
  let inputRef = useRef<HTMLInputElement | null>(null);
  let [name, setName] = useState('');
  let [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let timeout = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 250);

    return () => clearTimeout(timeout);
  }, []);

  let submit = async () => {
    let trimmed = name.trim();
    if (!trimmed) {
      p.onCancel();
      return;
    }

    let normalizedName = trimmed.toLowerCase();
    let alreadyExists = p.existingNames.some(
      existingName => existingName.trim().toLowerCase() == normalizedName
    );

    if (alreadyExists) {
      setError('A file with this name already exists.');
      inputRef.current?.focus();
      inputRef.current?.select();
      return;
    }

    await p.onCreate(trimmed);
  };

  return (
    <TreeRowShell>
      <TreeIndent $depth={p.depth} />
      <ChevronSpacer />

      <TreeLabel>
        <TreeIconWrap
          $kind={
            p.kind == 'directory' ? 'directory' : p.kind == 'document' ? 'document' : 'file'
          }
        >
          <TreeIcon
            kind={
              p.kind == 'directory' ? 'directory' : p.kind == 'document' ? 'document' : 'file'
            }
          />
        </TreeIconWrap>
        <CreateInputWrap>
          <CreateInput
            $hasError={!!error}
            aria-label={`New ${p.kind} name`}
            disabled={p.disabled}
            onBlur={submit}
            onChange={e => {
              setName(e.target.value);
              setError(null);
            }}
            onKeyDown={e => {
              if (e.key == 'Enter') {
                e.preventDefault();
                submit();
              }

              if (e.key == 'Escape') {
                e.preventDefault();
                p.onCancel();
              }
            }}
            placeholder={
              p.kind == 'directory'
                ? 'New directory'
                : p.kind == 'document'
                  ? 'New document'
                  : 'New file'
            }
            ref={inputRef}
            value={name}
          />
          {error ? (
            <Text color="red600" size="1">
              {error}
            </Text>
          ) : null}
        </CreateInputWrap>
      </TreeLabel>
    </TreeRowShell>
  );
};

let RenameItemRow = (p: {
  depth: number;
  kind: 'file' | 'document';
  name: string;
  existingNames: string[];
  disabled?: boolean;
  onCancel: () => void;
  onRename: (name: string) => Promise<void>;
}) => {
  let inputRef = useRef<HTMLInputElement | null>(null);
  let [name, setName] = useState(p.name);
  let [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let timeout = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 250);

    return () => clearTimeout(timeout);
  }, []);

  let submit = async () => {
    let trimmed = name.trim();
    if (!trimmed || trimmed == p.name) {
      p.onCancel();
      return;
    }

    let normalizedName = trimmed.toLowerCase();
    let alreadyExists = p.existingNames.some(
      existingName => existingName.trim().toLowerCase() == normalizedName
    );

    if (alreadyExists) {
      setError('A file with this name already exists.');
      inputRef.current?.focus();
      inputRef.current?.select();
      return;
    }

    await p.onRename(trimmed);
  };

  return (
    <TreeRowShell>
      <TreeIndent $depth={p.depth} />
      <ChevronSpacer />

      <TreeLabel>
        <TreeIconWrap $kind={p.kind}>
          <TreeIcon kind={p.kind} />
        </TreeIconWrap>
        <CreateInputWrap>
          <CreateInput
            $hasError={!!error}
            aria-label={`Rename ${p.name}`}
            disabled={p.disabled}
            onBlur={submit}
            onChange={e => {
              setName(e.target.value);
              setError(null);
            }}
            onKeyDown={e => {
              if (e.key == 'Enter') {
                e.preventDefault();
                submit();
              }

              if (e.key == 'Escape') {
                e.preventDefault();
                p.onCancel();
              }
            }}
            ref={inputRef}
            value={name}
          />
          {error ? (
            <Text color="red600" size="1">
              {error}
            </Text>
          ) : null}
        </CreateInputWrap>
      </TreeLabel>
    </TreeRowShell>
  );
};

let SkillFileTreeRow = (p: {
  depth: number;
  creatingItem: { parentPath: string; kind: SkillFileTreeCreateKind } | null;
  canWrite: boolean;
  isCreating?: boolean;
  expandedPaths: Set<string>;
  node: SkillFileTreeNode;
  siblingNames: string[];
  onCancelCreate: () => void;
  onCreate: (parentPath: string, kind: SkillFileTreeCreateKind, name: string) => Promise<void>;
  onDelete: (itemId: string) => Promise<void>;
  onFileSelect: (parentPath: string, file: File) => Promise<void>;
  onFilesDrop: (parentPath: string, files: File[]) => Promise<void>;
  getDocumentPath: (documentId: string) => string;
  shareContext?: SkillSharePanelContext | null;
  instanceId: string | null | undefined;
  editingItemPath: string | null;
  onCancelRename: () => void;
  onRename: (itemId: string, parentPath: string, name: string) => Promise<void>;
  onMove: (itemId: string, parentPath: string, name: string) => Promise<void>;
  onStartRename: (path: string) => void;
  onStartCreate: (parentPath: string, kind: SkillFileTreeCreateKind) => void;
  onDragTargetChange: (path: string | null) => void;
  onToggle: (path: string) => void;
  dragTargetPath: string | null;
}) => {
  let navigate = useNavigate();
  let isDirectory = p.node.kind == 'directory';
  let isOpen = p.expandedPaths.has(p.node.path);
  let creatingInDirectory = p.creatingItem?.parentPath == p.node.path;
  let canDelete =
    p.canWrite &&
    !isDirectory &&
    !p.node.isPending &&
    p.node.name != 'SKILL.md' &&
    !!p.node.itemId;
  let documentPath =
    p.node.kind == 'document' && p.node.documentId
      ? p.getDocumentPath(p.node.documentId)
      : null;
  let fileInputRef = useRef<HTMLInputElement | null>(null);
  let previewTriggerRef = useRef<HTMLButtonElement | null>(null);
  let [fileError, setFileError] = useState<string | null>(null);
  let isDropTarget = p.dragTargetPath == p.node.path;
  let isEditing = p.editingItemPath == p.node.path;
  let canDrag =
    p.canWrite && !isDirectory && !p.node.isPending && !!p.node.itemId && !!p.node.parentPath;

  let moveDraggedItem = async (
    e: DragEvent,
    targetParentPath: string,
    existingNames: string[]
  ) => {
    if (!p.canWrite) return false;

    let draggedItem = getStoreItemDragData(e);
    if (!draggedItem) return false;

    e.preventDefault();
    p.onDragTargetChange(null);

    if (draggedItem.parentPath == targetParentPath) return true;

    let alreadyExists = existingNames.some(
      name => name.trim().toLowerCase() == draggedItem.name.trim().toLowerCase()
    );

    if (alreadyExists) {
      setFileError('A file with this name already exists.');
      return true;
    }

    setFileError(null);
    await p.onMove(draggedItem.itemId, targetParentPath, draggedItem.name);
    return true;
  };

  if (!isDirectory) {
    if (isEditing && p.node.itemId && p.node.parentPath) {
      let renameKind: 'file' | 'document' = p.node.kind == 'document' ? 'document' : 'file';

      return (
        <RenameItemRow
          depth={p.depth}
          disabled={p.isCreating}
          existingNames={p.siblingNames.filter(name => name != p.node.name)}
          kind={renameKind}
          name={p.node.name}
          onCancel={p.onCancelRename}
          onRename={name => p.onRename(p.node.itemId!, p.node.parentPath!, name)}
        />
      );
    }

    let dropTargetPath = p.node.parentPath ?? '/';

    let fileRow = (
      <TreeRowShell
        draggable={canDrag}
        onClick={e => {
          if (isNestedTreeActionClick(e)) return;
          if (documentPath) {
            navigate(documentPath, {
              state: getSkillShareNavigationState(p.shareContext)
            });
          } else if (p.node.kind == 'file' && p.node.fileId)
            previewTriggerRef.current?.click();
        }}
        onDragStart={e => {
          if (!canDrag || !p.node.itemId || !p.node.parentPath || p.node.kind == 'directory') {
            return;
          }

          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData(
            storeItemDragType,
            JSON.stringify({
              itemId: p.node.itemId,
              path: p.node.path,
              parentPath: p.node.parentPath,
              name: p.node.name,
              kind: p.node.kind
            } satisfies StoreItemDragData)
          );
        }}
        onDragEnd={() => p.onDragTargetChange(null)}
        onDragEnter={e => {
          if (!p.canWrite) return;
          if (!dragEventHasFiles(e) && !dragEventHasStoreItem(e)) return;
          e.preventDefault();
          p.onDragTargetChange(dropTargetPath);
        }}
        onDragLeave={e => {
          if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
          p.onDragTargetChange(null);
        }}
        onDragOver={e => {
          if (!p.canWrite) return;
          if (!dragEventHasFiles(e) && !dragEventHasStoreItem(e)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = dragEventHasStoreItem(e) ? 'move' : 'copy';
          p.onDragTargetChange(dropTargetPath);
        }}
        onDrop={async e => {
          if (!p.canWrite) return;
          if (await moveDraggedItem(e, dropTargetPath, p.siblingNames)) return;
          if (!dragEventHasFiles(e)) return;
          e.preventDefault();
          p.onDragTargetChange(null);

          let files = Array.from(e.dataTransfer.files);
          if (files.length == 0) return;
          let existingNames = new Set(p.siblingNames.map(name => name.trim().toLowerCase()));
          let acceptedFiles: File[] = [];

          for (let file of files) {
            let normalizedName = file.name.trim().toLowerCase();
            if (existingNames.has(normalizedName)) continue;

            existingNames.add(normalizedName);
            acceptedFiles.push(file);
          }

          if (acceptedFiles.length == 0) return;
          await p.onFilesDrop(dropTargetPath, acceptedFiles);
        }}
      >
        {documentPath ? (
          <TreeRowLink to={documentPath} state={getSkillShareNavigationState(p.shareContext)}>
            <TreeIndent $depth={p.depth} />
            <ChevronSpacer />
            <TreeIconWrap $kind={p.node.kind}>
              <TreeIcon kind={p.node.kind} />
            </TreeIconWrap>
            <TreeNameWrap>
              <Text size="2">{getDisplayName(p.node)}</Text>
            </TreeNameWrap>
          </TreeRowLink>
        ) : p.node.kind == 'file' && p.node.fileId ? (
          <SkillFilePreviewLightbox
            instanceId={p.instanceId}
            fileId={p.node.fileId}
            title={p.node.name}
            triggerRef={previewTriggerRef}
          >
            <TreeIndent $depth={p.depth} />
            <ChevronSpacer />
            <TreeIconWrap $kind={p.node.kind}>
              <TreeIcon kind={p.node.kind} />
            </TreeIconWrap>
            <TreeNameWrap>
              <Text size="2">{getDisplayName(p.node)}</Text>
            </TreeNameWrap>
          </SkillFilePreviewLightbox>
        ) : (
          <TreeLabel>
            <TreeIndent $depth={p.depth} />
            <ChevronSpacer />
            <TreeIconWrap $kind={p.node.kind}>
              <TreeIcon kind={p.node.kind} />
            </TreeIconWrap>
            <TreeNameWrap>
              <Text size="2">{getDisplayName(p.node)}</Text>
            </TreeNameWrap>
          </TreeLabel>
        )}
        {p.node.isPending ? (
          <TreeSpinnerWrap>
            <Spinner size={14} />
          </TreeSpinnerWrap>
        ) : canDelete ? (
          <Menu
            label={`Actions for ${p.node.name}`}
            items={[
              {
                id: 'rename',
                label: 'Rename'
              },
              {
                id: 'delete',
                label: 'Delete'
              }
            ]}
            onItemClick={itemId => {
              if (itemId == 'rename') {
                p.onStartRename(p.node.path);
                return;
              }

              p.onDelete(p.node.itemId!);
            }}
          >
            <TreeAction
              aria-label={`Actions for ${p.node.name}`}
              data-tree-action
              disabled={p.isCreating}
              type="button"
            >
              <RiMore2Line size={16} strokeWidth={2.4} />
            </TreeAction>
          </Menu>
        ) : null}
      </TreeRowShell>
    );

    if (!canDelete) return fileRow;

    return (
      <ContextMenu
        label={`Actions for ${p.node.name}`}
        items={[
          {
            id: 'rename',
            label: 'Rename'
          },
          {
            id: 'delete',
            label: 'Delete'
          }
        ]}
        onItemClick={itemId => {
          if (itemId == 'rename') {
            p.onStartRename(p.node.path);
            return;
          }

          p.onDelete(p.node.itemId!);
        }}
      >
        {fileRow}
      </ContextMenu>
    );
  }

  let startDirectoryAction = (itemId: string) => {
    if (!p.canWrite) return;

    if (!isOpen) p.onToggle(p.node.path);

    if (itemId == 'file') {
      setFileError(null);
      fileInputRef.current?.click();
      return;
    }

    p.onStartCreate(p.node.path, itemId as SkillFileTreeCreateKind);
  };
  let directoryContextMenuItems = p.canWrite
    ? [
        {
          id: 'file',
          label: 'Upload File'
        },
        {
          id: 'document',
          label: 'Create Document'
        },
        {
          id: 'directory',
          label: 'Create Directory'
        }
      ]
    : [];
  let directoryRow = (
    <TreeRowShell
      $dropTarget={isDropTarget}
      onClick={e => {
        if (isNestedTreeActionClick(e)) return;
        p.onToggle(p.node.path);
      }}
      onDragEnter={e => {
        if (!p.canWrite) return;
        if (!dragEventHasFiles(e) && !dragEventHasStoreItem(e)) return;
        e.preventDefault();
        if (!isOpen) p.onToggle(p.node.path);
        p.onDragTargetChange(p.node.path);
      }}
      onDragLeave={e => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        p.onDragTargetChange(null);
      }}
      onDragOver={e => {
        if (!p.canWrite) return;
        if (!dragEventHasFiles(e) && !dragEventHasStoreItem(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = dragEventHasStoreItem(e) ? 'move' : 'copy';
        if (!isOpen) p.onToggle(p.node.path);
        p.onDragTargetChange(p.node.path);
      }}
      onDrop={async e => {
        if (!p.canWrite) return;
        if (
          await moveDraggedItem(
            e,
            p.node.path,
            p.node.children.map(child => child.name)
          )
        ) {
          return;
        }

        if (!dragEventHasFiles(e)) return;
        e.preventDefault();
        p.onDragTargetChange(null);

        let files = Array.from(e.dataTransfer.files);
        if (files.length == 0) return;
        let existingNames = new Set(
          p.node.children.map(child => child.name.trim().toLowerCase())
        );
        let acceptedFiles: File[] = [];
        let rejectedCount = 0;

        for (let file of files) {
          let normalizedName = file.name.trim().toLowerCase();
          if (existingNames.has(normalizedName)) {
            rejectedCount++;
            continue;
          }

          existingNames.add(normalizedName);
          acceptedFiles.push(file);
        }

        if (rejectedCount > 0) {
          setFileError(
            rejectedCount == 1
              ? 'A file with this name already exists.'
              : `${rejectedCount} files already exist in this directory.`
          );
        } else {
          setFileError(null);
        }

        if (acceptedFiles.length == 0) return;
        if (!isOpen) p.onToggle(p.node.path);
        await p.onFilesDrop(p.node.path, acceptedFiles);
      }}
    >
      <TreeRowButton
        onClick={() => p.onToggle(p.node.path)}
        style={{ padding: 0, background: 'transparent' }}
        type="button"
      >
        <TreeIndent $depth={p.depth} />
        <TreeChevron $open={isOpen} />
        <TreeLabel>
          <TreeIconWrap $kind={p.node.kind}>
            <TreeIcon kind={p.node.kind} open={isOpen} />
          </TreeIconWrap>
          <TreeNameWrap>
            <Text size="2">{getDisplayName(p.node)}</Text>
          </TreeNameWrap>
        </TreeLabel>
      </TreeRowButton>

      {p.canWrite ? (
        <>
          <Menu
            label={`Add item to ${getDisplayName(p.node)}`}
            items={[
              {
                id: 'file',
                label: 'Upload File'
              },
              {
                id: 'document',
                label: 'Create Document'
              },
              {
                id: 'directory',
                label: 'Create Directory'
              }
            ]}
            onItemClick={startDirectoryAction}
          >
            <TreeAction data-tree-action type="button">
              <RiAddLine size={16} strokeWidth={2.4} />
            </TreeAction>
          </Menu>
          <HiddenFileInput
            ref={fileInputRef}
            type="file"
            onChange={async e => {
              let file = e.currentTarget.files?.[0];
              e.currentTarget.value = '';
              if (!file) return;

              let alreadyExists = p.node.children.some(
                child => child.name.trim().toLowerCase() == file.name.trim().toLowerCase()
              );

              if (alreadyExists) {
                setFileError('A file with this name already exists.');
                return;
              }

              setFileError(null);
              await p.onFileSelect(p.node.path, file);
            }}
          />
        </>
      ) : null}
    </TreeRowShell>
  );

  return (
    <RadixCollapsible.Root onOpenChange={() => p.onToggle(p.node.path)} open={isOpen}>
      <TreeItemStack>
        {directoryContextMenuItems.length > 0 ? (
          <ContextMenu
            label={`Add item to ${getDisplayName(p.node)}`}
            items={directoryContextMenuItems}
            onItemClick={startDirectoryAction}
          >
            {directoryRow}
          </ContextMenu>
        ) : (
          directoryRow
        )}

        <RadixCollapsible.Content>
          <ChildrenWrap>
            {fileError ? (
              <DirectoryMessage>
                <Text color="red600" size="1">
                  {fileError}
                </Text>
              </DirectoryMessage>
            ) : null}

            {creatingInDirectory ? (
              <NewItemRow
                depth={p.depth + 1}
                disabled={p.isCreating}
                existingNames={p.node.children.map(child => child.name)}
                kind={p.creatingItem!.kind}
                onCancel={p.onCancelCreate}
                onCreate={name => p.onCreate(p.node.path, p.creatingItem!.kind, name)}
              />
            ) : null}

            {p.node.children.length > 0 ? (
              p.node.children.map(child => (
                <SkillFileTreeRow
                  creatingItem={p.creatingItem}
                  canWrite={p.canWrite}
                  depth={p.depth + 1}
                  expandedPaths={p.expandedPaths}
                  isCreating={p.isCreating}
                  key={child.path}
                  node={child}
                  siblingNames={p.node.children.map(child => child.name)}
                  onCancelCreate={p.onCancelCreate}
                  onCreate={p.onCreate}
                  onDelete={p.onDelete}
                  onFileSelect={p.onFileSelect}
                  onFilesDrop={p.onFilesDrop}
                  getDocumentPath={p.getDocumentPath}
                  shareContext={p.shareContext}
                  instanceId={p.instanceId}
                  editingItemPath={p.editingItemPath}
                  onCancelRename={p.onCancelRename}
                  onRename={p.onRename}
                  onMove={p.onMove}
                  onStartRename={p.onStartRename}
                  onStartCreate={p.onStartCreate}
                  onDragTargetChange={p.onDragTargetChange}
                  onToggle={p.onToggle}
                  dragTargetPath={p.dragTargetPath}
                />
              ))
            ) : !creatingInDirectory ? (
              <EmptyState style={{ paddingLeft: `${(p.depth + 1) * 10 + 20}px` }}>
                <Text color="gray600" size="1">
                  Empty directory
                </Text>
              </EmptyState>
            ) : null}
          </ChildrenWrap>
        </RadixCollapsible.Content>
      </TreeItemStack>
    </RadixCollapsible.Root>
  );
};

let SkillFileTreeInner = (p: {
  nodes: SkillFileTreeNode[];
  expandedPaths: Set<string>;
  onToggle: (path: string) => void;
  emptyLabel?: string;
  creatingItem: { parentPath: string; kind: SkillFileTreeCreateKind } | null;
  canWrite: boolean;
  isCreating?: boolean;
  onCancelCreate: () => void;
  onCreate: (parentPath: string, kind: SkillFileTreeCreateKind, name: string) => Promise<void>;
  onDelete: (itemId: string) => Promise<void>;
  onFileSelect: (parentPath: string, file: File) => Promise<void>;
  onFilesDrop: (parentPath: string, files: File[]) => Promise<void>;
  getDocumentPath: (documentId: string) => string;
  shareContext?: SkillSharePanelContext | null;
  instanceId: string | null | undefined;
  editingItemPath: string | null;
  onCancelRename: () => void;
  onRename: (itemId: string, parentPath: string, name: string) => Promise<void>;
  onMove: (itemId: string, parentPath: string, name: string) => Promise<void>;
  onStartRename: (path: string) => void;
  onStartCreate: (parentPath: string, kind: SkillFileTreeCreateKind) => void;
  onDragTargetChange: (path: string | null) => void;
  dragTargetPath: string | null;
}) => {
  return (
    <TreeRoot role="tree">
      {p.nodes.length > 0 ? (
        p.nodes.map(node => (
          <SkillFileTreeRow
            creatingItem={p.creatingItem}
            canWrite={p.canWrite}
            depth={0}
            expandedPaths={p.expandedPaths}
            isCreating={p.isCreating}
            key={node.path}
            node={node}
            siblingNames={p.nodes.map(node => node.name)}
            onCancelCreate={p.onCancelCreate}
            onCreate={p.onCreate}
            onDelete={p.onDelete}
            onFileSelect={p.onFileSelect}
            onFilesDrop={p.onFilesDrop}
            getDocumentPath={p.getDocumentPath}
            shareContext={p.shareContext}
            instanceId={p.instanceId}
            editingItemPath={p.editingItemPath}
            onCancelRename={p.onCancelRename}
            onRename={p.onRename}
            onMove={p.onMove}
            onStartRename={p.onStartRename}
            onStartCreate={p.onStartCreate}
            onDragTargetChange={p.onDragTargetChange}
            onToggle={p.onToggle}
            dragTargetPath={p.dragTargetPath}
          />
        ))
      ) : (
        <EmptyState>
          <Text color="gray600" size="1">
            {p.emptyLabel ?? 'No store items found.'}
          </Text>
        </EmptyState>
      )}
    </TreeRoot>
  );
};

export let SkillFileTree = (p: {
  nodes: SkillFileTreeNode[];
  expandedPaths: Set<string>;
  onToggle: (path: string) => void;
  emptyLabel?: string;
  canWrite: boolean;
  isCreating?: boolean;
  onCreate: (parentPath: string, kind: SkillFileTreeCreateKind, name: string) => Promise<void>;
  onDelete: (itemId: string) => Promise<void>;
  onFileSelect: (parentPath: string, file: File) => Promise<void>;
  onFilesDrop: (parentPath: string, files: File[]) => Promise<void>;
  getDocumentPath: (documentId: string) => string;
  shareContext?: SkillSharePanelContext | null;
  instanceId: string | null | undefined;
  onRename: (itemId: string, parentPath: string, name: string) => Promise<void>;
  onMove: (itemId: string, parentPath: string, name: string) => Promise<void>;
}) => {
  let [creatingItem, setCreatingItem] = useState<{
    parentPath: string;
    kind: SkillFileTreeCreateKind;
  } | null>(null);
  let [dragTargetPath, setDragTargetPath] = useState<string | null>(null);
  let [editingItemPath, setEditingItemPath] = useState<string | null>(null);

  return (
    <SkillFileTreeInner
      creatingItem={creatingItem}
      dragTargetPath={dragTargetPath}
      editingItemPath={editingItemPath}
      emptyLabel={p.emptyLabel}
      expandedPaths={p.expandedPaths}
      canWrite={p.canWrite}
      isCreating={p.isCreating}
      nodes={p.nodes}
      onCancelCreate={() => setCreatingItem(null)}
      onCreate={async (parentPath, kind, name) => {
        setCreatingItem(null);
        await p.onCreate(parentPath, kind, name);
      }}
      onDelete={p.onDelete}
      onFileSelect={p.onFileSelect}
      onFilesDrop={p.onFilesDrop}
      getDocumentPath={p.getDocumentPath}
      shareContext={p.shareContext}
      instanceId={p.instanceId}
      onCancelRename={() => setEditingItemPath(null)}
      onDragTargetChange={setDragTargetPath}
      onRename={async (itemId, parentPath, name) => {
        await p.onRename(itemId, parentPath, name);
        setEditingItemPath(null);
      }}
      onMove={p.onMove}
      onStartRename={path => setEditingItemPath(path)}
      onStartCreate={(parentPath, kind) => setCreatingItem({ parentPath, kind })}
      onToggle={p.onToggle}
    />
  );
};
