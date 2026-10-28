import { SkillAssistantDock } from '@metorial/scene-assistant';
import {
  DocumentEditorChromeProvider,
  SkillAssistantWorkspaceProvider,
  useAllProviderListings,
  useAllSkillItems,
  useAllStoreItems,
  useCreateDocument,
  useDocumentEditorChrome,
  prefetchDocument,
  prefetchStoreItem,
  useModifyStoreItems,
  useSkillAgents,
  useSkillMergeRequests,
  useUploadFile,
  type SkillItem
} from '@metorial/state';
import {
  Avatar,
  FloatingBar,
  FloatingBarSeparator,
  type FloatingMenuItem,
  FloatingMenuRow,
  FloatingMenuRowLabel,
  FloatingSegmented,
  NavIconButton,
  Panel,
  snackbar,
  SnackbarViewport,
  theme
} from '@metorial/ui';
import {
  RiAddLine,
  RiApps2Line,
  RiArrowLeftDownLine,
  RiArrowRightSLine,
  RiArrowRightUpLine,
  RiCloseLine,
  RiContractUpDownLine,
  RiDownload2Line,
  RiEditLine,
  RiExpandLeftRightLine,
  RiExpandUpDownLine,
  RiExternalLinkLine,
  RiEyeOffLine,
  RiFileAddLine,
  RiFileCopyLine,
  RiFileList3Line,
  RiFolderLine,
  RiFontSize2,
  RiGitMergeLine,
  RiGitPullRequestLine,
  RiHistoryLine,
  RiImageLine,
  RiInformationLine,
  RiKeyboardLine,
  RiLayoutColumnLine,
  RiLayoutLeft2Line,
  RiLayoutLeftLine,
  RiLayoutRightLine,
  RiLinkM,
  RiListCheck,
  RiMarkdownLine,
  RiPlugLine,
  RiPushpinLine,
  RiQuillPenLine,
  RiRefreshLine,
  RiRobot2Line,
  RiSettings3Line,
  RiSideBarLine,
  RiSparkling2Line,
  RiToolsLine,
  RiUpload2Line
} from '@remixicon/react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useOutlet } from 'react-router-dom';
import styled from 'styled-components';
import { SkillSharePopover, type SkillSharePanelContext } from '../components/skillSharePanel';
import {
  PanelColumn,
  PanelDock,
  WorkspaceSidebar,
  type WorkspaceSectionEntry
} from '../components/workspace/containers';
import {
  buildFileEntries,
  isSkillDocumentPath,
  normalizeStorePath,
  type WorkspaceFileEntry,
  WorkspaceFileIcon
} from '../components/workspace/files';
import { SkillWorkspaceContext } from '../components/workspace/context';
import { DocumentIconRow } from '../components/workspace/documentIconRow';
import { IconPicker, type SkillImageChange } from '../components/workspace/iconPicker';
import { useWorkspaceLayout } from '../components/workspace/layout';
import { workspaceEase } from '../components/workspace/motion';
import {
  type ActiveWorkspaceFile,
  WorkspaceNavLeft,
  WorkspaceNavRight
} from '../components/workspace/nav';
import {
  useWorkspacePreferences,
  type WorkspacePanelId,
  type WorkspacePanelMode,
  type WorkspacePanelPosition
} from '../components/workspace/preferences';
import {
  SectionEmpty,
  SectionFooter,
  SectionGroupLabel,
  SectionLinkButton,
  SectionList,
  SectionRow,
  SectionRowMain,
  SectionRowMeta,
  SectionRowTitle,
  WorkspaceSection,
  type WorkspaceSectionVariant
} from '../components/workspace/section';
import {
  SkillIconTile,
  type SkillImageSelection
} from '../components/workspace/skillIconTile';
import { showSkillAgentFormModal } from './skillAgents';
import { showSkillItemPickerPanel, type SkillItemPickerKind } from './skillLinkProviders';
import {
  forceFileTreeRefetch,
  SkillStoreFileTree,
  useCurrentStoreHash
} from './skillStoreFileViewer';

export type SkillWorkspaceRoutes = {
  overview: string;
  mergeRequests: string;
  mergeRequest: (mergeRequestId: string) => string;
  document: (documentId: string, itemId: string) => string;
  agent: (documentId: string) => string;
  providers: string;
  agents: string;
  settings: string;
  groups: string;
};

export type SkillWorkspaceFork = {
  onRequestMerge?: (() => void) | null;
  onSync?: (() => void) | null;
  parentHref?: string | null;
  parentName?: string | null;
  hasChanges?: boolean;
};

export type SkillWorkspaceLayoutProps = {
  instanceId: string | null | undefined;
  skill: {
    id: string;
    name: string;
    storeId: string | null | undefined;
    visibility?: string | null;
    imageUrl?: string | null;
    image?: SkillImageSelection | null;
  };
  routes: SkillWorkspaceRoutes;
  children?: ReactNode;
  defaultCanvas?: ReactNode;
  workspaceLabel?: string | null;
  backPath?: string | null;
  onDuplicate?: (() => void) | null;
  onExport?: (() => void) | null;
  exportLoading?: boolean;
  fork?: SkillWorkspaceFork | null;
  shareContext?: SkillSharePanelContext | null;
  allowedProviderIds?: string[];
  allowedIntegrationIds?: string[];
  allowProviders?: boolean;
  readOnly?: boolean;
  onNameChange?: (name: string) => Promise<void>;
  onImageChange?: (input: SkillWorkspaceImageInput) => Promise<void>;
};

export type SkillWorkspaceImageInput =
  { imageIcon: { icon: string; color: string } | null } | { imageFileId: string | null };

let Root = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: ${theme.colors.background};
  isolation: isolate;
