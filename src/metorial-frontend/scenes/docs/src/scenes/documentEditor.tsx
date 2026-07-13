import { markdownToYjsUpdate } from '@metorial/docs-editor-schema';
import type { SkillSharePanelContext } from '@metorial/scene-skills';
import {
  DocumentParticipant,
  getDocumentEditToken,
  DocumentVersion as StateDocumentVersion,
  useCreateFileLink,
  useDocument,
  useDocumentCollaboration,
  useDocumentParticipants,
  useDocumentPermissions,
  useDocumentVersions,
  useUploadFile,
  useUser
} from '@metorial/state';
import { theme } from '@metorial/ui';
import type { Editor as TiptapEditor } from '@tiptap/react';
import type { ChangeEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBlocker, useLocation, useNavigate } from 'react-router-dom';
import styled, { ThemeProvider } from 'styled-components';
import { parseDocument } from 'yaml';
import { Editor } from '../editor/Editor';
import {
  BackButton,
  CloudStatus,
  CurrentUserDisplay,
  HeaderDivider,
  HeaderSection,
  SettingsButton,
  ShareButton,
  TitleButton,
  type SharedPerson
} from '../editor/HeaderActions';
import { IconEdit, IconEye, IconSplit } from '../editor/icons';
import { ImageUploadProvider } from '../editor/ImageUploadContext';
import { KeyboardShortcutsPanel } from '../editor/KeyboardShortcutsPanel';
import { PageInfoDialog } from '../editor/PageInfoDialog';
import { Toolbar } from '../editor/Toolbar';
import { VersionHistoryPanel, type DocumentVersion } from '../editor/VersionHistoryPanel';
import { Preview } from '../preview/Preview';
import { DocsStyles } from '../styles/GlobalStyles';
import { lightTheme } from '../styles/theme';

let AUTOSAVE_DELAY_MS = 1000;
let MIN_PREVIEW_WIDTH = 360;
let DEFAULT_PREVIEW_WIDTH = 520;
let MIN_EDITOR_WIDTH = 420;

let Shell = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: ${({ theme }) => theme.color.bg};
  color: ${({ theme }) => theme.color.text};
  font-family: ${({ theme }) => theme.font.sans};
  line-height: 1.6;
`;

let Header = styled.header`
  display: flex;
  align-items: center;
  gap: 8px;
  height: 56px;
  padding: 0 14px;
  border-bottom: 1px solid ${theme.colors.gray300};
  background: ${({ theme }) => theme.color.bg};
  flex-shrink: 0;
`;

let HeaderLeft = styled(HeaderSection)`
  flex: 1 1 0;
  justify-content: flex-start;
  min-width: 0;
`;

let HeaderCenter = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
`;

let HeaderRight = styled(HeaderSection)`
  flex: 1 1 0;
  justify-content: flex-end;
  min-width: 0;
`;

let Segmented = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  background: ${({ theme }) => theme.color.bgHover};
  border-radius: ${({ theme }) => theme.size.radiusSm};
`;

let SegBtn = styled.button<{ $active?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 26px;
  padding: 0;
  border: 0;
  font-size: 12.5px;
  font-weight: 500;
  color: ${({ $active, theme }) => ($active ? theme.color.text : theme.color.textMuted)};
  background: ${({ $active, theme }) => ($active ? theme.color.bgElevated : 'transparent')};
  border-radius: 4px;
  cursor: pointer;
  transition: all ${({ theme }) => theme.motion.fast};
  box-shadow: ${({ $active, theme }) => ($active ? theme.shadow.sm : 'none')};

  svg {
    width: 14px;
    height: 14px;
  }

  &:hover {
    color: ${({ theme }) => theme.color.text};
  }
`;

let ReadOnlyBadge = styled.span<{ $active?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  border: 0;
  border-radius: ${({ theme }) => theme.size.radiusSm};
  background: ${({ $active, theme }) =>
    $active ? theme.color.accentSoft : theme.color.bgHover};
  color: ${({ $active, theme }) => ($active ? theme.color.accent : theme.color.textMuted)};
  font: inherit;
  font-size: 12px;
  font-weight: 600;

  svg {
    width: 14px;
    height: 14px;
  }
`;

let Main = styled.div`
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
`;

let PreviewResizeHandle = styled.div<{ $active?: boolean }>`
  flex: 0 0 1px;
  width: 1px;
  cursor: col-resize;
  position: relative;
  z-index: 5;
  background: #efefef;

  &::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: -3px;
    width: 7px;
    background: transparent;
    transition: background ${({ theme }) => theme.motion.fast};
  }

  &:hover::after,
  ${({ $active }) => ($active ? '&::after' : '')} {
    background: ${({ theme }) => theme.color.accent};
  }
`;

let Toast = styled.div<{ $visible?: boolean }>`
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%) translateY(${({ $visible }) => ($visible ? '0' : '20px')});
  background: ${({ theme }) => theme.color.text};
  color: ${({ theme }) => theme.color.bg};
  padding: 8px 14px;
  border-radius: ${({ theme }) => theme.size.radius};
  font-size: 13px;
  font-weight: 500;
  box-shadow: ${({ theme }) => theme.shadow.lg};
  pointer-events: none;
  opacity: ${({ $visible }) => ($visible ? 1 : 0)};
  transition:
    opacity ${({ theme }) => theme.motion.base},
    transform ${({ theme }) => theme.motion.base};
  z-index: 100;
`;

let SkeletonBlock = styled.div<{ $width?: string; $height?: string; $radius?: string }>`
  width: ${({ $width }) => $width ?? '100%'};
  height: ${({ $height }) => $height ?? '14px'};
  border-radius: ${({ $radius }) => $radius ?? '999px'};
  background: linear-gradient(
    90deg,
    ${({ theme }) => theme.color.bgAlt} 0%,
    ${({ theme }) => theme.color.bgHover} 48%,
    ${({ theme }) => theme.color.bgAlt} 100%
  );
  background-size: 220% 100%;
  animation: docsSkeletonPulse 1.4s ease-in-out infinite;

  @keyframes docsSkeletonPulse {
    0% {
      background-position: 100% 0;
    }
    100% {
      background-position: -100% 0;
    }
  }
