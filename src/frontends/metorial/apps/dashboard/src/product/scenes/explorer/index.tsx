import {
  Button,
  Callout,
  CenteredSpinner,
  Flex,
  Input,
  Tabs,
  Text,
  theme
} from '@metorial/ui';
import type {
  CompatibilityCallToolResult,
  GetPromptResult,
  Prompt,
  ReadResourceResult,
  Resource,
  ResourceTemplate,
  ServerCapabilities,
  Tool
} from '@modelcontextprotocol/sdk/types.js';
import { RiArrowDownSLine } from '@remixicon/react';
import { AnimatePresence, motion } from 'framer-motion';
import Fuse, { type IFuseOptions } from 'fuse.js';
import { startTransition, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { MarkdownDescription } from './components/markdownDescription';
import { PromptResultView, ResourceResultView, ToolResultView } from './components/resultView';
import { NamedArgumentsForm, SchemaForm } from './components/schemaForm';
import { acquireExplorerMcpClient, type ExplorerMcpClient } from './lib/mcp/client';
import {
  collectPaginatedItems,
  MAX_CURSOR_ITEMS,
  type PaginatedItemsResult
} from './lib/mcp/pagination';
import {
  normalizeConnectionParams,
  type ExplorerConnectionInput,
  type ExplorerTransport,
  type ParsedConnectionParams
} from './lib/mcp/query';

type TabId = 'tools' | 'resources' | 'resource-templates' | 'prompts';

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';

type ExplorerCollectionState = {
  tools: PaginatedItemsResult<Tool>;
  resources: PaginatedItemsResult<Resource>;
  resourceTemplates: PaginatedItemsResult<ResourceTemplate>;
  prompts: PaginatedItemsResult<Prompt>;
};

type AsyncActionState<T> = {
  status: 'idle' | 'loading' | 'success' | 'error';
  data?: T;
  error?: string;
};

let initialCollections: ExplorerCollectionState = {
  tools: { items: [], truncated: false },
  resources: { items: [], truncated: false },
  resourceTemplates: { items: [], truncated: false },
  prompts: { items: [], truncated: false }
};

let cssValue = (value: string) => String(value);
let blackButtonStyle = {
  background: cssValue(theme.colors.gray900),
  borderColor: cssValue(theme.colors.gray900),
  color: cssValue(theme.colors.white100)
};

let Page = styled.div`
  height: 100%;
  overflow: auto;
  background: ${theme.colors.background};
`;

let PageInner = styled.div`
  max-width: 1080px;
  margin: 0 auto;
  padding: 40px 20px 130px 20px;
`;

let Hero = styled.div`
  display: flex;
  flex-direction: column;
  gap: 18px;
`;

let HeroTitle = styled.h1`
  margin: 0;
  font-size: 28px;
  line-height: 1.05;
  font-weight: 600;
  letter-spacing: -0.04em;
`;

let Description = styled.p`
  color: ${theme.colors.gray600};
  font-size: 13px;
  margin-top: 5px;
  font-weight: 500;
`;

let MetaPill = styled.div<{ $tone?: 'default' | 'error' | 'success' }>`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid
    ${({ $tone }) =>
      $tone === 'error'
        ? cssValue(theme.colors.red600)
        : $tone === 'success'
          ? cssValue(theme.colors.green700)
          : cssValue(theme.colors.gray400)};
  background: ${({ $tone }) =>
    $tone === 'error'
      ? cssValue(theme.colors.red200)
      : $tone === 'success'
        ? cssValue(theme.colors.green200)
        : cssValue(theme.colors.gray200)};
  color: ${({ $tone }) =>
    $tone === 'error'
      ? cssValue(theme.colors.red900)
      : $tone === 'success'
        ? cssValue(theme.colors.green900)
        : cssValue(theme.colors.gray800)};
`;

let Section = styled.div`
  margin-top: 24px;
`;

let Panel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

let SearchRow = styled.div`
  max-width: 420px;
`;

let Card = styled.div<{ $open: boolean; $error?: boolean }>`
  border: 1px solid
    ${({ $error, $open }) =>
      $error ? cssValue(theme.colors.red600) : cssValue(theme.colors.gray300)};
  border-radius: 8px;
  overflow: hidden;
  background: ${({ $error, $open }) =>
    $error ? cssValue(theme.colors.red100) : cssValue(theme.colors.white100)};
  box-shadow: ${({ $open }) => ($open ? cssValue(theme.shadows.medium) : 'none')};
  transition: all 0.2s ease;
`;

let CardHeaderButton = styled.div`
  width: 100%;
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
  padding: 18px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
`;

let CardHeaderContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  width: 100%;
`;

let CardTitle = styled.h3`
  margin: 0;
  font-size: 16px;
  line-height: 1.3;
  font-weight: 700;
`;

let CardDescription = styled(MarkdownDescription)``;

let DescriptionFrame = styled(motion.div)<{ $expanded: boolean; $canExpand: boolean }>`
  position: relative;
  overflow: ${({ $canExpand }) => ($canExpand ? 'hidden' : 'visible')};
`;

let DescriptionOverlay = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 86px;
  pointer-events: none;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0) 0%,
    rgba(255, 255, 255, 0.92) 62%,
    ${cssValue(theme.colors.white100)} 100%
  );
`;

let DescriptionExpandButtonWrap = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 14px;
  z-index: 1;
  display: flex;
  justify-content: center;
  padding-top: 10px;
  pointer-events: none;

  button {
    pointer-events: auto;
  }
`;

let CardBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 0 20px 20px 20px;
  border-top: 1px solid ${cssValue(theme.colors.gray300)};
`;

let CardBodyMotion = styled(motion.div)`
  overflow: hidden;
`;

let EmptyState = styled.div`
  h2 {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 7px;
  }

  p {
    font-size: 12px;
    color: ${cssValue(theme.colors.gray600)};
    font-weight: 500;
  }
`;

let ExpandIndicator = styled.div<{ $open: boolean }>`
  flex-shrink: 0;
  width: 34px;
  height: 34px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${cssValue(theme.colors.gray600)};
  transform: ${({ $open }) => ($open ? 'rotate(180deg)' : 'rotate(0deg)')};
  transition: transform 0.2s ease;

  svg {
    height: 24px;
    width: 24px;
  }
`;

let TruncationNotice = styled.div`
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid ${cssValue(theme.colors.orange700)};
  background: ${cssValue(theme.colors.orange200)};
  color: ${cssValue(theme.colors.gray900)};
  font-size: 13px;
  line-height: 1.45;
`;

let InlineCode = styled.code`
  font-size: 12px;
  background: ${cssValue(theme.colors.gray200)};
  color: ${cssValue(theme.colors.gray900)};
  padding: 2px 6px;
  border-radius: 999px;
`;

let getStatusTone = (status: ConnectionStatus): 'default' | 'error' | 'success' => {
  if (status === 'connected') return 'success';
  if (status === 'error') return 'error';
  return 'default';
};

let getTransportLabel = (transport?: ExplorerTransport) => {
  if (transport === 'streamable_http') return 'Streamable HTTP';
  if (transport === 'sse') return 'SSE';
  return 'Unknown';
};

let extractTemplateArguments = (uriTemplate: string) => {
  let matches = uriTemplate.match(/{([^}]+)}/g) ?? [];

  return matches.map(match => {
    let name = match.slice(1, -1);
    return {
      name,
      label: name,
      description: 'Required template value',
      required: true
    };
  });
};

