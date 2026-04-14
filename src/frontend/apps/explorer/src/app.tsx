import {
  Attributes,
  Button,
  Callout,
  CenteredSpinner,
  Flex,
  Tabs,
  Text,
  theme
} from '@metorial/ui';
import { ID } from '@metorial/ui-product';
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
import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { MarkdownDescription } from './components/markdownDescription';
import { PromptResultView, ResourceResultView, ToolResultView } from './components/resultView';
import { NamedArgumentsForm, SchemaForm } from './components/schemaForm';
import { createExplorerMcpClient, type ExplorerMcpClient } from './lib/mcp/client';
import {
  collectPaginatedItems,
  MAX_CURSOR_ITEMS,
  type PaginatedItemsResult
} from './lib/mcp/pagination';
import {
  getConnectionOverridesFromConfig,
  getConnectionParams,
  isExplorerConfigMessage,
  type ExplorerConnectionOverrides,
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
  min-height: 100vh;
`;

let PageInner = styled.div`
  max-width: 1080px;
  margin: 0 auto;
  padding: 40px 20px 72px 20px;
`;

let Hero = styled.div`
  display: flex;
  flex-direction: column;
  gap: 18px;
`;

let HeroTitle = styled.h1`
  margin: 0;
  font-size: 34px;
  line-height: 1.05;
  font-weight: 700;
  letter-spacing: -0.04em;
`;

let HeroMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
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

let CardHeaderButton = styled.button`
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
`;

let CardTitle = styled.h3`
  margin: 0;
  font-size: 16px;
  line-height: 1.3;
  font-weight: 700;
`;

let CardDescription = styled(MarkdownDescription)``;

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
      <CardHeaderButton type="button" onClick={() => setOpen(current => !current)}>
        <CardHeaderContent>
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription content={description} /> : null}
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
      variant="solid"
      color="gray"
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
          variant="solid"
          color="gray"
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
            variant="solid"
            color="gray"
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

export let ExplorerApp = () => {
  let search = useMemo(() => window.location.search, []);
  let baseQuery = useMemo(() => getConnectionParams(search), [search]);
  let isEmbedded = useMemo(() => window.parent !== window, []);

  let clientRef = useRef<ExplorerMcpClient | null>(null);
  let hasStartedInitialConnectionRef = useRef(false);
  let [connectionOverrides, setConnectionOverrides] = useState<ExplorerConnectionOverrides>();
  let query = useMemo(
    () => getConnectionParams(search, connectionOverrides),
    [connectionOverrides, search]
  );
  let shouldWaitForPostedToken = isEmbedded && !baseQuery.token && !query.token;

  let [activeTab, setActiveTab] = useState<TabId>('tools');
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
    theme.setBodyStyles();
  }, []);

  useEffect(() => {
    let handleMessage = (event: MessageEvent) => {
      if (hasStartedInitialConnectionRef.current) {
        return;
      }

      if (event.source !== window.parent || !isExplorerConfigMessage(event.data)) {
        return;
      }

      setConnectionOverrides(current => ({
        ...current,
        ...getConnectionOverridesFromConfig(event.data)
      }));
    };

    window.addEventListener('message', handleMessage);

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    if (hasStartedInitialConnectionRef.current) {
      return;
    }

    if (shouldWaitForPostedToken) {
      setStatus('idle');
      setConnectionError(null);
      return;
    }

    if (query.errors.length > 0) {
      setStatus('error');
      setConnectionError(query.errors.join(' '));
      return;
    }

    let cancelled = false;

    let connect = async (params: ParsedConnectionParams) => {
      hasStartedInitialConnectionRef.current = true;
      setStatus('connecting');
      setConnectionError(null);
      setCollections(initialCollections);

      try {
        let client = await createExplorerMcpClient(params);

        if (cancelled) {
          await client.close();
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
          await client.close();
          return;
        }

        startTransition(() => {
          setCollections({ tools, resources, resourceTemplates, prompts });
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
      void clientRef.current?.close();
      clientRef.current = null;
    };
  }, [query, shouldWaitForPostedToken]);

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
            {renderTruncationNotice(collections.tools.truncated)}
            {collections.tools.items.length === 0
              ? renderEmptyState('No tools found', 'This MCP server did not return any tools.')
              : collections.tools.items.map(tool => (
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
            {renderTruncationNotice(collections.resources.truncated)}
            {collections.resources.items.length === 0
              ? renderEmptyState(
                  'No resources found',
                  'This MCP server did not return any resources.'
                )
              : collections.resources.items.map(resource => (
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
            {renderTruncationNotice(collections.resourceTemplates.truncated)}
            {collections.resourceTemplates.items.length === 0
              ? renderEmptyState(
                  'No resource templates found',
                  'This MCP server did not return any resource templates.'
                )
              : collections.resourceTemplates.items.map(resourceTemplate => (
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
            {renderTruncationNotice(collections.prompts.truncated)}
            {collections.prompts.items.length === 0
              ? renderEmptyState(
                  'No prompts found',
                  'This MCP server did not return any prompts.'
                )
              : collections.prompts.items.map(prompt => (
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
            <Text color="gray700" style={{ maxWidth: 760, lineHeight: 1.6 }}>
              {query.description?.slice(0, 300) ??
                `Explore the capabilities of the "${query.name}" provider on Metorial`}
            </Text>
          </Flex>

          <Attributes
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
          />

          {query.errors.length > 0 ? (
            <Callout color="red" size="2">
              {query.errors.join(' ')}
            </Callout>
          ) : null}
        </Hero>

        <Section>
          <Tabs
            current={activeTab}
            action={value => setActiveTab(value as TabId)}
            tabs={[
              { id: 'tools', label: `Tools [${collections.tools.items.length}]` },
              {
                id: 'resource-templates',
                label: `Resource Templates [${collections.resourceTemplates.items.length}]`
              },
              { id: 'prompts', label: `Prompts [${collections.prompts.items.length}]` },

              ...(collections.resources.items.length
                ? [
                    {
                      id: 'resources',
                      label: `Resources [${collections.resources.items.length}]`
                    }
                  ]
                : [])
            ]}
            margin={{ bottom: 18, top: 0 }}
          />

          {content}
        </Section>
      </PageInner>
    </Page>
  );
};