`;

let SkeletonHeaderButton = styled(SkeletonBlock)`
  flex: 0 0 auto;
`;

let SkeletonEditorScroll = styled.div`
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
`;

let SkeletonEditorContent = styled.div`
  max-width: 1000px;
  margin: 0 auto;
  padding: 48px 64px;
`;

let SkeletonTitle = styled(SkeletonBlock)`
  margin-bottom: 16px;
`;

let SkeletonStatusBar = styled.div`
  display: flex;
  align-items: center;
  gap: 18px;
  min-height: 24px;
  margin: 0 0 25px -8px;
`;

let SkeletonParagraph = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 6px 0 22px;
`;

let SkeletonHeading = styled(SkeletonBlock)`
  margin: 34px 0 14px;
`;

let FadeHost = styled.div`
  position: relative;
  height: 100%;
  min-height: 0;
`;

let SkeletonFadeLayer = styled.div<{ $fading?: boolean }>`
  position: absolute;
  inset: 0;
  z-index: 50;
  opacity: ${({ $fading }) => ($fading ? 0 : 1)};
  pointer-events: ${({ $fading }) => ($fading ? 'none' : 'auto')};
  transition: opacity 200ms ease;
`;

let EditorMessage = styled.div`
  width: min(720px, calc(100% - 96px));
  margin: 72px auto 0;
  padding: 18px 20px;
  border: 1px solid ${({ theme }) => theme.color.border};
  border-radius: ${({ theme }) => theme.size.radius};
  background: ${({ theme }) => theme.color.bgElevated};
  color: ${({ theme }) => theme.color.text};
  box-shadow: ${({ theme }) => theme.shadow.sm};

  strong {
    display: block;
    margin-bottom: 6px;
  }

  span {
    color: ${({ theme }) => theme.color.textMuted};
    font-size: 13px;
  }
`;

type ViewMode = 'split' | 'editor' | 'preview';
type SaveStatus = 'saved' | 'pending' | 'saving' | 'error';
type PendingDocumentSave = { title: string; content: string };

let collaboratorColors = [
  '#2563eb',
  '#16a34a',
  '#9333ea',
  '#dc2626',
  '#ea580c',
  '#0891b2',
  '#4f46e5',
  '#be123c'
];

let getCollaboratorColor = (seed: string) => {
  let hash = 0;

  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }

  return collaboratorColors[hash % collaboratorColors.length]!;
};

let seedYjsBodyFromMarkdown = (d: { initialMarkdown: string; origin: unknown }) =>
  markdownToYjsUpdate(d.initialMarkdown, d.origin);

export type DocumentEditorSceneProps = {
  instanceId: string | null | undefined;
  documentId: string | null | undefined;
  currentConsumerId?: string | null;
  onBack?: () => void;
  setRestrictHeight?: (enabled: boolean) => void;
  hideSharingControls?: boolean;
  skillShareContext?: SkillSharePanelContext | null;
  loadError?: unknown;
};

let getCanonicalDocumentLink = () => {
  if (typeof window === 'undefined') return '';
  let { origin, pathname } = window.location;
  return `${origin}${pathname}`;
};

let countFallbackStats = (markdown: string) => {
  let text = markdown.trim();
  if (!text) return { words: 0, characters: 0 };
  return {
    words: text.split(/\s+/).filter(Boolean).length,
    characters: text.length
  };
};

let splitFrontMatter = (raw: string) => {
  let input = raw.replace(/^\uFEFF/, '');
  let match = input.match(/^---\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)\r?\n?/);
  if (!match) return { frontMatter: '', body: input };
  let full = match[0];
  let frontMatter = (match[1] ?? '').trim();
  let body = input.slice(full.length);
  return { frontMatter, body };
};

let splitTitleFromBody = (body: string) => {
  let match = body.match(/^\s*#\s+([^\r\n]+)(?:\r?\n|$)/);
  if (!match) return { title: null, body };
  let title = (match[1] ?? '').trim();
  let nextBody = body.slice(match[0].length).replace(/^\s+/, '');
  return { title, body: nextBody };
};

let stripMatchingTitleFromBody = (body: string, title: string) => {
  let titleSplit = splitTitleFromBody(body);
  if (!titleSplit.title) return body;
  if (titleSplit.title.trim() !== title.trim()) return body;
  return titleSplit.body;
};

let composeFullMarkdown = ({
  frontMatter,
  title,
  body
}: {
  frontMatter: string;
  title: string;
  body: string;
}) => {
  let sections: string[] = [];
  let trimmedFrontMatter = frontMatter.trim();
  let trimmedTitle = title.trim();
  if (trimmedFrontMatter) sections.push(`---\n${trimmedFrontMatter}\n---`);
  if (trimmedTitle) sections.push(`# ${trimmedTitle}`);
  if (body.length > 0) sections.push(body);
  if (sections.length === 0) return '';
  return sections.join('\n\n');
};

let parseStoredDocumentForEditor = (document: { title: string; content: string }) => {
  let frontMatterSplit = splitFrontMatter(document.content);
  let body = stripMatchingTitleFromBody(frontMatterSplit.body, document.title);
  return {
    frontMatter: frontMatterSplit.frontMatter,
    body,
    persistedContent: composeFullMarkdown({
      frontMatter: frontMatterSplit.frontMatter,
      title: document.title,
      body
    })
  };
};

let getInitialMarkdownForCollaboration = (document: { title: string; content: string }) =>
  parseStoredDocumentForEditor(document).body;

let validateFrontMatter = (frontMatter: string) => {
  let trimmed = frontMatter.trim();
  if (!trimmed) return { isValid: true, error: null };

  try {
    let doc = parseDocument(trimmed, { prettyErrors: true });
    if (doc.errors.length > 0) {
      let firstError = doc.errors[0];
      let message = firstError?.message?.split('\n')[0]?.trim() || 'Invalid front matter';
      return { isValid: false, error: message };
    }

    let parsed = doc.toJS();
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {
        isValid: false,
        error: 'Front matter must be an object with key: value pairs'
      };
    }

    return { isValid: true, error: null };
  } catch {
    return { isValid: false, error: 'Invalid front matter' };
  }
};