let resolveTemplateUri = (uriTemplate: string, values: Record<string, string | undefined>) =>
  uriTemplate.replace(/{([^}]+)}/g, (_, key: string) => values[key] ?? '');

let getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return typeof error === 'string' ? error : 'Unknown error';
};

let normalizeSearchValue = (value: string) => value.trim();

let searchItems = <T,>(items: T[], query: string, keys: IFuseOptions<T>['keys']) => {
  if (!query) return items;

  let fuse = new Fuse(items, {
    keys,
    threshold: 0.35,
    ignoreLocation: true
  });

  return fuse.search(query).map(result => result.item);
};

let getTabLabel = (tab: TabId) => {
  if (tab === 'tools') return 'tools';
  if (tab === 'resources') return 'resources';
  if (tab === 'resource-templates') return 'resource templates';
  return 'prompts';
};

let readOperationNamePrefixes = [
  'list',
  'get',
  'read',
  'fetch',
  'search',
  'find',
  'lookup',
  'retrieve',
  'query',
  'describe',
  'inspect',
  'view',
  'show'
];

let isReadOperationToolName = (name: string) => {
  let normalizedName = name.trim().toLowerCase();
  return readOperationNamePrefixes.some(prefix => normalizedName.startsWith(prefix));
};

let prioritizeReadOperationTools = (tools: Tool[]) =>
  [...tools].sort((a, b) => {
    let aIsReadOperation = isReadOperationToolName(a.name);
    let bIsReadOperation = isReadOperationToolName(b.name);

    if (aIsReadOperation === bIsReadOperation) return 0;
    return aIsReadOperation ? -1 : 1;
  });

