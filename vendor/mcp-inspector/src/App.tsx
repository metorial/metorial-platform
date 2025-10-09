import {
  ClientRequest,
  CompatibilityCallToolResult,
  CompatibilityCallToolResultSchema,
  CreateMessageResult,
  EmptyResultSchema,
  GetPromptResultSchema,
  ListPromptsResultSchema,
  ListResourcesResultSchema,
  ListResourceTemplatesResultSchema,
  ListToolsResultSchema,
  LoggingLevel,
  ReadResourceResultSchema,
  Resource,
  ResourceTemplate,
  Root,
  ServerNotification,
  Tool
} from '@modelcontextprotocol/sdk/types.js';
import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useConnection } from './lib/hooks/useConnection';
import { useDraggablePane } from './lib/hooks/useDraggablePane';
import { StdErrNotification } from './lib/notificationTypes';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Files, FolderTree, Hammer, Hash, MessageSquare } from 'lucide-react';

import { cx } from 'class-variance-authority';
import { z } from 'zod';
import './App.css';
import ConsoleTab from './components/ConsoleTab';
import HistoryAndNotifications from './components/History';
import PingTab from './components/PingTab';
import PromptsTab, { Prompt } from './components/PromptsTab';
import ResourcesTab from './components/ResourcesTab';
import RootsTab from './components/RootsTab';
import SamplingTab, { PendingRequest } from './components/SamplingTab';
import ToolsTab from './components/ToolsTab';
import { InspectorConfig } from './lib/configurationTypes';
import { DEFAULT_INSPECTOR_CONFIG } from './lib/constants';

const CONFIG_LOCAL_STORAGE_KEY = 'inspectorConfig_v1';