let getParticipantEmail = (participant: DocumentParticipant) =>
  participant.actor.organizationActor?.email ??
  participant.actor.consumer?.email ??
  participant.id;

let mapParticipantToPerson = (participant: DocumentParticipant): SharedPerson => ({
  name: participant.actor.name,
  email: getParticipantEmail(participant),
  imageUrl: participant.actor.imageUrl ?? undefined,
  role: participant.role,
  lastEditedAt: participant.lastEditedAt,
  lastViewedAt: participant.lastViewedAt
});

let mapVersionEditor = (editor: StateDocumentVersion['editors'][number]) => ({
  id: editor.organizationActor?.id ?? editor.consumer?.id ?? editor.name,
  name: editor.name,
  imageUrl: editor.imageUrl ?? undefined
});

let mapVersion = (version: StateDocumentVersion): DocumentVersion => ({
  id: version.id,
  content: version.content,
  versionNumber: version.versionNumber,
  previous_version_id: version.previousVersionId ?? undefined,
  editors: version.editors.map(mapVersionEditor)
});

let getErrorMessage = (error: unknown) => {
  if (!error) return 'Failed to load document.';
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && 'message' in error) {
    let message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return 'Failed to load document.';
};

let parseJsonObject = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

let getObjectFromUnknown = (value: unknown): Record<string, unknown> | null => {
  let normalized = typeof value == 'string' ? parseJsonObject(value) : value;
  if (!normalized || typeof normalized != 'object' || Array.isArray(normalized)) return null;
  return normalized as Record<string, unknown>;
};

let getSkillShareContextFromState = (
  state: unknown,
  currentConsumerId?: string | null
): SkillSharePanelContext | null => {
  let stateObject = getObjectFromUnknown(state);
  if (!stateObject) return null;

  let context = getObjectFromUnknown(stateObject.metorialSkillShare ?? stateObject);
  if (!context) return null;

  let candidate = context as Partial<SkillSharePanelContext>;
  if (candidate.mode != 'portal' && candidate.mode != 'dashboard') return null;
  if (!Array.isArray(candidate.skills) || candidate.skills.length == 0) return null;

  let skills = candidate.skills
    .filter(skill => skill && typeof skill == 'object' && typeof skill.id == 'string')
    .map(skill => ({
      id: (skill as { id: string }).id,
      name:
        typeof (skill as { name?: unknown }).name == 'string'
          ? ((skill as { name?: string }).name ?? null)
          : null
    }));

  if (skills.length == 0) return null;

  return {
    mode: candidate.mode,
    portalId: typeof candidate.portalId == 'string' ? candidate.portalId : null,
    organizationId:
      typeof candidate.organizationId == 'string' ? candidate.organizationId : null,
    currentConsumerId:
      typeof candidate.currentConsumerId == 'string'
        ? candidate.currentConsumerId
        : (currentConsumerId ?? null),
    skills
  };
};

let DocumentEditorSkeleton = (p: { onBack?: () => void }) => {
  let theme = useMemo(() => lightTheme, []);

  return (
    <ThemeProvider theme={theme}>
      <DocsStyles>
        <ImageUploadProvider>
          <Shell>
            <Header>
              <HeaderLeft>
                {p.onBack && <BackButton onClick={p.onBack} />}
                <SkeletonBlock $width="180px" $height="18px" />
                <CloudStatus status="pending" />
              </HeaderLeft>

              <HeaderCenter>
                <SkeletonHeaderButton $width="320px" $height="32px" $radius="8px" />
              </HeaderCenter>

              <HeaderRight>
                <SkeletonHeaderButton $width="80px" $height="28px" $radius="6px" />
                <SkeletonHeaderButton $width="92px" $height="28px" $radius="6px" />
                <SkeletonHeaderButton $width="32px" $height="32px" $radius="8px" />
              </HeaderRight>
            </Header>

            <Main>
              <SkeletonEditorScroll>
                <SkeletonEditorContent>
                  <SkeletonTitle $width="52%" $height="44px" $radius="10px" />
                  <SkeletonStatusBar>
                    <SkeletonBlock $width="92px" $height="24px" $radius="8px" />
                    <SkeletonBlock $width="128px" $height="24px" $radius="8px" />
                    <SkeletonBlock $width="112px" $height="24px" $radius="8px" />
                    <SkeletonBlock $width="138px" $height="24px" $radius="8px" />
                  </SkeletonStatusBar>

                  <SkeletonParagraph>
                    <SkeletonBlock $width="94%" $height="16px" $radius="5px" />
                    <SkeletonBlock $width="89%" $height="16px" $radius="5px" />
                    <SkeletonBlock $width="96%" $height="16px" $radius="5px" />
                    <SkeletonBlock $width="72%" $height="16px" $radius="5px" />
                  </SkeletonParagraph>

                  <SkeletonHeading $width="34%" $height="26px" $radius="7px" />
                  <SkeletonParagraph>
                    <SkeletonBlock $width="91%" $height="16px" $radius="5px" />
                    <SkeletonBlock $width="84%" $height="16px" $radius="5px" />
                    <SkeletonBlock $width="62%" $height="16px" $radius="5px" />
                  </SkeletonParagraph>
                </SkeletonEditorContent>
              </SkeletonEditorScroll>
            </Main>
          </Shell>
        </ImageUploadProvider>
      </DocsStyles>
    </ThemeProvider>
  );
};

let DocumentEditorLoadError = (p: { onBack?: () => void; message: string }) => {
  let theme = useMemo(() => lightTheme, []);

  return (
    <ThemeProvider theme={theme}>
      <DocsStyles>
        <Shell>
          <Header>
            <HeaderLeft>{p.onBack && <BackButton onClick={p.onBack} />}</HeaderLeft>
            <HeaderCenter />
            <HeaderRight />
          </Header>

          <Main>
            <SkeletonEditorScroll>
              <EditorMessage>
                <strong>Could not load document</strong>
                <span>{p.message}</span>
              </EditorMessage>
            </SkeletonEditorScroll>
          </Main>
        </Shell>
      </DocsStyles>
    </ThemeProvider>
  );
};