`;

let Canvas = styled.main<{ $document: boolean }>`
  position: absolute;
  inset: 0;
  overflow: ${({ $document }) => ($document ? 'hidden' : 'auto')};
  padding: ${({ $document }) =>
    $document
      ? '0'
      : 'var(--canvas-top, 104px) var(--canvas-right, 48px) var(--assistant-h, 120px) var(--canvas-left, 48px)'};
  box-sizing: border-box;
  isolation: isolate;
  transition: padding 0.3s ${workspaceEase};
`;

let ToolbarSlot = styled.div<{ $visible: boolean }>`
  position: absolute;
  top: var(--toolbar-top, 14px);
  left: calc(50% + var(--canvas-center-shift, 0px));
  z-index: 39;
  max-width: calc(100% - 24px);
  opacity: ${({ $visible }) => ($visible ? 1 : 0)};
  pointer-events: ${({ $visible }) => ($visible ? 'auto' : 'none')};
  transform: translate(-50%, ${({ $visible }) => ($visible ? '0' : '-10px')})
    scale(${({ $visible }) => ($visible ? 1 : 0.98)});
  transition:
    top 0.3s ${workspaceEase},
    left 0.3s ${workspaceEase},
    opacity 0.22s ${workspaceEase},
    transform 0.32s ${workspaceEase};

  > div {
    max-width: 100%;
    overflow-x: auto;
    scrollbar-width: none;
  }
`;

let RoutePanelBody = styled.div`
  position: relative;
  box-sizing: border-box;
  min-height: 100%;
  padding: 28px 32px 48px;
`;

let RoutePanelClose = styled.div`
  position: sticky;
  top: 12px;
  z-index: 2;
  display: flex;
  justify-content: flex-end;
  height: 0;
  margin-right: -16px;
  margin-top: -16px;
`;

let SidebarFooterRow = styled(SectionRow)`
  svg {
    flex: 0 0 auto;
    width: 16px;
    height: 16px;
    color: ${theme.colors.gray650};
  }
`;

let RowIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: ${theme.colors.gray250};
  color: ${theme.colors.gray700};

  svg {
    width: 13px;
    height: 13px;
  }
`;

let FileTreeHost = styled.div`
  padding: 0 4px 6px;
`;

let IconButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 30px;
  height: 30px;
  margin-left: 2px;
  padding: 4px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: ${theme.colors.gray250};
  }

  &:disabled {
    cursor: default;
  }