const App = () => {
  const [resources, setResources] = useState<Resource[]>([]);
  const [resourceTemplates, setResourceTemplates] = useState<ResourceTemplate[]>([]);
  const [resourceContent, setResourceContent] = useState<string>('');
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [promptContent, setPromptContent] = useState<string>('');
  const [tools, setTools] = useState<Tool[]>([]);
  const [toolResult, setToolResult] = useState<CompatibilityCallToolResult | null>(null);
  const [errors, setErrors] = useState<Record<string, string | null>>({
    resources: null,
    prompts: null,
    tools: null
  });
  const [command, setCommand] = useState<string>(() => {
    return 'mcp-server-everything';
  });
  const [args, setArgs] = useState<string>(() => {
    return '';
  });

  const [sseUrl, setSseUrl] = useState<string>(() => {
    return 'http://localhost:3001/sse';
  });
  const [transportType, setTransportType] = useState<'stdio' | 'sse' | 'streamable-http'>(
    () => {
      return 'stdio';
    }
  );
  const [logLevel, setLogLevel] = useState<LoggingLevel>('debug');
  const [notifications, setNotifications] = useState<ServerNotification[]>([]);
  const [stdErrNotifications, setStdErrNotifications] = useState<StdErrNotification[]>([]);
  const [roots, setRoots] = useState<Root[]>([]);
  const [env, setEnv] = useState<Record<string, string>>({});

  const [config, setConfig] = useState<InspectorConfig>(() => {
    // const savedConfig = localStorage.getItem(CONFIG_LOCAL_STORAGE_KEY);
    // if (savedConfig) {
    //   // merge default config with saved config
    //   const mergedConfig = {
    //     ...DEFAULT_INSPECTOR_CONFIG,
    //     ...JSON.parse(savedConfig)
    //   } as InspectorConfig;

    //   // update description of keys to match the new description (in case of any updates to the default config description)
    //   Object.entries(mergedConfig).forEach(([key, value]) => {
    //     mergedConfig[key as keyof InspectorConfig] = {
    //       ...value,
    //       label: DEFAULT_INSPECTOR_CONFIG[key as keyof InspectorConfig].label
    //     };
    //   });

    //   return mergedConfig;
    // }
    return DEFAULT_INSPECTOR_CONFIG;
  });
  const [bearerToken, setBearerToken] = useState<string>(() => {
    return '';
  });

  const [headerName, setHeaderName] = useState<string>(() => {
    return '';
  });

  const [pendingSampleRequests, setPendingSampleRequests] = useState<
    Array<
      PendingRequest & {
        resolve: (result: CreateMessageResult) => void;
        reject: (error: Error) => void;
      }
    >
  >([]);
  const nextRequestId = useRef(0);
  const rootsRef = useRef<Root[]>([]);

  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [resourceSubscriptions, setResourceSubscriptions] = useState<Set<string>>(
    new Set<string>()
  );

  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [nextResourceCursor, setNextResourceCursor] = useState<string | undefined>();
  const [nextResourceTemplateCursor, setNextResourceTemplateCursor] = useState<
    string | undefined
  >();
  const [nextPromptCursor, setNextPromptCursor] = useState<string | undefined>();
  const [nextToolCursor, setNextToolCursor] = useState<string | undefined>();
  const progressTokenRef = useRef(0);

  let query = new URLSearchParams(window.location.search);
  let direction =
    query.get('direction') == 'horizontal' ? ('horizontal' as const) : ('vertical' as const);

  const { height: historyPaneHeight, handleDragStart } = useDraggablePane(400, direction);

  const {
    connectionStatus,
    serverCapabilities,
    mcpClient,
    requestHistory,
    makeRequest,
    sendNotification,
    handleCompletion,
    completionsSupported,
    connect: connectMcpServer,
    disconnect: disconnectMcpServer
  } = useConnection({
    transportType,
    command,
    args,
    sseUrl,
    env,
    bearerToken,
    headerName,
    config,
    onNotification: notification => {
      setNotifications(prev => [...prev, notification as ServerNotification]);
    },
    onStdErrNotification: notification => {
      setStdErrNotifications(prev => [...prev, notification as StdErrNotification]);
    },
    onPendingRequest: (request, resolve, reject) => {
      setPendingSampleRequests(prev => [
        ...prev,
        { id: nextRequestId.current++, request, resolve, reject }
      ]);
    },
    getRoots: () => rootsRef.current
  });

  // useEffect(() => {
  //   localStorage.setItem('lastCommand', command);
  // }, [command]);

  // useEffect(() => {
  //   localStorage.setItem('lastArgs', args);
  // }, [args]);

  // useEffect(() => {
  //   localStorage.setItem('lastSseUrl', sseUrl);
  // }, [sseUrl]);

  // useEffect(() => {
  //   localStorage.setItem('lastTransportType', transportType);
  // }, [transportType]);

  // useEffect(() => {
  //   localStorage.setItem('lastBearerToken', bearerToken);
  // }, [bearerToken]);

  // useEffect(() => {
  //   localStorage.setItem('lastHeaderName', headerName);
  // }, [headerName]);

  // useEffect(() => {
  //   localStorage.setItem(CONFIG_LOCAL_STORAGE_KEY, JSON.stringify(config));
  // }, [config]);

  // Auto-connect to previously saved serverURL after OAuth callback
  const onOAuthConnect = useCallback(
    (serverUrl: string) => {
      setSseUrl(serverUrl);
      setTransportType('sse');
      void connectMcpServer();
    },
    [connectMcpServer]
  );

  // useEffect(() => {
  //   fetch(`${getMCPProxyAddress(config)}/config`)
  //     .then((response) => response.json())
  //     .then((data) => {
  //       setEnv(data.defaultEnvironment);
  //       if (data.defaultCommand) {
  //         setCommand(data.defaultCommand);
  //       }
  //       if (data.defaultArgs) {
  //         setArgs(data.defaultArgs);
  //       }
  //     })
  //     .catch((error) =>
  //       console.error("Error fetching default environment:", error),
  //     );
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, []);

  useEffect(() => {
    rootsRef.current = roots;
  }, [roots]);

  useEffect(() => {
    if (!window.location.hash) {
      window.location.hash = 'resources';
    }
  }, []);

  const handleApproveSampling = (id: number, result: CreateMessageResult) => {
    setPendingSampleRequests(prev => {
      const request = prev.find(r => r.id === id);
      request?.resolve(result);
      return prev.filter(r => r.id !== id);
    });
  };

  const handleRejectSampling = (id: number) => {
    setPendingSampleRequests(prev => {
      const request = prev.find(r => r.id === id);
      request?.reject(new Error('Sampling request rejected'));
      return prev.filter(r => r.id !== id);
    });
  };

  const clearError = (tabKey: keyof typeof errors) => {
    setErrors(prev => ({ ...prev, [tabKey]: null }));
  };

  const sendMCPRequest = async <T extends z.ZodType>(
    request: ClientRequest,
    schema: T,
    tabKey?: keyof typeof errors
  ) => {
    try {
      const response = await makeRequest(request, schema);
      if (tabKey !== undefined) {
        clearError(tabKey);
      }
      return response;
    } catch (e) {
      const errorString = (e as Error).message ?? String(e);
      if (tabKey !== undefined) {
        setErrors(prev => ({
          ...prev,
          [tabKey]: errorString
        }));
      }
      throw e;
    }
  };

  const listResources = async () => {
    const response = await sendMCPRequest(
      {
        method: 'resources/list' as const,
        params: nextResourceCursor ? { cursor: nextResourceCursor } : {}
      },
      ListResourcesResultSchema,
      'resources'
    );
    setResources(resources.concat(response.resources ?? []));
    setNextResourceCursor(response.nextCursor);
  };

  const listResourceTemplates = async () => {
    const response = await sendMCPRequest(
      {
        method: 'resources/templates/list' as const,
        params: nextResourceTemplateCursor ? { cursor: nextResourceTemplateCursor } : {}
      },
      ListResourceTemplatesResultSchema,
      'resources'
    );
    setResourceTemplates(resourceTemplates.concat(response.resourceTemplates ?? []));
    setNextResourceTemplateCursor(response.nextCursor);
  };

  const readResource = async (uri: string) => {
    const response = await sendMCPRequest(
      {
        method: 'resources/read' as const,
        params: { uri }
      },
      ReadResourceResultSchema,
      'resources'
    );
    setResourceContent(JSON.stringify(response, null, 2));
  };

  const subscribeToResource = async (uri: string) => {
    if (!resourceSubscriptions.has(uri)) {
      await sendMCPRequest(
        {
          method: 'resources/subscribe' as const,
          params: { uri }
        },
        z.object({}),
        'resources'
      );
      const clone = new Set(resourceSubscriptions);
      clone.add(uri);
      setResourceSubscriptions(clone);
    }
  };

  const unsubscribeFromResource = async (uri: string) => {
    if (resourceSubscriptions.has(uri)) {
      await sendMCPRequest(
        {
          method: 'resources/unsubscribe' as const,
          params: { uri }
        },
        z.object({}),
        'resources'
      );
      const clone = new Set(resourceSubscriptions);
      clone.delete(uri);
      setResourceSubscriptions(clone);
    }
  };

  const listPrompts = async () => {
    const response = await sendMCPRequest(
      {
        method: 'prompts/list' as const,
        params: nextPromptCursor ? { cursor: nextPromptCursor } : {}
      },
      ListPromptsResultSchema,
      'prompts'
    );
    setPrompts(response.prompts);
    setNextPromptCursor(response.nextCursor);
  };

  const getPrompt = async (name: string, args: Record<string, string> = {}) => {
    const response = await sendMCPRequest(
      {
        method: 'prompts/get' as const,
        params: { name, arguments: args }
      },
      GetPromptResultSchema,
      'prompts'
    );
    setPromptContent(JSON.stringify(response, null, 2));
  };

  const listTools = async () => {
    const response = await sendMCPRequest(
      {
        method: 'tools/list' as const,
        params: nextToolCursor ? { cursor: nextToolCursor } : {}
      },
      ListToolsResultSchema,
      'tools'
    );
    setTools(response.tools);
    setNextToolCursor(response.nextCursor);
  };

  const callTool = async (name: string, params: Record<string, unknown>) => {
    try {
      // Remove null params
      for (let key in params) {
        if (params[key] === null) delete params[key];
      }

      const response = await sendMCPRequest(
        {
          method: 'tools/call' as const,
          params: {
            name,
            arguments: params,
            _meta: {
              progressToken: progressTokenRef.current++
            }
          }
        },
        CompatibilityCallToolResultSchema,
        'tools'
      );
      setToolResult(response);
    } catch (e) {
      const toolResult: CompatibilityCallToolResult = {
        content: [
          {
            type: 'text',
            text: (e as Error).message ?? String(e)
          }
        ],
        isError: true
      };
      setToolResult(toolResult);
    }
  };

  const handleRootsChange = async () => {
    await sendNotification({ method: 'notifications/roots/list_changed' });
  };

  const sendLogLevelRequest = async (level: LoggingLevel) => {
    await sendMCPRequest(
      {
        method: 'logging/setLevel' as const,
        params: { level }
      },
      z.object({})
    );
    setLogLevel(level);
  };

  const clearStdErrNotifications = () => {
    setStdErrNotifications([]);
  };

  let autoConnectedRef = useRef(false);
  let connectMcpServerRef = useRef(connectMcpServer);
  connectMcpServerRef.current = connectMcpServer;
  useEffect(() => {
    if (autoConnectedRef.current) return;
    autoConnectedRef.current = true;

    let search = new URLSearchParams(window.location.search);

    let transportType = search.get('transport_type');
    let sseUrl = search.get('sse_url');
    let bearerToken = search.get('bearer_token');

    if (transportType && sseUrl) {
      setTransportType(transportType as 'sse' | 'streamable-http');
      setSseUrl(sseUrl);

      if (bearerToken) {
        setBearerToken(bearerToken);
      }

      setTimeout(() => {
        connectMcpServerRef.current();
      }, 100);

      console.log(
        `Connected to MCP server with transportType: ${transportType}, sseUrl: ${sseUrl}, bearerToken: ${bearerToken}`
      );
    }
  }, []);

  if (window.location.pathname === '/oauth/callback') {
    const OAuthCallback = React.lazy(() => import('./components/OAuthCallback'));
    return (
      <Suspense fallback={<div>Loading...</div>}>
        <OAuthCallback onConnect={onOAuthConnect} />
      </Suspense>
    );
  }

  return (
    <div className="flex h-screen bg-background w-full">
      {/* <Sidebar
        connectionStatus={connectionStatus}
        transportType={transportType}
        setTransportType={setTransportType}
        command={command}
        setCommand={setCommand}
        args={args}
        setArgs={setArgs}
        sseUrl={sseUrl}
        setSseUrl={setSseUrl}
        env={env}
        setEnv={setEnv}
        config={config}
        setConfig={setConfig}
        bearerToken={bearerToken}
        setBearerToken={setBearerToken}
        headerName={headerName}
        setHeaderName={setHeaderName}
        onConnect={connectMcpServer}
        onDisconnect={disconnectMcpServer}
        stdErrNotifications={stdErrNotifications}
        logLevel={logLevel}
        sendLogLevelRequest={sendLogLevelRequest}
        loggingSupported={!!serverCapabilities?.logging || false}
        clearStdErrNotifications={clearStdErrNotifications}
      /> */}

      <div
        className={cx('flex-1 flex overflow-hidden w-[100vw]', {
          'flex-col': direction === 'vertical'
        })}
      >
        <div className="flex-1 overflow-auto">
          {mcpClient ? (
            <Tabs
              defaultValue={
                Object.keys(serverCapabilities ?? {}).includes(window.location.hash.slice(1))
                  ? window.location.hash.slice(1)
                  : serverCapabilities?.tools
                    ? 'tools'
                    : serverCapabilities?.resources
                      ? 'resources'
                      : serverCapabilities?.prompts
                        ? 'prompts'
                        : 'ping'
              }
              className="w-full p-4"
              onValueChange={value => (window.location.hash = value)}
            >
              <TabsList className="mb-4">
                <TabsTrigger value="tools" disabled={!serverCapabilities?.tools}>
                  <Hammer className="w-4 h-4 mr-2" />
                  Tools
                </TabsTrigger>
                <TabsTrigger value="resources" disabled={!serverCapabilities?.resources}>
                  <Files className="w-4 h-4 mr-2" />
                  Resources
                </TabsTrigger>
                <TabsTrigger value="prompts" disabled={!serverCapabilities?.prompts}>
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Prompts
                </TabsTrigger>
                {/* <TabsTrigger value="ping">
                  <Bell className="w-4 h-4 mr-2" />
                  Ping
                </TabsTrigger> */}
                <TabsTrigger value="sampling" className="relative">
                  <Hash className="w-4 h-4 mr-2" />
                  Sampling
                  {pendingSampleRequests.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                      {pendingSampleRequests.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="roots">
                  <FolderTree className="w-4 h-4 mr-2" />
                  Roots
                </TabsTrigger>
              </TabsList>

              <div className="w-full">
                {!serverCapabilities?.resources &&
                !serverCapabilities?.prompts &&
                !serverCapabilities?.tools ? (
                  <div className="flex items-center justify-center p-4">
                    <p className="text-lg text-gray-500">
                      The connected server does not support any MCP capabilities
                    </p>
                  </div>
                ) : (
                  <>
                    {serverCapabilities?.resources && (
                      <ResourcesTab
                        resources={resources}
                        resourceTemplates={resourceTemplates}
                        listResources={() => {
                          clearError('resources');
                          listResources();
                        }}
                        clearResources={() => {
                          setResources([]);
                          setNextResourceCursor(undefined);
                        }}
                        listResourceTemplates={() => {
                          clearError('resources');
                          listResourceTemplates();
                        }}
                        clearResourceTemplates={() => {
                          setResourceTemplates([]);
                          setNextResourceTemplateCursor(undefined);
                        }}
                        readResource={uri => {
                          clearError('resources');
                          readResource(uri);
                        }}
                        selectedResource={selectedResource}
                        setSelectedResource={resource => {
                          clearError('resources');
                          setSelectedResource(resource);
                        }}
                        resourceSubscriptionsSupported={
                          serverCapabilities?.resources?.subscribe || false
                        }
                        resourceSubscriptions={resourceSubscriptions}
                        subscribeToResource={uri => {
                          clearError('resources');
                          subscribeToResource(uri);
                        }}
                        unsubscribeFromResource={uri => {
                          clearError('resources');
                          unsubscribeFromResource(uri);
                        }}
                        handleCompletion={handleCompletion}
                        completionsSupported={completionsSupported}
                        resourceContent={resourceContent}
                        nextCursor={nextResourceCursor}
                        nextTemplateCursor={nextResourceTemplateCursor}
                        error={errors.resources}
                      />
                    )}
                    {serverCapabilities?.prompts && (
                      <PromptsTab
                        prompts={prompts}
                        listPrompts={() => {
                          clearError('prompts');
                          listPrompts();
                        }}
                        clearPrompts={() => {
                          setPrompts([]);
                          setNextPromptCursor(undefined);
                        }}
                        getPrompt={(name, args) => {
                          clearError('prompts');
                          getPrompt(name, args);
                        }}
                        selectedPrompt={selectedPrompt}
                        setSelectedPrompt={prompt => {
                          clearError('prompts');
                          setSelectedPrompt(prompt);
                          setPromptContent('');
                        }}
                        handleCompletion={handleCompletion}
                        completionsSupported={completionsSupported}
                        promptContent={promptContent}
                        nextCursor={nextPromptCursor}
                        error={errors.prompts}
                      />
                    )}
                    {serverCapabilities?.tools && (
                      <ToolsTab
                        tools={tools}
                        listTools={() => {
                          clearError('tools');
                          listTools();
                        }}
                        clearTools={() => {
                          setTools([]);
                          setNextToolCursor(undefined);
                        }}
                        callTool={async (name, params) => {
                          clearError('tools');
                          setToolResult(null);
                          await callTool(name, params);
                        }}
                        selectedTool={selectedTool}
                        setSelectedTool={tool => {
                          clearError('tools');
                          setSelectedTool(tool);
                          setToolResult(null);
                        }}
                        toolResult={toolResult}
                        nextCursor={nextToolCursor}
                        error={errors.tools}
                      />
                    )}
                    <ConsoleTab />
                    <PingTab
                      onPingClick={() => {
                        void sendMCPRequest(
                          {
                            method: 'ping' as const
                          },
                          EmptyResultSchema
                        );
                      }}
                    />
                    <SamplingTab
                      pendingRequests={pendingSampleRequests}
                      onApprove={handleApproveSampling}
                      onReject={handleRejectSampling}
                    />
                    <RootsTab
                      roots={roots}
                      setRoots={setRoots}
                      onRootsChange={handleRootsChange}
                    />
                  </>
                )}
              </div>
            </Tabs>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-lg text-gray-500">
                {/* Connect to an MCP server to start inspecting */}
                <div className="grid min-h-[140px] w-full place-items-center overflow-x-scroll rounded-lg p-6 lg:overflow-visible">
                  <svg
                    className="text-gray-300 animate-spin"
                    viewBox="0 0 64 64"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                  >
                    <path
                      d="M32 3C35.8083 3 39.5794 3.75011 43.0978 5.20749C46.6163 6.66488 49.8132 8.80101 52.5061 11.4939C55.199 14.1868 57.3351 17.3837 58.7925 20.9022C60.2499 24.4206 61 28.1917 61 32C61 35.8083 60.2499 39.5794 58.7925 43.0978C57.3351 46.6163 55.199 49.8132 52.5061 52.5061C49.8132 55.199 46.6163 57.3351 43.0978 58.7925C39.5794 60.2499 35.8083 61 32 61C28.1917 61 24.4206 60.2499 20.9022 58.7925C17.3837 57.3351 14.1868 55.199 11.4939 52.5061C8.801 49.8132 6.66487 46.6163 5.20749 43.0978C3.7501 39.5794 3 35.8083 3 32C3 28.1917 3.75011 24.4206 5.2075 20.9022C6.66489 17.3837 8.80101 14.1868 11.4939 11.4939C14.1868 8.80099 17.3838 6.66487 20.9022 5.20749C24.4206 3.7501 28.1917 3 32 3L32 3Z"
                      stroke="currentColor"
                      strokeWidth="5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    ></path>
                    <path
                      d="M32 3C36.5778 3 41.0906 4.08374 45.1692 6.16256C49.2477 8.24138 52.7762 11.2562 55.466 14.9605C58.1558 18.6647 59.9304 22.9531 60.6448 27.4748C61.3591 31.9965 60.9928 36.6232 59.5759 40.9762"
                      stroke="currentColor"
                      strokeWidth="5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-gray-900"
                    ></path>
                  </svg>
                </div>
              </p>
            </div>
          )}
        </div>

        <div
          className={cx(
            direction == 'horizontal' ? 'relative border-l border-border h-full' : '',
            direction == 'vertical' ? 'border-t border-border w-[100vw] relative' : ''
          )}
          style={{
            width: direction == 'horizontal' ? `${historyPaneHeight}px` : undefined,
            height: direction == 'vertical' ? `${historyPaneHeight}px` : undefined
          }}
        >
          {direction === 'horizontal' && (
            <div
              className="absolute h-full w-4 -left-2 cursor-row-resize flex items-center justify-center hover:bg-accent/50"
              onMouseDown={handleDragStart}
            >
              <div className="h-8 w-1 rounded-full bg-border" />
            </div>
          )}

          {direction === 'vertical' && (
            <div
              className="absolute w-full h-4 -top-2 cursor-col-resize flex items-center justify-center hover:bg-accent/50"
              onMouseDown={handleDragStart}
            >
              <div className="w-8 h-1 rounded-full bg-border" />
            </div>
          )}

          <div className="h-full overflow-auto">
            <HistoryAndNotifications
              requestHistory={requestHistory}
              serverNotifications={notifications}
              direction={direction}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