let DocumentEditorInner = (p: {
  instanceId: string;
  documentId: string;
  currentConsumerId?: string | null;
  onBack?: () => void;
  hideSharingControls?: boolean;
  skillShareContext?: SkillSharePanelContext | null;
}) => {
  let document = useDocument(p.instanceId, p.documentId);
  let permissions = useDocumentPermissions(p.instanceId, p.documentId);
  let participants = useDocumentParticipants(p.instanceId, p.documentId, {
    limit: 100,
    order: 'desc'
  });
  let versions = useDocumentVersions(p.instanceId, p.documentId, {
    limit: 100,
    order: 'desc'
  });
  let user = useUser();
  let canWrite = !!permissions.data?.permissions.includes('content_write');
  let requiresEditToken = !!p.currentConsumerId && canWrite;
  let [documentEditToken, setDocumentEditToken] = useState<{
    status: 'idle' | 'loading' | 'ready' | 'error';
    token: string | null;
  }>({
    status: requiresEditToken ? 'loading' : 'idle',
    token: null
  });
  useEffect(() => {
    if (!requiresEditToken) {
      setDocumentEditToken({
        status: 'idle',
        token: null
      });
      return;
    }

    let cancelled = false;
    setDocumentEditToken({
      status: 'loading',
      token: null
    });

    void getDocumentEditToken({
      instanceId: p.instanceId,
      documentId: p.documentId
    })
      .then(token => {
        if (cancelled) return;
        setDocumentEditToken({
          status: 'ready',
          token: token.token
        });
      })
      .catch(() => {
        if (cancelled) return;
        setDocumentEditToken({
          status: 'error',
          token: null
        });
      });

    return () => {
      cancelled = true;
    };
  }, [p.documentId, p.instanceId, requiresEditToken]);
  let isEditTokenReady =
    !requiresEditToken ||
    documentEditToken.status === 'ready' ||
    documentEditToken.status === 'error';
  let isReady = !!document.data && !!permissions.data && !!user.data && isEditTokenReady;
  let [showSkeleton, setShowSkeleton] = useState(true);

  useEffect(() => {
    if (!isReady) {
      setShowSkeleton(true);
      return;
    }

    let timeout = window.setTimeout(() => setShowSkeleton(false), 200);
    return () => window.clearTimeout(timeout);
  }, [isReady]);

  if (!document.data || !permissions.data || !user.data) {
    let error = document.error ?? permissions.error ?? user.error;
    if (error) {
      return <DocumentEditorLoadError onBack={p.onBack} message={getErrorMessage(error)} />;
    }

    return <DocumentEditorSkeleton onBack={p.onBack} />;
  }

  let editor = (
    <DocumentEditorLoaded
      document={document.data}
      permissions={permissions.data}
      participants={participants.data?.items ?? []}
      versions={versions.data?.items ?? []}
      user={user.data}
      instanceId={p.instanceId}
      documentId={p.documentId}
      editToken={documentEditToken.token}
      currentConsumerId={p.currentConsumerId}
      onBack={p.onBack}
      onSharedSkill={() => participants.refetch()}
      hideSharingControls={p.hideSharingControls}
      skillShareContext={p.skillShareContext}
    />
  );

  return (
    <FadeHost>
      {isReady ? editor : null}
      {showSkeleton && (
        <SkeletonFadeLayer $fading={isReady}>
          <DocumentEditorSkeleton onBack={p.onBack} />
        </SkeletonFadeLayer>
      )}
    </FadeHost>
  );
};