let ExpandableDescription = ({ content }: { content: string }) => {
  let descriptionRef = useRef<HTMLDivElement | null>(null);
  let [expanded, setExpanded] = useState(false);
  let [canExpand, setCanExpand] = useState(false);
  let [shouldAnimateHeight, setShouldAnimateHeight] = useState(false);

  useEffect(() => {
    setExpanded(false);
    setShouldAnimateHeight(false);
  }, [content]);

  useEffect(() => {
    if (!canExpand) {
      setShouldAnimateHeight(false);
      return;
    }

    let frame = window.requestAnimationFrame(() => {
      setShouldAnimateHeight(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [canExpand, content]);

  useLayoutEffect(() => {
    let element = descriptionRef.current;
    if (!element) return;

    let updateCanExpand = () => {
      setCanExpand(element.scrollHeight > 250);
    };

    updateCanExpand();

    let observer = new ResizeObserver(updateCanExpand);
    observer.observe(element);
    window.addEventListener('resize', updateCanExpand);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateCanExpand);
    };
  }, [content, expanded]);

  return (
    <DescriptionFrame
      ref={descriptionRef}
      $expanded={expanded}
      $canExpand={canExpand}
      initial={false}
      animate={{ height: !expanded && canExpand ? 250 : 'auto' }}
      transition={{ duration: shouldAnimateHeight ? 0.22 : 0, ease: 'easeInOut' }}
    >
      <CardDescription content={content} />
      {!expanded && canExpand ? (
        <>
          <DescriptionOverlay />
          <DescriptionExpandButtonWrap>
            <Button
              type="button"
              size="2"
              variant="solid"
              style={blackButtonStyle}
              onKeyDown={event => event.stopPropagation()}
              onClick={event => {
                event.stopPropagation();
                setExpanded(true);
              }}
            >
              Expand Description
            </Button>
          </DescriptionExpandButtonWrap>
        </>
      ) : null}
    </DescriptionFrame>
  );
};

let ExpandableCard = ({
  title,
  description,
  error,
  children,
  defaultOpen = false
}: {
  title: string;
  description?: string | null;
  error?: boolean;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) => {
  let [open, setOpen] = useState(defaultOpen);

  let cardBodyAnimation = {
    initial: { height: 0, opacity: 0 },
    animate: {
      height: 'auto',
      opacity: 1,
      transition: {
        height: { duration: 0.22, ease: 'easeInOut' },
        opacity: { duration: 0.18, ease: 'easeInOut' }
      }
    },
    exit: {
      height: 0,
      opacity: 0,
      transition: {
        height: { duration: 0.18, ease: 'easeInOut' },
        opacity: { duration: 0.12, ease: 'easeInOut' }
      }
    }
  } as const;

  return (
    <Card $open={open} $error={error}>
      <CardHeaderButton
        role="button"
        tabIndex={0}
        onClick={() => setOpen(current => !current)}
        onKeyDown={event => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          setOpen(current => !current);
        }}
      >
        <CardHeaderContent>
          <CardTitle>{title}</CardTitle>
          {description ? <ExpandableDescription content={description} /> : null}
        </CardHeaderContent>
        <ExpandIndicator $open={open}>
          <RiArrowDownSLine />
        </ExpandIndicator>
      </CardHeaderButton>

      <AnimatePresence initial={false}>
        {open ? (
          <CardBodyMotion
            key="card-body"
            initial={cardBodyAnimation.initial}
            animate={cardBodyAnimation.animate}
            exit={cardBodyAnimation.exit}
          >
            <CardBody>{children}</CardBody>
          </CardBodyMotion>
        ) : null}
      </AnimatePresence>
    </Card>
  );
};

let ToolCard = ({
  tool,
  state,
  onCall
}: {
  tool: Tool;
  state?: AsyncActionState<CompatibilityCallToolResult>;
  onCall: (name: string, values: Record<string, unknown>) => Promise<void>;
}) => {
  let schema = (tool.inputSchema ?? {
    type: 'object',
    properties: {}
  }) as any;

  return (
    <ExpandableCard
      title={tool.title ?? tool.name}
      description={tool.description ?? 'No description provided.'}
      error={state?.status === 'error' || state?.data?.isError === true}
    >
      <SchemaForm
        schema={schema}
        submitLabel="Call Tool"
        isSubmitting={state?.status === 'loading'}
        onSubmit={values => onCall(tool.name, values)}
      />

      {state?.status === 'error' ? (
        <Callout color="red" size="2">
          {state.error}
        </Callout>
      ) : null}

      {state?.data ? <ToolResultView result={state.data} /> : null}
    </ExpandableCard>
  );
};

let ResourceCard = ({
  resource,
  state,
  onRead
}: {
  resource: Resource;
  state?: AsyncActionState<ReadResourceResult>;
  onRead: (resource: Resource) => Promise<void>;
}) => (
  <ExpandableCard
    title={resource.title ?? resource.name}
    description={resource.description ?? resource.uri}
    error={state?.status === 'error'}
  >
    <Flex gap={10} wrap="wrap">
      <MetaPill>
        URI <InlineCode>{resource.uri}</InlineCode>
      </MetaPill>
      {resource.mimeType ? (
        <MetaPill>
          MIME <InlineCode>{resource.mimeType}</InlineCode>
        </MetaPill>
      ) : null}
    </Flex>

    <Button
      type="button"
      style={blackButtonStyle}
      loading={state?.status === 'loading'}
      onClick={() => onRead(resource)}
    >
      Get Resource
    </Button>

    {state?.status === 'error' ? (
      <Callout color="red" size="2">
        {state.error}
      </Callout>
    ) : null}
    {state?.data ? <ResourceResultView result={state.data} /> : null}
  </ExpandableCard>
);

let ResourceTemplateCard = ({
  resourceTemplate,
  state,
  onRead
}: {
  resourceTemplate: ResourceTemplate;
  state?: AsyncActionState<ReadResourceResult>;
  onRead: (
    resourceTemplate: ResourceTemplate,
    values: Record<string, string | undefined>
  ) => Promise<void>;
}) => {
  let fields = extractTemplateArguments(resourceTemplate.uriTemplate);

  return (
    <ExpandableCard
      title={resourceTemplate.title ?? resourceTemplate.name}
      description={resourceTemplate.description ?? resourceTemplate.uriTemplate}
      error={state?.status === 'error'}
    >
      <MetaPill>
        Template <InlineCode>{resourceTemplate.uriTemplate}</InlineCode>
      </MetaPill>

      {fields.length > 0 ? (
        <NamedArgumentsForm
          fields={fields}
          submitLabel="Get Resource"
          isSubmitting={state?.status === 'loading'}
          onSubmit={values => onRead(resourceTemplate, values)}
        />
      ) : (
        <Button
          type="button"
          style={blackButtonStyle}
          loading={state?.status === 'loading'}
          onClick={() => onRead(resourceTemplate, {})}
        >
          Get Resource
        </Button>
      )}

      {state?.status === 'error' ? (
        <Callout color="red" size="2">
          {state.error}
        </Callout>
      ) : null}
      {state?.data ? <ResourceResultView result={state.data} /> : null}
    </ExpandableCard>
  );
};

let PromptCard = ({
  prompt,
  state,
  onGet
}: {
  prompt: Prompt;
  state?: AsyncActionState<GetPromptResult>;
  onGet: (prompt: Prompt, values: Record<string, string | undefined>) => Promise<void>;
}) => {
  let fields = (prompt.arguments ?? []).map(argument => ({
    name: argument.name,
    label: argument.name,
    description: argument.description,
    required: argument.required ?? false
  }));

  return (
    <ExpandableCard
      title={prompt.title ?? prompt.name}
      description={prompt.description ?? 'No description provided.'}
      error={state?.status === 'error'}
    >
      {fields.length > 0 ? (
        <NamedArgumentsForm
          fields={fields}
          submitLabel="Get Prompt"
          isSubmitting={state?.status === 'loading'}
          onSubmit={values => onGet(prompt, values)}
        />
      ) : (
        <div>
          <Button
            type="button"
            style={blackButtonStyle}
            loading={state?.status === 'loading'}
            onClick={() => onGet(prompt, {})}
            size="2"
          >
            Get Prompt
          </Button>
        </div>
      )}

      {state?.status === 'error' ? (
        <Callout color="red" size="2">
          {state.error}
        </Callout>
      ) : null}
      {state?.data ? <PromptResultView result={state.data} /> : null}
    </ExpandableCard>
  );
};

export type ExplorerSceneProps = {
  connection: ExplorerConnectionInput;
};

export let ExplorerScene = ({ connection }: ExplorerSceneProps) => {
  let clientRef = useRef<ExplorerMcpClient | null>(null);
  let query = useMemo(
    () => normalizeConnectionParams(connection),
    [
      connection.description,
      connection.name,
      connection.token,
      connection.transport,
      connection.url
    ]
  );

  let [activeTab, setActiveTab] = useState<TabId>('tools');
  let [searchByTab, setSearchByTab] = useState<Record<TabId, string>>({
    tools: '',
    resources: '',
    'resource-templates': '',
    prompts: ''
  });
  let [status, setStatus] = useState<ConnectionStatus>(
    query.errors.length > 0 ? 'error' : 'idle'
  );
  let [connectionError, setConnectionError] = useState<string | null>(
    query.errors.length > 0 ? query.errors.join(' ') : null
  );
  let [serverCapabilities, setServerCapabilities] = useState<ServerCapabilities | null>(null);
  let [serverVersion, setServerVersion] = useState<string | null>(null);
  let [collections, setCollections] = useState<ExplorerCollectionState>(initialCollections);
  let [toolStates, setToolStates] = useState<
    Record<string, AsyncActionState<CompatibilityCallToolResult>>
  >({});
  let [resourceStates, setResourceStates] = useState<
    Record<string, AsyncActionState<ReadResourceResult>>
  >({});
  let [templateStates, setTemplateStates] = useState<
    Record<string, AsyncActionState<ReadResourceResult>>
  >({});
  let [promptStates, setPromptStates] = useState<
    Record<string, AsyncActionState<GetPromptResult>>
  >({});

  useEffect(() => {
    if (query.errors.length > 0) {
      setStatus('error');
      setConnectionError(query.errors.join(' '));
      setCollections(initialCollections);
      setServerCapabilities(null);
      setServerVersion(null);
      return;
    }

    let cancelled = false;
    let lease: ReturnType<typeof acquireExplorerMcpClient> | null = null;

    let connect = async (params: ParsedConnectionParams) => {
      setStatus('connecting');
      setConnectionError(null);
      setCollections(initialCollections);
      setServerCapabilities(null);
      setServerVersion(null);
      setToolStates({});
      setResourceStates({});
      setTemplateStates({});
      setPromptStates({});

      try {
        lease = acquireExplorerMcpClient(params);
        let client = await lease.promise;

        if (cancelled) {
          return;
        }

        clientRef.current = client;

        let [tools, resources, resourceTemplates, prompts] = await Promise.all([
          collectPaginatedItems({
            fetchPage: cursor => client.listTools(cursor ? { cursor } : undefined),
            getItems: page => page.tools ?? []
          }),
          collectPaginatedItems({
            fetchPage: cursor => client.listResources(cursor ? { cursor } : undefined),
            getItems: page => page.resources ?? []
          }),
          collectPaginatedItems({
            fetchPage: cursor => client.listResourceTemplates(cursor ? { cursor } : undefined),
            getItems: page => page.resourceTemplates ?? []
          }),
          collectPaginatedItems({
            fetchPage: cursor => client.listPrompts(cursor ? { cursor } : undefined),
            getItems: page => page.prompts ?? []
          })
        ]);

        if (cancelled) {
          return;
        }

        startTransition(() => {
          setCollections({
            tools: { ...tools, items: prioritizeReadOperationTools(tools.items) },
            resources,
            resourceTemplates,
            prompts
          });
          setServerCapabilities(client.getServerCapabilities() ?? null);
          setServerVersion(client.getServerVersion()?.version ?? null);
          setStatus('connected');
        });
      } catch (error) {
        if (cancelled) return;

        setStatus('error');
        setConnectionError(getErrorMessage(error));
      }
    };

    void connect(query);

    return () => {
      cancelled = true;
      clientRef.current = null;
      lease?.release();
    };
  }, [query]);

  let handleToolCall = async (name: string, values: Record<string, unknown>) => {
    setToolStates(current => ({
      ...current,
      [name]: {
        status: 'loading'
      }
    }));

    try {
      let result = await clientRef.current?.callTool({ name, arguments: values });

      if (!result) throw new Error('MCP client is not connected');

      setToolStates(current => ({
        ...current,
        [name]: {
          status: 'success',
          data: result
        }
      }));
    } catch (error) {
      setToolStates(current => ({
        ...current,
        [name]: {
          status: 'error',
          error: getErrorMessage(error)
        }
      }));
    }
  };

  let handleResourceRead = async (resource: Resource) => {
    setResourceStates(current => ({
      ...current,
      [resource.uri]: { status: 'loading' }
    }));

    try {
      let result = await clientRef.current?.readResource({ uri: resource.uri });

      if (!result) throw new Error('MCP client is not connected');

      setResourceStates(current => ({
        ...current,
        [resource.uri]: {
          status: 'success',
          data: result
        }
      }));
    } catch (error) {
      setResourceStates(current => ({
        ...current,
        [resource.uri]: {
          status: 'error',
          error: getErrorMessage(error)
        }
      }));
    }
  };

  let handleResourceTemplateRead = async (
    resourceTemplate: ResourceTemplate,
    values: Record<string, string | undefined>
  ) => {
    let key = resourceTemplate.uriTemplate;

    setTemplateStates(current => ({
      ...current,
      [key]: { status: 'loading' }
    }));

    try {
      let uri = resolveTemplateUri(resourceTemplate.uriTemplate, values);
      let result = await clientRef.current?.readResource({ uri });

      if (!result) throw new Error('MCP client is not connected');

      setTemplateStates(current => ({
        ...current,
        [key]: {
          status: 'success',
          data: result
        }
      }));
    } catch (error) {
      setTemplateStates(current => ({
        ...current,
        [key]: {
          status: 'error',
          error: getErrorMessage(error)
        }
      }));
    }
  };

  let handlePromptGet = async (prompt: Prompt, values: Record<string, string | undefined>) => {
    setPromptStates(current => ({
      ...current,
      [prompt.name]: { status: 'loading' }
    }));

    try {
      let promptArguments = Object.fromEntries(
        Object.entries(values).filter(
          (entry): entry is [string, string] => entry[1] !== undefined
        )
      );

      let result = await clientRef.current?.getPrompt({
        name: prompt.name,
        arguments: promptArguments
      });

      if (!result) throw new Error('MCP client is not connected');

      setPromptStates(current => ({
        ...current,
        [prompt.name]: {
          status: 'success',
          data: result
        }
      }));
    } catch (error) {
      setPromptStates(current => ({
        ...current,
        [prompt.name]: {
          status: 'error',
          error: getErrorMessage(error)
        }
      }));
    }
  };

  let renderTruncationNotice = (truncated: boolean) => {
    if (!truncated) return null;

    return (
      <TruncationNotice>
        Listing stopped after {MAX_CURSOR_ITEMS} items as a safeguard for cursor-based
        pagination.
      </TruncationNotice>
    );
  };

  let renderEmptyState = (title: string, description: string) => (
    <EmptyState>
      <h2>{title}</h2>
      <p>{description}</p>
    </EmptyState>
  );

  let renderSearchBox = (tab: TabId) => {
    let label = getTabLabel(tab);

    return (
      <SearchRow>
        <Input
          label={`Search ${label}`}
          hideLabel
          placeholder={`Search ${label} by name...`}
          value={searchByTab[tab]}
          onChange={event => {
            let value = event.currentTarget.value;

            setSearchByTab(current => ({
              ...current,
              [tab]: value
            }));
          }}
        />
      </SearchRow>
    );
  };

  let toolSearch = normalizeSearchValue(searchByTab.tools);
  let resourceSearch = normalizeSearchValue(searchByTab.resources);
  let resourceTemplateSearch = normalizeSearchValue(searchByTab['resource-templates']);
  let promptSearch = normalizeSearchValue(searchByTab.prompts);

  let filteredTools = searchItems(collections.tools.items, toolSearch, [
    { name: 'name', weight: 1 },
    { name: 'description', weight: 0.15 }
  ]);
  let filteredResources = searchItems(collections.resources.items, resourceSearch, [
    { name: 'name', weight: 1 },
    { name: 'uri', weight: 0.7 },
    { name: 'description', weight: 0.15 }
  ]);
  let filteredResourceTemplates = searchItems(
    collections.resourceTemplates.items,
    resourceTemplateSearch,
    [
      { name: 'name', weight: 1 },
      { name: 'uriTemplate', weight: 0.7 },
      { name: 'description', weight: 0.15 }
    ]
  );
  let filteredPrompts = searchItems(collections.prompts.items, promptSearch, [
    { name: 'name', weight: 1 },
    { name: 'description', weight: 0.15 }
  ]);

  let tabs: { id: TabId; label: string }[] = [
    { id: 'tools', label: `Tools [${collections.tools.items.length}]` }
  ];

  if (collections.resourceTemplates.items.length) {
    tabs.push({
      id: 'resource-templates',
      label: `Resource Templates [${collections.resourceTemplates.items.length}]`
    });
  }

  if (collections.prompts.items.length) {
    tabs.push({ id: 'prompts', label: `Prompts [${collections.prompts.items.length}]` });
  }

  if (collections.resources.items.length) {
    tabs.push({
      id: 'resources',
      label: `Resources [${collections.resources.items.length}]`
    });
  }

  let content = (() => {
    if (status === 'connecting' || status === 'idle') {
      return (
        <Panel>
          <CenteredSpinner size={28} />
          <Text align="center" color="gray700">
            Connecting to the MCP server and loading capabilities...
          </Text>
        </Panel>
      );
    }

    if (status === 'error') {
      return (
        <Panel>
          <Callout color="red" size="2">
            {connectionError ??
              'The explorer could not connect with the current URL parameters.'}
          </Callout>
        </Panel>
      );
    }

    switch (activeTab) {
      case 'tools':
        return (
          <Panel>
            {renderSearchBox('tools')}
            {renderTruncationNotice(collections.tools.truncated)}
            {collections.tools.items.length === 0
              ? renderEmptyState('No tools found', "This provider doesn't support tools.")
              : filteredTools.length === 0
                ? renderEmptyState('No matching tools found', 'No tools match your search.')
                : filteredTools.map(tool => (
                    <ToolCard
                      key={tool.name}
                      tool={tool}
                      state={toolStates[tool.name]}
                      onCall={handleToolCall}
                    />
                  ))}
          </Panel>
        );
      case 'resources':
        return (
          <Panel>
            {renderSearchBox('resources')}
            {renderTruncationNotice(collections.resources.truncated)}
            {collections.resources.items.length === 0
              ? renderEmptyState(
                  'No resources found',
                  "This provider doesn't support resources."
                )
              : filteredResources.length === 0
                ? renderEmptyState(
                    'No matching resources found',
                    'No resources match your search.'
                  )
                : filteredResources.map(resource => (
                    <ResourceCard
                      key={resource.uri}
                      resource={resource}
                      state={resourceStates[resource.uri]}
                      onRead={handleResourceRead}
                    />
                  ))}
          </Panel>
        );
      case 'resource-templates':
        return (
          <Panel>
            {renderSearchBox('resource-templates')}
            {renderTruncationNotice(collections.resourceTemplates.truncated)}
            {collections.resourceTemplates.items.length === 0
              ? renderEmptyState(
                  'No resource templates found',
                  "This provider doesn't support resource templates."
                )
              : filteredResourceTemplates.length === 0
                ? renderEmptyState(
                    'No matching resource templates found',
                    'No resource templates match your search.'
                  )
                : filteredResourceTemplates.map(resourceTemplate => (
                    <ResourceTemplateCard
                      key={resourceTemplate.uriTemplate}
                      resourceTemplate={resourceTemplate}
                      state={templateStates[resourceTemplate.uriTemplate]}
                      onRead={handleResourceTemplateRead}
                    />
                  ))}
          </Panel>
        );
      case 'prompts':
        return (
          <Panel>
            {renderSearchBox('prompts')}
            {renderTruncationNotice(collections.prompts.truncated)}
            {collections.prompts.items.length === 0
              ? renderEmptyState('No prompts found', "This provider doesn't support prompts.")
              : filteredPrompts.length === 0
                ? renderEmptyState(
                    'No matching prompts found',
                    'No prompts match your search.'
                  )
                : filteredPrompts.map(prompt => (
                    <PromptCard
                      key={prompt.name}
                      prompt={prompt}
                      state={promptStates[prompt.name]}
                      onGet={handlePromptGet}
                    />
                  ))}
          </Panel>
        );
    }
  })();

  return (
    <Page>
      <PageInner>
        <Hero>
          <Flex direction="column" gap={10}>
            <HeroTitle>{query.name}</HeroTitle>
            <Description>
              {query.description?.slice(0, 300) ??
                `Explore the capabilities of the "${query.name}" provider on Metorial`}
            </Description>
          </Flex>

          {/* <Attributes
            attributes={[
              {
                label: 'Status',
                content:
                  {
                    connected: 'Connected',
                    connecting: 'Connecting',
                    idle: 'Connecting',
                    error: 'Error'
                  }[status] ?? status
              },
              {
                label: 'Transport',
                content: getTransportLabel(query.transport)
              },
              {
                label: 'URL',
                content: <ID id={query.url} />
              }
            ]}
          /> */}

          {query.errors.length > 0 ? (
            <Callout color="red" size="2">
              {query.errors.join(' ')}
            </Callout>
          ) : null}
        </Hero>

        <Section>
          {tabs.length > 1 ? (
            <Tabs
              current={activeTab}
              action={value => setActiveTab(value as TabId)}
              tabs={tabs}
              margin={{ bottom: 18, top: 0 }}
            />
          ) : null}

          {content}
        </Section>
      </PageInner>
    </Page>
  );
};

export let ExplorerApp = ExplorerScene;
