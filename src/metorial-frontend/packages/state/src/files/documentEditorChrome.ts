import {
  type ComponentType,
  useCallback,
  createContext,
  createElement,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';

export type DocumentEditorChrome = 'default' | 'external';

export type DocumentEditorViewMode = 'editor' | 'split' | 'preview';

export type DocumentEditorSaveStatus = 'saved' | 'pending' | 'saving' | 'error';

export type DocumentEditorContentWidth = '720px' | '1000px' | '100%';

export type DocumentEditorChromeState = {
  documentId: string;
  title: string;
  readOnly: boolean;
  saveStatus: DocumentEditorSaveStatus;
  editor: unknown;
  Toolbar: ComponentType;
  toolbarDisabled: boolean;
  isCollaborative: boolean;
  commentsOpen: boolean;
  openCommentCount: number;
  showEditors: boolean;
  viewMode: DocumentEditorViewMode;
  contentWidth: string;
  actions: {
    setTitle: (title: string) => void;
    requestLinkEdit: () => void;
    setCommentsOpen: (open: boolean) => void;
    setShowEditors: (show: boolean) => void;
    setViewMode: (mode: DocumentEditorViewMode) => void;
    setContentWidth: (width: string) => void;
    openVersionHistory: () => void;
    openPageInfo: () => void;
    openShortcuts: () => void;
    importMarkdown: () => void;
    exportMarkdown: () => void;
    copyLink: () => void;
  };
};

type Publish = (state: DocumentEditorChromeState | null) => void;

let PublishContext = createContext<Publish | null>(null);
let StateContext = createContext<DocumentEditorChromeState | null>(null);

let RELEASE_GRACE_MS = 1500;

export let DocumentEditorChromeProvider = (p: { children: ReactNode }) => {
  let [state, setState] = useState<DocumentEditorChromeState | null>(null);
  let releaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  let publish = useCallback<Publish>(next => {
    if (releaseTimer.current) clearTimeout(releaseTimer.current);
    releaseTimer.current = null;

    if (next) {
      setState(next);
      return;
    }

    setState(prev => (prev ? { ...prev, toolbarDisabled: true } : prev));
    releaseTimer.current = setTimeout(() => {
      releaseTimer.current = null;
      setState(null);
    }, RELEASE_GRACE_MS);
  }, []);

  useEffect(
    () => () => {
      if (releaseTimer.current) clearTimeout(releaseTimer.current);
    },
    []
  );

  return createElement(
    PublishContext.Provider,
    { value: publish },
    createElement(StateContext.Provider, { value: state }, p.children)
  );
};

export let useDocumentEditorChrome = () => useContext(StateContext);

export let useIsDocumentEditorChromeHosted = () => !!useContext(PublishContext);

export let usePublishDocumentEditorChrome = (
  enabled: boolean,
  state: Omit<DocumentEditorChromeState, 'actions'>,
  actions: DocumentEditorChromeState['actions']
) => {
  let publish = useContext(PublishContext);

  let actionsRef = useRef(actions);
  actionsRef.current = actions;

  let stableActions = useMemo<DocumentEditorChromeState['actions']>(
    () => ({
      setTitle: title => actionsRef.current.setTitle(title),
      requestLinkEdit: () => actionsRef.current.requestLinkEdit(),
      setCommentsOpen: open => actionsRef.current.setCommentsOpen(open),
      setShowEditors: show => actionsRef.current.setShowEditors(show),
      setViewMode: mode => actionsRef.current.setViewMode(mode),
      setContentWidth: width => actionsRef.current.setContentWidth(width),
      openVersionHistory: () => actionsRef.current.openVersionHistory(),
      openPageInfo: () => actionsRef.current.openPageInfo(),
      openShortcuts: () => actionsRef.current.openShortcuts(),
      importMarkdown: () => actionsRef.current.importMarkdown(),
      exportMarkdown: () => actionsRef.current.exportMarkdown(),
      copyLink: () => actionsRef.current.copyLink()
    }),
    []
  );

  useEffect(() => {
    if (!enabled || !publish) return;

    publish({ ...state, actions: stableActions });
  }, [
    enabled,
    publish,
    stableActions,
    state.documentId,
    state.title,
    state.readOnly,
    state.saveStatus,
    state.editor,
    state.Toolbar,
    state.toolbarDisabled,
    state.isCollaborative,
    state.commentsOpen,
    state.openCommentCount,
    state.showEditors,
    state.viewMode,
    state.contentWidth
  ]);

  useEffect(() => {
    if (!enabled || !publish) return;
    return () => publish(null);
  }, [enabled, publish]);
};