let DocumentEditorLoaded = (p: {
  instanceId: string;
  documentId: string;
  document: NonNullable<ReturnType<typeof useDocument>['data']>;
  permissions: NonNullable<ReturnType<typeof useDocumentPermissions>['data']>;
  participants: DocumentParticipant[];
  versions: StateDocumentVersion[];
  user: NonNullable<ReturnType<typeof useUser>['data']>;
  editToken?: string | null;
  currentConsumerId?: string | null;
  onBack?: () => void;
  onSharedSkill?: () => void | Promise<void>;
  hideSharingControls?: boolean;
  skillShareContext?: SkillSharePanelContext | null;
}) => {
  let [viewMode, setViewMode] = useState<ViewMode>('editor');
  let initialDocumentState = useMemo(
    () => parseStoredDocumentForEditor(p.document),
    [p.document.content, p.document.id, p.document.title]
  );
  let [title, setTitle] = useState(p.document.title);
  let [frontMatter, setFrontMatter] = useState(initialDocumentState.frontMatter);
  let [frontMatterOpen, setFrontMatterOpen] = useState(
    initialDocumentState.frontMatter.trim().length > 0
  );
  let [markdown, setMarkdown] = useState(initialDocumentState.body);
  let titleRef = useRef(p.document.title);
  let frontMatterRef = useRef(initialDocumentState.frontMatter);
  let markdownRef = useRef(initialDocumentState.body);
  let [editorKey, setEditorKey] = useState(0);
  let [toast, setToast] = useState<string | null>(null);
  let [contentWidth, setContentWidth] = useState('1000px');
  let [editorInstance, setEditorInstance] = useState<TiptapEditor | null>(null);
  let editorInstanceRef = useRef<TiptapEditor | null>(null);
  let [toolbarDisabled, setToolbarDisabled] = useState(false);
  let [linkPromptToken, setLinkPromptToken] = useState(0);
  let [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  let [shortcutsOpen, setShortcutsOpen] = useState(false);
  let [pageInfoOpen, setPageInfoOpen] = useState(false);
  let [previewWidth, setPreviewWidth] = useState(DEFAULT_PREVIEW_WIDTH);
  let [resizingPreview, setResizingPreview] = useState(false);
  let [lastUpdatedAt, setLastUpdatedAt] = useState(p.document.updatedAt);
  let [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  let [allowInitialHashScroll, setAllowInitialHashScroll] = useState(true);
  let [collaborationFirstRenderedDoc, setCollaborationFirstRenderedDoc] =
    useState<unknown>(null);
  let uploadFile = useUploadFile();
  let createFileLink = useCreateFileLink();
  let navigate = useNavigate();
  let location = useLocation();
  let mainRef = useRef<HTMLDivElement | null>(null);
  let toastTimer = useRef<number | null>(null);
  let fileInputRef = useRef<HTMLInputElement | null>(null);
  let saveTimerRef = useRef<number | null>(null);
  let pendingSaveRef = useRef<PendingDocumentSave | null>(null);
  let latestSaveInputRef = useRef<PendingDocumentSave>({
    title: p.document.title,
    content: initialDocumentState.persistedContent
  });
  let saveInFlightRef = useRef<Promise<void> | null>(null);
  let mountedRef = useRef(true);
  let pendingNavigationRef = useRef<string | null>(null);
  let autosaveHydratedRef = useRef(false);
  let lastPersistedRef = useRef({
    title: p.document.title,
    content: initialDocumentState.persistedContent
  });

  let canWrite = p.permissions.permissions.includes('content_write');
  let readOnly = !canWrite;
  let requiresEditToken = !!p.currentConsumerId && canWrite;
  let refreshEditToken = useCallback(async () => {
    if (!p.currentConsumerId || !canWrite) return p.editToken ?? null;

    let refreshed = await getDocumentEditToken({
      instanceId: p.instanceId,
      documentId: p.documentId
    });

    return refreshed.token;
  }, [canWrite, p.currentConsumerId, p.documentId, p.editToken, p.instanceId]);
  let collaboration = useDocumentCollaboration(p.instanceId, p.documentId, {
    enabled: !requiresEditToken || !!p.editToken,
    canWrite,
    editToken: p.editToken ?? null,
    refreshEditToken,
    initialMarkdown: initialDocumentState.body,
    getInitialMarkdown: getInitialMarkdownForCollaboration,
    seedInitialBody: seedYjsBodyFromMarkdown
  });
  let collaborationMeta = useMemo(
    () => collaboration.ydoc.getMap<string>('meta'),
    [collaboration.ydoc]
  );
  let applyingRemoteCollaborationMetaRef = useRef(false);

  let theme = useMemo(
    () => ({
      ...lightTheme,
      size: { ...lightTheme.size, contentWidth }
    }),
    [contentWidth]
  );

  let frontMatterValidation = useMemo(() => validateFrontMatter(frontMatter), [frontMatter]);
  let documentContent = useMemo(
    () =>
      composeFullMarkdown({
        frontMatter: frontMatterValidation.isValid ? frontMatter : '',
        title,
        body: markdown
      }),
    [frontMatter, frontMatterValidation.isValid, title, markdown]
  );
  let rawDocumentContent = useMemo(
    () =>
      composeFullMarkdown({
        frontMatter,
        title,
        body: markdown
      }),
    [frontMatter, title, markdown]
  );
  let fullMarkdown = useMemo(
    () =>
      composeFullMarkdown({
        frontMatter: frontMatterValidation.isValid ? frontMatter : '',
        title,
        body: markdown
      }),
    [frontMatter, frontMatterValidation.isValid, title, markdown]
  );

  let showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1800);
  }, []);

  let uploadImage = useCallback(
    async (file: File) => {
      let [uploadedFile] = await uploadFile.mutate({
        instanceId: p.instanceId,
        file,
        title: file.name,
        purpose: 'generic'
      });

      if (!uploadedFile) {
        throw new Error('Image upload failed');
      }

      let [link] = await createFileLink.mutate({
        instanceId: p.instanceId,
        fileId: uploadedFile.id
      });

      if (!link?.url) {
        throw new Error('Could not create image link');
      }

      return link.url;
    },
    [createFileLink, p.instanceId, uploadFile]
  );

  let handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(fullMarkdown);
      showToast('Copied markdown to clipboard');
    } catch {
      showToast('Failed to copy');
    }
  }, [fullMarkdown, showToast]);

  let handleDownload = useCallback(() => {
    let blob = new Blob([fullMarkdown], { type: 'text/markdown;charset=utf-8' });
    let url = URL.createObjectURL(blob);
    let a = document.createElement('a');
    let safeName = (title.trim() || 'document').replace(/[^\w\s-]/g, '').trim();
    a.href = url;
    a.download = `${safeName || 'document'}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('Downloaded markdown file');
  }, [fullMarkdown, title, showToast]);

  let handleImport = useCallback(() => {
    if (readOnly) return;
    fileInputRef.current?.click();
  }, [readOnly]);

  let handleCopyLink = useCallback(async () => {
    let link = getCanonicalDocumentLink();
    try {
      await navigator.clipboard.writeText(link);
      showToast('Copied link to clipboard');
    } catch {
      showToast('Failed to copy link');
    }
  }, [showToast]);

  let markChanged = useCallback(() => {
    setLastUpdatedAt(new Date());
    if (canWrite) {
      collaboration.markSnapshotPending();
      setSaveStatus('pending');
    }
  }, [canWrite, collaboration.markSnapshotPending]);

  let handleTitleChange = useCallback(
    (next: string) => {
      if (readOnly) return;
      if (next === titleRef.current) return;
      titleRef.current = next;
      setTitle(next);
      if (!applyingRemoteCollaborationMetaRef.current) {
        collaborationMeta.set('title', next);
      }
      markChanged();
    },
    [collaborationMeta, markChanged, readOnly]
  );

  let handleMarkdownChange = useCallback(
    (next: string) => {
      if (readOnly) return;
      if (next === markdownRef.current) return;
      markdownRef.current = next;
      setMarkdown(next);
      markChanged();
    },
    [markChanged, readOnly]
  );

  let handleFrontMatterChange = useCallback(
    (next: string) => {
      if (readOnly) return;
      if (next === frontMatterRef.current) return;
      frontMatterRef.current = next;
      setFrontMatter(next);
      if (!applyingRemoteCollaborationMetaRef.current) {
        collaborationMeta.set('frontMatter', next);
      }
      markChanged();
    },
    [collaborationMeta, markChanged, readOnly]
  );

  let handleFile = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      if (readOnly) return;
      let file = e.target.files?.[0];
      if (!file) return;

      let text = await file.text();
      let split = splitFrontMatter(text);
      let titleSplit = splitTitleFromBody(split.body);
      titleRef.current = titleSplit.title || file.name.replace(/\.md$/i, '');
      frontMatterRef.current = split.frontMatter;
      markdownRef.current = titleSplit.body;
      setTitle(titleSplit.title || file.name.replace(/\.md$/i, ''));
      setFrontMatter(split.frontMatter);
      setFrontMatterOpen(split.frontMatter.trim().length > 0);
      setMarkdown(titleSplit.body);
      setLastUpdatedAt(new Date());
      setEditorKey(k => k + 1);
      e.target.value = '';
      showToast(`Imported ${file.name}`);
    },
    [readOnly, showToast]
  );

  let handleRequestLinkEdit = useCallback(() => {
    setLinkPromptToken(t => t + 1);
  }, []);

  let handlePreviewResizeStart = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();

      let main = mainRef.current;
      if (!main) return;

      let startX = e.clientX;
      let startWidth = previewWidth;
      let mainWidth = main.getBoundingClientRect().width;
      let maxWidth = Math.max(MIN_PREVIEW_WIDTH, mainWidth - MIN_EDITOR_WIDTH);
      let previousCursor = document.body.style.cursor;
      let previousUserSelect = document.body.style.userSelect;

      setResizingPreview(true);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      let onPointerMove = (event: PointerEvent) => {
        let nextWidth = startWidth - (event.clientX - startX);
        setPreviewWidth(Math.min(maxWidth, Math.max(MIN_PREVIEW_WIDTH, nextWidth)));
      };

      let onPointerUp = () => {
        setResizingPreview(false);
        document.body.style.cursor = previousCursor;
        document.body.style.userSelect = previousUserSelect;
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    },
    [previewWidth]
  );

  let people = useMemo(() => p.participants.map(mapParticipantToPerson), [p.participants]);
  let livePeople = useMemo(
    () => collaboration.participants.map(mapParticipantToPerson),
    [collaboration.participants]
  );
  let sharePeople = useMemo(() => {
    let byEmail = new Map<string, SharedPerson>();

    for (let person of people) {
      byEmail.set(person.email, person);
    }

    for (let person of livePeople) {
      byEmail.set(person.email, person);
    }

    return [...byEmail.values()];
  }, [livePeople, people]);
  let versionHistory = useMemo(() => p.versions.map(mapVersion), [p.versions]);
  let documentLink = getCanonicalDocumentLink();
  let fallbackStats = useMemo(() => countFallbackStats(markdown), [markdown]);
  let wordCount = editorInstance?.storage.characterCount?.words?.() ?? fallbackStats.words;
  let charCount =
    editorInstance?.storage.characterCount?.characters?.() ?? fallbackStats.characters;
  let statusEditors = useMemo(() => {
    let editors = sharePeople.filter(person => person.role === 'editor');
    if (!canWrite) return editors;

    let currentAsEditor: SharedPerson = {
      name: p.user.name,
      email: p.user.email,
      imageUrl: p.user.imageUrl,
      role: 'editor',
      lastEditedAt: lastUpdatedAt,
      lastViewedAt: lastUpdatedAt
    };

    if (editors.some(person => person.email === p.user.email)) return editors;
    return [currentAsEditor, ...editors];
  }, [canWrite, lastUpdatedAt, p.user.email, p.user.imageUrl, p.user.name, sharePeople]);
  let editorCollaboration = useMemo(
    () => ({
      ydoc: collaboration.ydoc,
      awareness: collaboration.awareness,
      user: {
        name: p.user.name,
        imageUrl: p.user.imageUrl,
        color: getCollaboratorColor(p.user.email || p.user.name)
      },
      onFirstRender: () => setCollaborationFirstRenderedDoc(collaboration.ydoc)
    }),
    [collaboration.awareness, collaboration.ydoc, p.user.email, p.user.imageUrl, p.user.name]
  );
  let skillShareContext = useMemo(
    () =>
      p.skillShareContext ??
      getSkillShareContextFromState(location.state, p.currentConsumerId),
    [location.state, p.currentConsumerId, p.skillShareContext]
  );
  let hasUnsavedChanges =
    canWrite &&
    (title !== lastPersistedRef.current.title ||
      rawDocumentContent !== lastPersistedRef.current.content);
  let editorReadyForAutosave =
    collaboration.isReadyForEditor &&
    (collaboration.isFallback ||
      viewMode === 'preview' ||
      collaborationFirstRenderedDoc === collaboration.ydoc);

  latestSaveInputRef.current = { title, content: documentContent };

  useEffect(() => {
    editorInstanceRef.current = editorInstance;
  }, [editorInstance]);

  useEffect(() => {
    setSaveStatus(collaboration.snapshotSaveStatus);
  }, [collaboration.snapshotSaveStatus]);

  useEffect(() => {
    let applyMeta = () => {
      let nextTitle = collaborationMeta.get('title');
      let nextFrontMatter = collaborationMeta.get('frontMatter');

      applyingRemoteCollaborationMetaRef.current = true;

      try {
        if (typeof nextTitle == 'string' && nextTitle !== titleRef.current) {
          titleRef.current = nextTitle;
          setTitle(nextTitle);
          setLastUpdatedAt(new Date());
        }

        if (typeof nextFrontMatter == 'string' && nextFrontMatter !== frontMatterRef.current) {
          frontMatterRef.current = nextFrontMatter;
          setFrontMatter(nextFrontMatter);
          setFrontMatterOpen(nextFrontMatter.trim().length > 0);
          setLastUpdatedAt(new Date());
        }
      } finally {
        applyingRemoteCollaborationMetaRef.current = false;
      }
    };

    collaborationMeta.observe(applyMeta);
    applyMeta();

    return () => {
      collaborationMeta.unobserve(applyMeta);
    };
  }, [collaborationMeta]);

  useEffect(() => {
    autosaveHydratedRef.current = false;
  }, [collaboration.ydoc]);

  let getCurrentSaveInput = useCallback((): PendingDocumentSave => {
    let editorMarkdown = (
      editorInstanceRef.current?.storage as
        | { markdown?: { getMarkdown: () => string } }
        | undefined
    )?.markdown?.getMarkdown();
    let body = editorMarkdown ?? markdownRef.current;

    return {
      title: titleRef.current,
      content: composeFullMarkdown({
        frontMatter: frontMatterValidation.isValid ? frontMatterRef.current : '',
        title: titleRef.current,
        body
      })
    };
  }, [frontMatterValidation.isValid]);

  let flushSave = useCallback(async () => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    if (saveInFlightRef.current) await saveInFlightRef.current;

    let next = pendingSaveRef.current ? getCurrentSaveInput() : null;
    if (!next) return;

    pendingSaveRef.current = null;
    if (mountedRef.current) setSaveStatus('saving');

    let savePromise = Promise.resolve()
      .then(() => {
        lastPersistedRef.current = next;
        if (mountedRef.current) setSaveStatus(pendingSaveRef.current ? 'pending' : 'saved');
      })
      .catch(() => {
        pendingSaveRef.current = next;
        if (mountedRef.current) setSaveStatus('error');
      })
      .finally(() => {
        if (saveInFlightRef.current === savePromise) {
          saveInFlightRef.current = null;
        }
      });

    saveInFlightRef.current = savePromise;
    await savePromise;
  }, [getCurrentSaveInput]);

  let enqueueSave = useCallback(() => {
    let next = getCurrentSaveInput();
    let last = lastPersistedRef.current;
    let changed = next.title !== last.title || next.content !== last.content;

    if (!changed) {
      pendingSaveRef.current = null;
      setSaveStatus('saved');
      return;
    }

    pendingSaveRef.current = next;
    setSaveStatus('pending');

    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      void flushSave();
    }, AUTOSAVE_DELAY_MS);
  }, [flushSave, getCurrentSaveInput]);

  useEffect(() => {
    let nextDocumentState = parseStoredDocumentForEditor(p.document);
    titleRef.current = p.document.title;
    frontMatterRef.current = nextDocumentState.frontMatter;
    markdownRef.current = nextDocumentState.body;
    setTitle(p.document.title);
    setFrontMatter(nextDocumentState.frontMatter);
    setFrontMatterOpen(nextDocumentState.frontMatter.trim().length > 0);
    setMarkdown(nextDocumentState.body);
    setLastUpdatedAt(p.document.updatedAt);
    setSaveStatus('saved');
    lastPersistedRef.current = {
      title: p.document.title,
      content: nextDocumentState.persistedContent
    };
    pendingSaveRef.current = null;
    autosaveHydratedRef.current = false;
    setEditorKey(k => k + 1);
  }, [p.document.content, p.document.id, p.document.title, p.document.updatedAt]);

  useEffect(() => {
    if (!readOnly || !collaboration.isFallback || !collaboration.snapshot) return;

    let nextDocumentState = parseStoredDocumentForEditor(collaboration.snapshot);
    titleRef.current = collaboration.snapshot.title;
    frontMatterRef.current = nextDocumentState.frontMatter;
    markdownRef.current = nextDocumentState.body;
    setTitle(collaboration.snapshot.title);
    setFrontMatter(nextDocumentState.frontMatter);
    setFrontMatterOpen(nextDocumentState.frontMatter.trim().length > 0);
    setMarkdown(nextDocumentState.body);
    setLastUpdatedAt(
      collaboration.snapshot.updatedAt instanceof Date
        ? collaboration.snapshot.updatedAt
        : new Date(collaboration.snapshot.updatedAt)
    );
    setSaveStatus('saved');
    setEditorKey(k => k + 1);
  }, [collaboration.isFallback, collaboration.snapshot, readOnly]);

  useEffect(() => {
    if (!editorReadyForAutosave) return;
    if (!autosaveHydratedRef.current) {
      autosaveHydratedRef.current = true;
      return;
    }
    if (!canWrite) return;
    if (!frontMatterValidation.isValid) return;
    enqueueSave();
  }, [
    canWrite,
    documentContent,
    editorReadyForAutosave,
    enqueueSave,
    frontMatterValidation.isValid,
    title
  ]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;

    let handleBeforeUnload = (e: BeforeUnloadEvent) => {
      void flushSave();
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [flushSave, hasUnsavedChanges]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;

    let handleReloadShortcut = (e: KeyboardEvent) => {
      let isReloadShortcut =
        e.key === 'F5' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'r');
      if (!isReloadShortcut) return;

      e.preventDefault();
      e.stopPropagation();
      showToast('Saving document before reload.');
      void flushSave();
    };

    window.addEventListener('keydown', handleReloadShortcut, true);
    return () => window.removeEventListener('keydown', handleReloadShortcut, true);
  }, [flushSave, hasUnsavedChanges, showToast]);

  useBlocker(tx => {
    if (!hasUnsavedChanges) return false;
    if (pendingNavigationRef.current) return false;

    let nextUrl = `${tx.nextLocation.pathname}${tx.nextLocation.search}${tx.nextLocation.hash}`;
    pendingNavigationRef.current = nextUrl;

    void flushSave().then(() => {
      if (pendingSaveRef.current) {
        pendingNavigationRef.current = null;
        showToast('Could not save document.');
        return;
      }

      navigate(
        {
          pathname: tx.nextLocation.pathname,
          search: tx.nextLocation.search,
          hash: tx.nextLocation.hash
        },
        { state: tx.nextLocation.state }
      );
    });

    return true;
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
      void flushSave();
    };
  }, [flushSave]);

  return (
    <ThemeProvider theme={theme}>
      <DocsStyles>
        <ImageUploadProvider upload={uploadImage}>
          <Shell>
            <Header>
              <HeaderLeft>
                {p.onBack && <BackButton onClick={p.onBack} />}
                <TitleButton
                  title={title}
                  readOnly={readOnly}
                  onTitleChange={handleTitleChange}
                />
                <CloudStatus status={saveStatus} />
              </HeaderLeft>

              <HeaderCenter>
                {!readOnly && (
                  <Toolbar
                    editor={editorInstance}
                    disabled={toolbarDisabled}
                    onRequestLinkEdit={handleRequestLinkEdit}
                  />
                )}
              </HeaderCenter>

              <HeaderRight>
                {readOnly && (
                  <ReadOnlyBadge $active>
                    <IconEye />
                    Read-only
                  </ReadOnlyBadge>
                )}

                <Segmented role="tablist" aria-label="Layout">
                  <SegBtn
                    type="button"
                    $active={viewMode === 'editor'}
                    onClick={() => setViewMode('editor')}
                    title="Editor only"
                    aria-label="Editor only"
                  >
                    <IconEdit />
                  </SegBtn>
                  <SegBtn
                    type="button"
                    $active={viewMode === 'split'}
                    onClick={() => setViewMode('split')}
                    title="Split view"
                    aria-label="Split view"
                  >
                    <IconSplit />
                  </SegBtn>
                  <SegBtn
                    type="button"
                    $active={viewMode === 'preview'}
                    onClick={() => setViewMode('preview')}
                    title="Preview only"
                    aria-label="Preview only"
                  >
                    <IconEye />
                  </SegBtn>
                </Segmented>

                {!p.hideSharingControls && (
                  <>
                    <HeaderDivider />
                    <CurrentUserDisplay
                      name={p.user.name}
                      imageUrl={p.user.imageUrl}
                      email={p.user.email}
                    />
                    <ShareButton
                      instanceId={p.instanceId}
                      documentLink={documentLink}
                      people={sharePeople}
                      onCopyLink={handleCopyLink}
                      skillShareContext={skillShareContext}
                      onSharedSkill={p.onSharedSkill}
                    />
                  </>
                )}
                <SettingsButton
                  contentWidth={contentWidth}
                  readOnly={readOnly}
                  onContentWidthChange={setContentWidth}
                  onImport={handleImport}
                  onExport={handleDownload}
                  onPageInfo={() => setPageInfoOpen(true)}
                  onVersionHistory={() => setVersionHistoryOpen(true)}
                  onKeyboardShortcuts={() => setShortcutsOpen(true)}
                />
              </HeaderRight>

              <input
                ref={fileInputRef}
                type="file"
                accept=".md,text/markdown,text/plain"
                style={{ display: 'none' }}
                onChange={handleFile}
              />
            </Header>

            <Main ref={mainRef}>
              {viewMode !== 'preview' && collaboration.isReadyForEditor && (
                <Editor
                  key={editorKey}
                  initialMarkdown={markdown}
                  readOnly={readOnly}
                  title={title}
                  frontMatter={frontMatter}
                  frontMatterOpen={frontMatterOpen}
                  frontMatterError={frontMatterValidation.error}
                  onTitleChange={handleTitleChange}
                  onMarkdownChange={handleMarkdownChange}
                  onFrontMatterChange={handleFrontMatterChange}
                  onToggleFrontMatter={() => setFrontMatterOpen(current => !current)}
                  onEditorReady={setEditorInstance}
                  onTitleFocusChange={setToolbarDisabled}
                  linkPromptToken={linkPromptToken}
                  onRequestLinkEdit={handleRequestLinkEdit}
                  onOpenPageInfo={() => setPageInfoOpen(true)}
                  statusCurrentUser={{
                    name: p.user.name,
                    email: p.user.email,
                    imageUrl: p.user.imageUrl,
                    role: canWrite ? 'editor' : 'viewer'
                  }}
                  statusEditors={statusEditors}
                  statusUpdatedAt={lastUpdatedAt}
                  statusWordCount={wordCount}
                  statusCharCount={charCount}
                  allowInitialHashScroll={allowInitialHashScroll}
                  onInitialHashScrollComplete={() => setAllowInitialHashScroll(false)}
                  collaboration={collaboration.isFallback ? undefined : editorCollaboration}
                />
              )}
              {viewMode === 'split' && (
                <PreviewResizeHandle
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="Resize markdown preview"
                  $active={resizingPreview}
                  onPointerDown={handlePreviewResizeStart}
                />
              )}
              {viewMode !== 'editor' && (
                <Preview
                  markdown={fullMarkdown}
                  width={viewMode === 'split' ? previewWidth : undefined}
                  onCopy={handleCopy}
                  onDownload={handleDownload}
                />
              )}
            </Main>

            <Toast $visible={!!toast}>{toast}</Toast>

            <VersionHistoryPanel
              open={versionHistoryOpen}
              onOpenChange={setVersionHistoryOpen}
              versions={versionHistory}
            />

            <KeyboardShortcutsPanel open={shortcutsOpen} onOpenChange={setShortcutsOpen} />

            <PageInfoDialog
              open={pageInfoOpen}
              onOpenChange={setPageInfoOpen}
              people={people}
              wordCount={wordCount}
              charCount={charCount}
            />
          </Shell>
        </ImageUploadProvider>
      </DocsStyles>
    </ThemeProvider>
  );
};

export let DocumentEditorScene = ({
  instanceId,
  documentId,
  currentConsumerId,
  onBack,
  setRestrictHeight,
  hideSharingControls,
  skillShareContext,
  loadError
}: DocumentEditorSceneProps) => {
  useEffect(() => {
    setRestrictHeight?.(true);
    return () => setRestrictHeight?.(false);
  }, [setRestrictHeight]);

  if (!instanceId) return null;
  if (loadError) {
    return <DocumentEditorLoadError onBack={onBack} message={getErrorMessage(loadError)} />;
  }
  if (!documentId) return <DocumentEditorSkeleton onBack={onBack} />;

  return (
    <DocumentEditorInner
      instanceId={instanceId}
      documentId={documentId}
      currentConsumerId={currentConsumerId}
      onBack={onBack}
      hideSharingControls={hideSharingControls}
      skillShareContext={skillShareContext}
    />
  );
};