`;

let sectionMeta: Record<WorkspacePanelId, { title: string; icon: ReactNode }> = {
  files: { title: 'Files', icon: <RiFileList3Line /> },
  mergeRequests: { title: 'Merge requests', icon: <RiGitPullRequestLine /> },
  providers: { title: 'Providers', icon: <RiPlugLine /> },
  agents: { title: 'Agents', icon: <RiRobot2Line /> }
};

let routePath = (route: string) => route.split(/[?#]/)[0]?.replace(/\/+$/, '') || '/';

let isRouteActive = (pathname: string, route: string, exact = false) => {
  let target = routePath(route);
  let current = pathname.replace(/\/+$/, '') || '/';
  return exact ? current == target : current == target || current.startsWith(`${target}/`);
};

let routePrefix = (build: (marker: string) => string) => {
  let marker = '__workspace_marker__';
  let built = routePath(build(marker));
  let index = built.indexOf(marker);
  return index == -1 ? null : built.slice(0, index);
};

let getLinkedItemName = (item: SkillItem) => {
  if (item.type == 'provider' && item.provider) {
    return item.provider.name ?? item.provider.slug;
  }
  if (item.integration) return item.integration.name ?? item.integration.slug;
  return item.id;
};

let formatRelative = (value: Date | string) => {
  let date = typeof value == 'string' ? new Date(value) : value;
  let minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  let hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  let days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
};

let segmentedItem = <T extends string>(d: {
  id: string;
  icon: ReactNode;
  label: string;
  value: T;
  options: { value: T; label?: string; icon?: ReactNode; tooltip?: string }[];
  onChange: (value: T) => void;
}): FloatingMenuItem => ({
  type: 'custom',
  id: d.id,
  render: () => (
    <FloatingMenuRow>
      {d.icon}
      <FloatingMenuRowLabel>{d.label}</FloatingMenuRowLabel>
      <FloatingSegmented value={d.value} options={d.options} onChange={d.onChange} />
    </FloatingMenuRow>
  )
});

let modeOptions: { value: WorkspacePanelMode; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' }
];

let positionOptions: { value: WorkspacePanelPosition; icon: ReactNode; tooltip: string }[] = [
  { value: 'left', icon: <RiLayoutLeftLine size={15} />, tooltip: 'Left' },
  { value: 'right', icon: <RiLayoutRightLine size={15} />, tooltip: 'Right' },
  { value: 'split', icon: <RiLayoutColumnLine size={15} />, tooltip: 'Split' },
  { value: 'dock', icon: <RiLayoutLeft2Line size={15} />, tooltip: 'Icons only' },
  { value: 'sidebar', icon: <RiSideBarLine size={15} />, tooltip: 'Sidebar' }
];

let useUntitledDocument = (d: {
  instanceId: string | null | undefined;
  storeId: string | null | undefined;
  existingPaths: string[];
  onCreated: (item: { id: string; documentId: string }) => void;
}) => {
  let createDocument = useCreateDocument();
  let modifyStoreItems = useModifyStoreItems();

  return async () => {
    if (!d.instanceId || !d.storeId) return;

    let taken = new Set(d.existingPaths.map(path => normalizeStorePath(path).toLowerCase()));
    let name = 'Untitled.md';
    for (let i = 2; taken.has(name.toLowerCase()); i++) name = `Untitled ${i}.md`;

    let [document, documentError] = await createDocument.mutate({
      instanceId: d.instanceId,
      title: name.replace(/\.md$/, ''),
      content: ''
    });
    if (!document || documentError) {
      snackbar.error('Could not create document');
      return;
    }

    let [result, modifyError] = await modifyStoreItems.mutate({
      instanceId: d.instanceId,
      storeId: d.storeId,
      operations: [{ type: 'add', documentId: document.id, path: name }]
    });
    if (modifyError) {
      snackbar.error('Could not create document');
      return;
    }

    forceFileTreeRefetch();

    let items = (result as { items?: { id: string; path: string }[] } | undefined)?.items;
    let item = items?.find(entry => normalizeStorePath(entry.path) == name);
    if (item) d.onCreated({ id: item.id, documentId: document.id });
  };
};

let useLingering = (value: boolean, ms: number) => {
  let [lingered, setLingered] = useState(value);

  useEffect(() => {
    if (value) {
      setLingered(true);
      return;
    }

    let timer = setTimeout(() => setLingered(false), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);

  return value || lingered;
};

let WorkspaceInner = (p: SkillWorkspaceLayoutProps & { assistantHeight: number }) => {
  let location = useLocation();
  let navigate = useNavigate();
  let chrome = useDocumentEditorChrome();
  let prefs = useWorkspacePreferences(p.skill.id);

  let rootRef = useRef<HTMLDivElement>(null);
  let navLeftRef = useRef<HTMLDivElement>(null);
  let navRightRef = useRef<HTMLDivElement>(null);
  let toolbarRef = useRef<HTMLDivElement>(null);
  let [switcherOpen, setSwitcherOpen] = useState(false);
  let [iconPickerOpen, setIconPickerOpen] = useState(false);
  let [filePaneCount, setFilePaneCount] = useState(0);
  let registerFilePane = useCallback(() => {
    setFilePaneCount(count => count + 1);
    return () => setFilePaneCount(count => count - 1);
  }, []);
  let [optimisticImage, setOptimisticImage] = useState<{
    image: SkillImageSelection;
    imageUrl: string | null;
  } | null>(null);
  let uploadFile = useUploadFile();

  useEffect(() => {
    setOptimisticImage(null);
  }, [p.skill.image?.type, p.skill.image?.icon, p.skill.image?.color, p.skill.imageUrl]);

  let skillImage = optimisticImage?.image ?? p.skill.image ?? null;
  let skillImageUrl = optimisticImage ? optimisticImage.imageUrl : (p.skill.imageUrl ?? null);

  let changeImage = async (change: SkillImageChange) => {
    if (!p.onImageChange || !p.instanceId) return;

    try {
      if (change.type == 'icon') {
        setOptimisticImage({
          image: { type: 'icon', icon: change.icon, color: change.color },
          imageUrl: null
        });
        await p.onImageChange({ imageIcon: { icon: change.icon, color: change.color } });
      }

      if (change.type == 'remove') {
        setOptimisticImage({ image: { type: 'default' }, imageUrl: null });
        await p.onImageChange({ imageIcon: null });
      }

      if (change.type == 'upload') {
        let [file, error] = await uploadFile.mutate({
          instanceId: p.instanceId,
          file: change.file,
          purpose: 'skill_image'
        });
        if (!file || error) throw error ?? new Error('Upload failed');

        setOptimisticImage({
          image: { type: 'file' },
          imageUrl: URL.createObjectURL(change.file)
        });
        await p.onImageChange({ imageFileId: file.id });
      }
    } catch {
      setOptimisticImage(null);
      snackbar.error('Could not update the skill icon');
    }
  };

  let skillItems = useAllSkillItems(p.instanceId, p.skill.id, {
    order: 'asc',
    status: ['active']
  });
  let skillAgents = useSkillAgents(p.instanceId, p.skill.id, { order: 'asc' });
  let outgoingMergeRequests = useSkillMergeRequests(p.instanceId, {
    sourceSkillId: p.skill.id,
    status: 'open',
    order: 'desc'
  });
  let incomingMergeRequests = useSkillMergeRequests(p.instanceId, {
    targetSkillId: p.skill.id,
    status: 'open',
    order: 'desc'
  });
  let recentOutgoingMergeRequests = useSkillMergeRequests(p.instanceId, {
    sourceSkillId: p.skill.id,
    status: ['merged', 'closed'],
    order: 'desc',
    limit: 5
  });
  let recentIncomingMergeRequests = useSkillMergeRequests(p.instanceId, {
    targetSkillId: p.skill.id,
    status: ['merged', 'closed'],
    order: 'desc',
    limit: 5
  });
  let storeItems = useAllStoreItems(p.instanceId, p.skill.storeId, {
    order: 'asc',
    type: ['directory', 'document', 'file']
  });
  let storeHash = useCurrentStoreHash();

  useEffect(() => {
    if (storeHash != '0') storeItems.refetch();
  }, [storeHash]);

  let linkedItems = skillItems.data ?? [];
  let linkedProviderIds = linkedItems.flatMap(item =>
    item.type == 'provider' && item.provider ? [item.provider.id] : []
  );
  let linkedIntegrationIds = linkedItems.flatMap(item =>
    item.type == 'integration' && item.integration ? [item.integration.id] : []
  );
  let providerListings = useAllProviderListings(p.instanceId, linkedProviderIds);
  let agents = skillAgents.data?.items ?? [];

  let dedupe = <T extends { id: string }>(items: T[]) =>
    items.filter((item, index, all) => all.findIndex(other => other.id == item.id) == index);

  let openMergeRequests = dedupe([
    ...(outgoingMergeRequests.data?.items ?? []),
    ...(incomingMergeRequests.data?.items ?? [])
  ]);
  let weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  let recentMergeRequests = dedupe([
    ...(recentOutgoingMergeRequests.data?.items ?? []),
    ...(recentIncomingMergeRequests.data?.items ?? [])
  ]).filter(request => new Date(request.updatedAt).getTime() > weekAgo);

  let fileEntries = useMemo(
    () => buildFileEntries(storeItems.data ?? [], p.routes.document),
    [storeItems.data, p.routes.document]
  );
  let agentEntries: WorkspaceFileEntry[] = agents.map(agent => ({
    id: agent.id,
    name: agent.name,
    path: agent.name,
    kind: 'agent',
    depth: 0,
    href: p.routes.agent(agent.documentId),
    documentId: agent.documentId
  }));

  let outlet = useOutlet();
  let isMergeRequestRoute = isRouteActive(location.pathname, p.routes.mergeRequests);
  let panelRoute: 'page' | 'mergeRequest' | null = isMergeRequestRoute
    ? 'mergeRequest'
    : [p.routes.settings, p.routes.groups, p.routes.providers, p.routes.agents].some(route =>
          isRouteActive(location.pathname, route, true)
        )
      ? 'page'
      : null;

  let canvasCacheRef = useRef<{ element: ReactNode; pathname: string; href: string } | null>(
    null
  );
  if (!panelRoute) {
    canvasCacheRef.current = {
      element: outlet ?? p.children,
      pathname: location.pathname,
      href: location.pathname + location.search + location.hash
    };
  }
  let canvasElement = panelRoute
    ? (canvasCacheRef.current?.element ?? p.defaultCanvas ?? null)
    : (outlet ?? p.children);
  let canvasPathname = panelRoute
    ? (canvasCacheRef.current?.pathname ?? routePath(p.routes.overview))
    : location.pathname;

  let panelContentRef = useRef<ReactNode>(null);
  let panelKindRef = useRef<'page' | 'mergeRequest'>('page');
  if (panelRoute) {
    panelContentRef.current = outlet ?? p.children;
    panelKindRef.current = panelRoute;
  }
  let closePanelRoute = () => navigate(canvasCacheRef.current?.href ?? p.routes.overview);

  let documentPrefix = routePrefix(marker => p.routes.document(marker, marker));
  let agentPrefix = routePrefix(marker => p.routes.agent(marker));
  let isOverview = isRouteActive(canvasPathname, p.routes.overview, true);
  let isDocumentRoute =
    isOverview ||
    (!!documentPrefix && canvasPathname.startsWith(documentPrefix)) ||
    (!!agentPrefix && canvasPathname.startsWith(agentPrefix));

  let mainEntry = fileEntries.find(entry => entry.isMain);
  let activeEntry =
    [...fileEntries, ...agentEntries].find(
      entry => entry.href && isRouteActive(canvasPathname, entry.href, true)
    ) ?? mainEntry;
  let activeHref = isOverview ? (mainEntry?.href ?? null) : (activeEntry?.href ?? null);
  let activeFile: ActiveWorkspaceFile = activeEntry
    ? { key: activeEntry.id, name: activeEntry.name, kind: activeEntry.kind }
    : { key: 'skill', name: 'SKILL.md', kind: 'document' };

  let createUntitledDocument = useUntitledDocument({
    instanceId: p.instanceId,
    storeId: p.skill.storeId,
    existingPaths: (storeItems.data ?? []).map(item => item.path),
    onCreated: item => navigate(p.routes.document(item.documentId, item.id))
  });

  let addProvider = (kind: SkillItemPickerKind) => {
    if (!p.instanceId || p.readOnly) return;

    showSkillItemPickerPanel({
      kind,
      instanceId: p.instanceId,
      skillId: p.skill.id,
      excludeProviderIds: linkedProviderIds,
      excludeIntegrationIds: linkedIntegrationIds,
      allowedProviderIds: p.allowedProviderIds,
      allowedIntegrationIds: p.allowedIntegrationIds,
      onComplete: () => skillItems.refetch()
    });
  };

  let addAgent = () => {
    if (!p.instanceId || p.readOnly) return;

    showSkillAgentFormModal({
      mode: 'create',
      instanceId: p.instanceId,
      skillId: p.skill.id,
      onComplete: () => skillAgents.refetch()
    });
  };

  let hasActivity: Record<WorkspacePanelId, boolean> = {
    files: fileEntries.some(entry => entry.kind != 'directory' && !entry.isMain),
    mergeRequests: openMergeRequests.length + recentMergeRequests.length > 0,
    providers: linkedItems.length > 0,
    agents: agents.length > 0
  };

  let isSectionVisible = (id: WorkspacePanelId) => {
    let mode = prefs.preferences.modes[id];
    if (mode == 'on') return true;
    if (mode == 'off') return false;
    return hasActivity[id];
  };

  let canWrite = !p.readOnly;
  let isFork = !!p.fork;
  let toolbarAvailable = useLingering(!!chrome && !chrome.readOnly, 6000);
  let toolbarVisible = toolbarAvailable && prefs.preferences.toolbar;

  let sectionMenu = (id: WorkspacePanelId): FloatingMenuItem[] => {
    let collapsed = !!prefs.collapsed[id];
    return [
      {
        id: 'collapse',
        icon: collapsed ? <RiExpandUpDownLine /> : <RiContractUpDownLine />,
        label: collapsed ? 'Expand' : 'Collapse',
        onClick: () => prefs.setCollapsed(id, !collapsed)
      },
      {
        id: 'pin',
        icon: <RiPushpinLine />,
        label: 'Always show',
        checked: prefs.preferences.modes[id] == 'on',
        onClick: () => prefs.setMode(id, prefs.preferences.modes[id] == 'on' ? 'auto' : 'on')
      },
      {
        id: 'hide',
        icon: <RiEyeOffLine />,
        label: 'Hide panel',
        onClick: () => prefs.setMode(id, 'off')
      },
      ...(id == 'mergeRequests'
        ? ([
            { type: 'separator', id: 'sep' },
            {
              id: 'all',
              icon: <RiListCheck />,
              label: 'View all merge requests',
              onClick: () => navigate(p.routes.mergeRequests)
            }
          ] satisfies FloatingMenuItem[])
        : []),
      ...(id == 'providers'
        ? ([
            { type: 'separator', id: 'sep' },
            {
              id: 'manage',
              icon: <RiPlugLine />,
              label: 'Manage providers',
              onClick: () => navigate(p.routes.providers)
            }
          ] satisfies FloatingMenuItem[])
        : [])
    ];
  };

  let providerAddItems: FloatingMenuItem[] = [
    ...(p.allowProviders === false
      ? []
      : [
          {
            id: 'provider',
            icon: <RiPlugLine />,
            label: 'Provider',
            description: 'Link an individual provider',
            onClick: () => addProvider('provider')
          }
        ]),
    {
      id: 'integration',
      icon: <RiApps2Line />,
      label: 'Integration',
      description: 'Link an integration',
      onClick: () => addProvider('integration')
    }
  ];

  let renderFiles = () => (
    <FileTreeHost>
      <SkillStoreFileTree
        instanceId={p.instanceId}
        storeId={p.skill.storeId}
        getDocumentPath={p.routes.document}
        shareContext={p.shareContext}
        readOnly={p.readOnly}
        openFilesInline
      />
    </FileTreeHost>
  );

  let renderMergeRequestRow = (request: (typeof openMergeRequests)[number]) => {
    let incoming = request.targetSkillId == p.skill.id;
    let href = p.routes.mergeRequest(request.id);
    return (
      <SectionRow
        key={request.id}
        $active={isRouteActive(location.pathname, href)}
        onClick={() => navigate(href)}
        type="button"
      >
        <RowIcon>
          {request.status == 'merged' ? (
            <RiGitMergeLine />
          ) : incoming ? (
            <RiArrowLeftDownLine />
          ) : (
            <RiArrowRightUpLine />
          )}
        </RowIcon>
        <SectionRowMain>
          <SectionRowTitle>{request.title}</SectionRowTitle>
          <SectionRowMeta>
            {[
              incoming ? 'Incoming' : 'Outgoing',
              request.createdBy?.name,
              formatRelative(request.updatedAt)
            ]
              .filter(Boolean)
              .join(' · ')}
          </SectionRowMeta>
        </SectionRowMain>
      </SectionRow>
    );
  };

  let renderMergeRequests = () =>
    openMergeRequests.length || recentMergeRequests.length ? (
      <>
        <SectionList>
          {openMergeRequests.map(renderMergeRequestRow)}
          {recentMergeRequests.length ? <SectionGroupLabel>RECENT</SectionGroupLabel> : null}
          {recentMergeRequests.map(renderMergeRequestRow)}
        </SectionList>
        <SectionFooter>
          <SectionLinkButton type="button" onClick={() => navigate(p.routes.mergeRequests)}>
            View all
            <RiArrowRightSLine />
          </SectionLinkButton>
        </SectionFooter>
      </>
    ) : (
      <SectionEmpty>No merge requests yet.</SectionEmpty>
    );

  let renderProviders = () =>
    linkedItems.length ? (
      <SectionList>
        {linkedItems.map(item => (
          <SectionRow key={item.id} onClick={() => navigate(p.routes.providers)} type="button">
            {item.type == 'provider' && item.provider ? (
              <Avatar
                entity={{
                  name: item.provider.name ?? item.provider.slug,
                  photoUrl: providerListings.data?.find(
                    listing => listing.provider.id == item.provider?.id
                  )?.imageUrl
                }}
                size={20}
                radius={5}
                noTooltip
                imageFit="contain"
              />
            ) : (
              <RowIcon>
                <RiToolsLine />
              </RowIcon>
            )}
            <SectionRowMain>
              <SectionRowTitle>{getLinkedItemName(item)}</SectionRowTitle>
            </SectionRowMain>
          </SectionRow>
        ))}
      </SectionList>
    ) : (
      <SectionEmpty>Link providers this skill should use.</SectionEmpty>
    );

  let renderAgents = () =>
    agents.length ? (
      <SectionList>
        {agents.map(agent => {
          let href = p.routes.agent(agent.documentId);
          return (
            <SectionRow
              key={agent.id}
              $active={isRouteActive(location.pathname, href, true)}
              onClick={() => navigate(href)}
              onPointerEnter={() =>
                prefetchDocument({ instanceId: p.instanceId, documentId: agent.documentId })
              }
              type="button"
            >
              <SectionRowMain>
                <SectionRowTitle>{agent.name}</SectionRowTitle>
              </SectionRowMain>
            </SectionRow>
          );
        })}
      </SectionList>
    ) : (
      <SectionEmpty>Sub-agents stored with this skill.</SectionEmpty>
    );

  let sectionBodies: Record<WorkspacePanelId, () => ReactNode> = {
    files: renderFiles,
    mergeRequests: renderMergeRequests,
    providers: renderProviders,
    agents: renderAgents
  };

  let sectionCounts: Record<WorkspacePanelId, number> = {
    files: 0,
    mergeRequests: openMergeRequests.length,
    providers: linkedItems.length,
    agents: agents.length
  };

  let sectionAdd = (id: WorkspacePanelId) => {
    if (!canWrite || !p.instanceId) return null;
    if (id == 'providers') return { label: 'Add', items: providerAddItems };
    if (id == 'agents') return { label: 'Add agent', onClick: addAgent };
    if (id == 'mergeRequests' && p.fork?.onRequestMerge) {
      return { label: 'Create merge request', onClick: p.fork.onRequestMerge };
    }
    return null;
  };

  let buildSection = (id: WorkspacePanelId): WorkspaceSectionEntry => ({
    id,
    title: sectionMeta[id].title,
    icon: sectionMeta[id].icon,
    count: sectionCounts[id],
    render: (variant: WorkspaceSectionVariant) => (
      <WorkspaceSection
        icon={sectionMeta[id].icon}
        title={sectionMeta[id].title}
        count={sectionCounts[id]}
        collapsed={!!prefs.collapsed[id]}
        onCollapsedChange={collapsed => prefs.setCollapsed(id, collapsed)}
        add={sectionAdd(id)}
        menu={sectionMenu(id)}
        variant={variant}
      >
        {sectionBodies[id]()}
      </WorkspaceSection>
    )
  });

  let order = prefs.preferences.order;
  let visibleSections = order.filter(isSectionVisible).map(buildSection);
  let sidebarSections = order
    .filter(id => prefs.preferences.modes[id] != 'off')
    .map(buildSection);

  let reorderSections = useCallback(
    (ids: WorkspacePanelId[]) => {
      let queue = [...ids];
      let current = prefs.preferences.order;
      prefs.setOrder(current.map(id => (ids.includes(id) ? (queue.shift() ?? id) : id)));
    },
    [prefs.setOrder, prefs.preferences.order]
  );

  let assistantVisible = prefs.preferences.assistant;
  let snackbarBottom = assistantVisible && p.assistantHeight ? p.assistantHeight + 8 : 24;

  useEffect(() => {
    let root = document.documentElement;
    root.style.setProperty('--snackbar-bottom', `${snackbarBottom}px`);
    return () => {
      root.style.removeProperty('--snackbar-bottom');
    };
  }, [snackbarBottom]);
  let filePane = filePaneCount > 0;

  let leftSections: WorkspaceSectionEntry[] = [];
  let rightSections: WorkspaceSectionEntry[] = [];

  let layout = useWorkspaceLayout({
    rootRef,
    navLeftRef,
    navRightRef,
    toolbarRef,
    position: prefs.preferences.position,
    visibleSectionIds: visibleSections.map(section => section.id),
    toolbarVisible,
    contentWidth: chrome?.contentWidth ?? null,
    filePane,
    assistantSpace: assistantVisible ? p.assistantHeight : 0
  });

  let position = layout.effectivePosition;
  if (position == 'left') leftSections = visibleSections;
  if (position == 'right') rightSections = visibleSections;
  if (position == 'split') {
    leftSections = visibleSections.filter(section => section.id == 'files');
    rightSections = visibleSections.filter(section => section.id != 'files');
  }

  let toggleToolbar = useCallback(
    () => prefs.setToolbar(!prefs.preferences.toolbar),
    [prefs.setToolbar, prefs.preferences.toolbar]
  );

  useEffect(() => {
    let onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || !event.shiftKey) return;
      let key = event.key.toLowerCase();
      if (key == 'e') {
        event.preventDefault();
        setSwitcherOpen(open => !open);
      }
      if (key == 'f' && toolbarAvailable) {
        event.preventDefault();
        toggleToolbar();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toolbarAvailable, toggleToolbar]);

  let size = layout.size;
  let createMergeRequest =
    p.fork?.onRequestMerge && p.fork.hasChanges !== false ? p.fork.onRequestMerge : null;
  let openVersionHistory = chrome ? () => chrome.actions.openVersionHistory() : null;

  let moreItems: FloatingMenuItem[] = [
    ...(canWrite && p.onImageChange
      ? [
          {
            id: 'icon',
            icon: <RiImageLine />,
            label: 'Icon',
            kbd:
              skillImage && skillImage.type != 'default' ? (
                <SkillIconTile image={skillImage} imageUrl={skillImageUrl} size={18} />
              ) : (
                'None'
              ),
            onClick: () => setTimeout(() => setIconPickerOpen(true), 0)
          }
        ]
      : []),
    {
      id: 'files',
      icon: <RiFileList3Line />,
      label: 'Show files',
      kbd: '⇧⌘E',
      onClick: () => setTimeout(() => setSwitcherOpen(true), 0)
    },
    ...(toolbarAvailable
      ? [
          {
            id: 'toolbar',
            icon: <RiFontSize2 />,
            label: 'Formatting toolbar',
            kbd: '⇧⌘F',
            checked: prefs.preferences.toolbar,
            onClick: toggleToolbar
          }
        ]
      : []),
    ...(canWrite && p.instanceId
      ? ([
          { type: 'separator', id: 'add-sep' },
          { type: 'label', id: 'add-label', label: 'Add' },
          {
            id: 'add-document',
            icon: <RiFileAddLine />,
            label: 'Document',
            onClick: () => void createUntitledDocument()
          },
          { id: 'add-agent', icon: <RiRobot2Line />, label: 'Agent', onClick: addAgent },
          ...providerAddItems.map(item => ({ ...item, description: undefined }))
        ] satisfies FloatingMenuItem[])
      : []),
    ...(chrome
      ? ([
          { type: 'separator', id: 'view-sep' },
          segmentedItem({
            id: 'view',
            icon: <RiLayoutColumnLine />,
            label: 'View',
            value: chrome.viewMode,
            options: [
              { value: 'editor', icon: <RiEditLine size={15} />, tooltip: 'Editor' },
              { value: 'split', icon: <RiLayoutColumnLine size={15} />, tooltip: 'Split' },
              { value: 'preview', icon: <RiMarkdownLine size={15} />, tooltip: 'Markdown' }
            ],
            onChange: chrome.actions.setViewMode
          }),
          segmentedItem({
            id: 'width',
            icon: <RiExpandLeftRightLine />,
            label: 'Page width',
            value: chrome.contentWidth,
            options: [
              { value: '720px', label: 'S' },
              { value: '1000px', label: 'M' },
              { value: '100%', label: 'Full' }
            ],
            onChange: chrome.actions.setContentWidth
          }),
          ...(chrome.isCollaborative
            ? [
                {
                  id: 'editors',
                  icon: <RiQuillPenLine />,
                  label: 'Show editors',
                  checked: chrome.showEditors,
                  closeOnClick: false,
                  onClick: () => chrome!.actions.setShowEditors(!chrome!.showEditors)
                }
              ]
            : []),
          { type: 'separator', id: 'doc-sep' },
          {
            id: 'page-info',
            icon: <RiInformationLine />,
            label: 'Page info',
            onClick: chrome.actions.openPageInfo
          },
          ...(chrome.readOnly
            ? []
            : [
                {
                  id: 'import',
                  icon: <RiUpload2Line />,
                  label: 'Import markdown',
                  onClick: chrome.actions.importMarkdown
                }
              ]),
          {
            id: 'export-md',
            icon: <RiDownload2Line />,
            label: 'Export as .md',
            onClick: chrome.actions.exportMarkdown
          },
          {
            id: 'copy-link',
            icon: <RiLinkM />,
            label: 'Copy link to file',
            onClick: chrome.actions.copyLink
          },
          {
            id: 'shortcuts',
            icon: <RiKeyboardLine />,
            label: 'Keyboard shortcuts',
            onClick: chrome.actions.openShortcuts
          }
        ] satisfies FloatingMenuItem[])
      : [])
  ];

  let forkItems: FloatingMenuItem[] = [
    ...(isFork
      ? ([
          {
            type: 'label',
            id: 'fork-label',
            label: p.fork?.parentName ? `Fork of ${p.fork.parentName}` : 'Fork'
          },
          ...(p.fork?.onRequestMerge
            ? [
                {
                  id: 'request-merge',
                  icon: <RiGitPullRequestLine />,
                  label: 'Create merge request',
                  disabled: p.fork.hasChanges === false,
                  description: p.fork.hasChanges === false ? 'No changes to merge' : undefined,
                  onClick: p.fork.onRequestMerge
                }
              ]
            : []),
          ...(canWrite && p.fork?.onSync
            ? [
                {
                  id: 'sync',
                  icon: <RiRefreshLine />,
                  label: 'Sync with upstream',
                  onClick: p.fork.onSync
                }
              ]
            : []),
          ...(p.fork?.parentHref
            ? [
                {
                  id: 'parent',
                  icon: <RiExternalLinkLine />,
                  label: 'Open parent skill',
                  onClick: () => navigate(p.fork!.parentHref!)
                }
              ]
            : []),
          ...(p.onDuplicate ? [{ type: 'separator' as const, id: 'fork-sep' }] : [])
        ] satisfies FloatingMenuItem[])
      : []),
    ...(p.onDuplicate
      ? [
          {
            id: 'duplicate',
            icon: <RiFileCopyLine />,
            label: 'Duplicate skill',
            onClick: p.onDuplicate
          }
        ]
      : [])
  ];

  let skillMenuItems: FloatingMenuItem[] = [
    ...(size == 'xs'
      ? ([
          ...(createMergeRequest
            ? [
                {
                  id: 'xs-merge',
                  icon: <RiGitPullRequestLine />,
                  label: 'Create merge request',
                  onClick: createMergeRequest
                }
              ]
            : []),
          {
            id: 'xs-history',
            icon: <RiHistoryLine />,
            label: 'Version history',
            disabled: !openVersionHistory,
            onClick: openVersionHistory ?? undefined
          },
          ...(p.onExport
            ? [
                {
                  id: 'xs-export',
                  icon: <RiDownload2Line />,
                  label: 'Export skill',
                  onClick: p.onExport
                }
              ]
            : []),
          ...(canWrite && p.fork?.onSync
            ? [
                {
                  id: 'xs-sync',
                  icon: <RiRefreshLine />,
                  label: 'Sync with upstream',
                  onClick: p.fork.onSync
                }
              ]
            : []),
          ...(p.fork?.parentHref
            ? [
                {
                  id: 'xs-parent',
                  icon: <RiExternalLinkLine />,
                  label: 'Open parent skill',
                  onClick: () => navigate(p.fork!.parentHref!)
                }
              ]
            : []),
          ...(p.onDuplicate
            ? [
                {
                  id: 'xs-duplicate',
                  icon: <RiFileCopyLine />,
                  label: 'Duplicate skill',
                  onClick: p.onDuplicate
                }
              ]
            : []),
          ...(toolbarAvailable
            ? [
                {
                  id: 'xs-toolbar',
                  icon: <RiFontSize2 />,
                  label: 'Formatting toolbar',
                  checked: prefs.preferences.toolbar,
                  onClick: toggleToolbar
                }
              ]
            : []),
          { type: 'separator', id: 'xs-sep' }
        ] satisfies FloatingMenuItem[])
      : []),
    {
      id: 'settings',
      icon: <RiSettings3Line />,
      label: 'Settings',
      onClick: () => navigate(p.routes.settings)
    },
    {
      id: 'groups',
      icon: <RiFolderLine />,
      label: 'Groups',
      onClick: () => navigate(p.routes.groups)
    },
    { type: 'separator', id: 'panels-sep' },
    { type: 'label', id: 'panels-label', label: 'Panels' },
    segmentedItem({
      id: 'position',
      icon: <RiLayoutLeftLine />,
      label: 'Position',
      value: prefs.preferences.position,
      options: positionOptions,
      onChange: prefs.setPosition
    }),
    ...order.map(id =>
      segmentedItem({
        id: `mode-${id}`,
        icon: sectionMeta[id].icon,
        label: sectionMeta[id].title,
        value: prefs.preferences.modes[id],
        options: modeOptions,
        onChange: mode => prefs.setMode(id, mode)
      })
    ),
    { type: 'separator', id: 'assistant-sep' },
    {
      id: 'assistant',
      icon: <RiSparkling2Line />,
      label: 'Assistant',
      checked: prefs.preferences.assistant,
      closeOnClick: false,
      onClick: () => prefs.setAssistant(!prefs.preferences.assistant)
    }
  ];

  let share =
    p.shareContext && canWrite
      ? (trigger: ReactNode) => (
          <SkillSharePopover
            instanceId={p.instanceId}
            context={p.shareContext}
            trigger={trigger}
          />
        )
      : null;

  let canChangeImage = canWrite && !!p.onImageChange;
  let iconTile = <SkillIconTile image={skillImage} imageUrl={skillImageUrl} size={22} />;
  let iconSlot = canChangeImage ? (
    <IconPicker
      image={skillImage}
      onChange={changeImage}
      open={iconPickerOpen}
      onOpenChange={setIconPickerOpen}
      trigger={
        <IconButton aria-label="Change icon" type="button">
          {iconTile}
        </IconButton>
      }
    />
  ) : (
    <IconButton aria-label="Skill icon" disabled type="button">
      {iconTile}
    </IconButton>
  );

  let workspaceContext = useMemo(
    () => ({
      skillId: p.skill.id,
      size,
      readOnly: !canWrite,
      registerFilePane,
      skillDocumentTitleAccessory: (
        <DocumentIconRow
          image={skillImage}
          imageUrl={skillImageUrl}
          readOnly={!canChangeImage}
          compact={size == 'xs'}
          onChange={changeImage}
        />
      )
    }),
    [
      p.skill.id,
      skillImage,
      skillImageUrl,
      canChangeImage,
      canWrite,
      size,
      registerFilePane,
      p.onImageChange,
      p.instanceId
    ]
  );

  let sidebarFooter = (
    <>
      {[
        { route: p.routes.settings, icon: <RiSettings3Line />, label: 'Settings' },
        { route: p.routes.groups, icon: <RiFolderLine />, label: 'Groups' }
      ].map(entry => (
        <SidebarFooterRow
          key={entry.label}
          $active={isRouteActive(location.pathname, entry.route, true)}
          onClick={() => navigate(entry.route)}
          type="button"
        >
          {entry.icon}
          <SectionRowMain>
            <SectionRowTitle>{entry.label}</SectionRowTitle>
          </SectionRowMain>
        </SidebarFooterRow>
      ))}
    </>
  );

  return (
    <Root
      ref={rootRef}
      data-size={size}
      data-tight={layout.tight ? '1' : undefined}
      data-position={position}
    >
      <SkillWorkspaceContext.Provider value={workspaceContext}>
        <Canvas $document={isDocumentRoute}>{canvasElement}</Canvas>
      </SkillWorkspaceContext.Provider>

      <Panel.Wrapper
        isOpen={!!panelRoute}
        width={
          panelKindRef.current == 'mergeRequest' ? 'min(1080px, 94vw)' : 'min(760px, 94vw)'
        }
        onOpenChange={open => {
          if (!open) closePanelRoute();
        }}
      >
        {panelKindRef.current == 'mergeRequest' ? (
          <RoutePanelBody>
            <RoutePanelClose>
              <NavIconButton
                icon={<RiCloseLine />}
                label="Close"
                tooltip={null}
                onClick={closePanelRoute}
              />
            </RoutePanelClose>
            {panelContentRef.current}
          </RoutePanelBody>
        ) : (
          panelContentRef.current
        )}
      </Panel.Wrapper>

      <PanelColumn side="left" sections={leftSections} onReorder={reorderSections} />
      <PanelColumn side="right" sections={rightSections} onReorder={reorderSections} />
      <PanelDock sections={visibleSections} visible={position == 'dock'} />
      <WorkspaceSidebar
        visible={position == 'sidebar'}
        sections={sidebarSections}
        footer={sidebarFooter}
      />

      <WorkspaceNavLeft
        clusterRef={navLeftRef}
        size={size}
        offset={position == 'sidebar' ? 292 : 0}
        onSettled={layout.measure}
        backPath={p.backPath}
        iconSlot={iconSlot}
        name={p.skill.name}
        readOnly={p.readOnly}
        onNameChange={p.onNameChange}
        activeFile={activeFile}
        files={fileEntries}
        agents={agentEntries}
        activeHref={activeHref}
        switcherOpen={switcherOpen}
        onSwitcherOpenChange={setSwitcherOpen}
        filesPinned={isSectionVisible('files')}
        onPinFiles={() => prefs.setMode('files', 'on')}
        onEntryHover={entry => {
          prefetchStoreItem({
            instanceId: p.instanceId,
            storeId: p.skill.storeId,
            itemId: entry.id
          });
          prefetchDocument({ instanceId: p.instanceId, documentId: entry.documentId });
        }}
        onNewDocument={canWrite ? () => void createUntitledDocument() : undefined}
        toolbar={
          toolbarAvailable ? { on: prefs.preferences.toolbar, onToggle: toggleToolbar } : null
        }
        moreItems={moreItems}
      />

      <ToolbarSlot $visible={toolbarVisible} aria-hidden={!toolbarVisible || undefined}>
        <FloatingBar ref={toolbarRef}>
          {chrome ? <chrome.Toolbar /> : null}
          <FloatingBarSeparator />
          <NavIconButton icon={<RiCloseLine />} label="Hide toolbar" onClick={toggleToolbar} />
        </FloatingBar>
      </ToolbarSlot>

      <WorkspaceNavRight
        clusterRef={navRightRef}
        size={size}
        tight={layout.tight}
        onSettled={layout.measure}
        createMergeRequest={createMergeRequest}
        comments={
          chrome
            ? {
                open: chrome.commentsOpen,
                count: chrome.openCommentCount,
                onToggle: () => chrome!.actions.setCommentsOpen(!chrome!.commentsOpen)
              }
            : null
        }
        onVersionHistory={openVersionHistory}
        share={share}
        onExport={p.onExport}
        exportLoading={p.exportLoading}
        forkLabel={isFork ? 'Fork' : 'Duplicate'}
        forkItems={forkItems}
        skillItems={skillMenuItems}
      />

      {assistantVisible ? <SkillAssistantDock /> : null}
      <SnackbarViewport />
    </Root>
  );
};

export let SkillWorkspaceLayout = (p: SkillWorkspaceLayoutProps) => {
  let [assistantHeight, setAssistantHeight] = useState(0);

  return (
    <DocumentEditorChromeProvider>
      <SkillAssistantWorkspaceProvider
        organizationId={p.shareContext?.organizationId}
        instanceId={p.instanceId}
        skillId={p.skill.id}
        canWrite={!p.readOnly}
        onDockHeightChange={setAssistantHeight}
      >
        <WorkspaceInner {...p} assistantHeight={assistantHeight} />
      </SkillAssistantWorkspaceProvider>
    </DocumentEditorChromeProvider>
  );
};
