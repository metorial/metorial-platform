import { Cases } from '@lowerdeck/case';
import {
  badRequestError,
  internalServerError,
  isServiceError,
  ServiceError
} from '@lowerdeck/error';
import { generatePlainId } from '@lowerdeck/id';
import { getSentry } from '@lowerdeck/sentry';
import {
  checkResourceAccessManager,
  conduitResultToMcpMessage,
  markdownList,
  mcpValidate
} from '@metorial-subspace/connection-utils';
import {
  db,
  messageTranslator,
  type SessionConnectionMcpConnectionTransport
} from '@metorial-subspace/db';
import {
  type CallToolRequest,
  CallToolRequestSchema,
  type GetPromptRequest,
  GetPromptRequestSchema,
  type InitializeRequest,
  InitializeRequestSchema,
  type InitializeResult,
  type JSONRPCErrorResponse,
  type JSONRPCMessage,
  type JSONRPCRequest,
  type JSONRPCResponse,
  ListPromptsRequestSchema,
  type ListPromptsResult,
  type ListResourcesRequest,
  ListResourcesRequestSchema,
  type ListResourcesResult,
  ListResourceTemplatesRequestSchema,
  type ListResourceTemplatesResult,
  ListToolsRequestSchema,
  type ListToolsResult,
  type ReadResourceRequest,
  ReadResourceRequestSchema,
  type Resource
} from '@modelcontextprotocol/sdk/types.js';
import { uniqBy } from 'lodash';
import { PING_MESSAGE_ID_PREFIX } from '../const';
import { providerToolPresenter } from '../presenter';
import { upsertParticipant } from '../shared/upsertParticipant';
import type { McpControlMessageHandler } from './control';
import type { McpManager } from './manager';

let Sentry = getSentry();

type ID = string | number;

export type HandleResponseOpts = { waitForResponse: boolean };

export class McpSender {
  constructor(
    private readonly mcpTransport: SessionConnectionMcpConnectionTransport,
    private readonly manager: McpManager,
    private readonly control: McpControlMessageHandler
  ) {}

  get session() {
    return this.manager.session;
  }

  get connection() {
    return this.manager.connection;
  }

  async handleMessage(msg: JSONRPCMessage, opts: HandleResponseOpts) {
    let method = 'method' in msg ? msg.method : undefined;
    let id = 'id' in msg ? msg.id : undefined;

    try {
      let res = await this.handleMessageInternal(msg, opts);
      if (!res || !res.mcp) return null;

      let message = 'message' in res && res.message ? res.message : null;
      let isBroadcastBySender = !!message;

      if (res.store && !message) {
        let senderParticipant =
          this.connection?.participant ??
          (await upsertParticipant({
            session: this.session,
            from: { type: 'unknown' }
          }));
        let responderParticipant = await upsertParticipant({
          session: this.session,
          from: { type: 'system' }
        });

        message = await this.manager.createMessage({
          status: 'error' in res.mcp ? 'failed' : 'succeeded',
          type: 'mcp_control',
          source: 'client',
          isProductive: true,

          senderParticipant,
          responderParticipant,

          input: { type: 'mcp', data: msg },
          output: { type: 'mcp', data: res.mcp },

          methodOrToolKey: method,
          clientMcpId: id ?? null,
          transport: 'mcp'
        });
      }

      if (!isBroadcastBySender) {
        await this.control.sendControlMessage({
          type: 'mcp_control_message',
          conduit: {
            message,
            status: 'error' in res.mcp ? 'failed' : 'succeeded',
            output: { type: 'mcp', data: res.mcp },
            completedAt: message?.completedAt ?? null
          },
          channel: 'targeted_response'
        });
      }

      return {
        message,
        mcp: res.mcp
      };
    } catch (e) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error handling MCP message:', e);
      }

      if (!isServiceError(e)) {
        Sentry.captureException(e);
      }

      let error = isServiceError(e)
        ? e
        : internalServerError({ message: 'Internal server error processing MCP message' });

      let senderParticipant =
        this.connection?.participant ??
        (await upsertParticipant({
          session: this.session,
          from: { type: 'unknown' }
        }));
      let responderParticipant = await upsertParticipant({
        session: this.session,
        from: { type: 'system' }
      });

      let message = await this.manager.createMessage({
        status: 'failed',
        type: 'unknown',
        source: 'client',
        isProductive: true,
        failureReason: 'system_error',

        senderParticipant,
        responderParticipant,

        input: { type: 'mcp', data: msg },
        output: error.data._mcpError
          ? {
              type: 'mcp',
              data: {
                jsonrpc: '2.0',
                id,
                error: error.data._mcpError
              } satisfies JSONRPCErrorResponse
            }
          : { type: 'error', data: error.toResponse() },

        methodOrToolKey: method,
        clientMcpId: id,
        transport: 'mcp'
      });

      await this.control.sendControlMessage({
        type: 'mcp_control_message',
        conduit: {
          message,
          status: message.status,
          output: message.output,
          completedAt: message.completedAt
        },
        channel: 'targeted_response'
      });

      return {
        message,
        mcp: await conduitResultToMcpMessage({
          message,
          output: message.output,
          status: message.status,
          completedAt: message.completedAt
        })
      };
    }
  }

  private async handleMessageInternal(msg: JSONRPCMessage, opts: HandleResponseOpts) {
    let method = 'method' in msg ? msg.method : null;
    let id = 'id' in msg ? msg.id : null;

    if (method === 'ping' && id !== undefined && id !== null)
      return this.handlePingRequest(id);
    if (typeof id === 'string' && id.startsWith(PING_MESSAGE_ID_PREFIX))
      return this.handlePingResponse(id);

    if (!method) {
      if (id === undefined || id === null) return;
      // Get message by id and route response accordingly
      let message = await db.sessionMessage.findFirst({
        where: {
          sessionOid: this.session.oid,
          providerMcpId: id.toString()
        }
      });
      if (!message) return;

      // TODO: handle responses for mcp-compatible backends
      return;
    }

    if (id === undefined || id === null || method.startsWith('notifications/')) {
      // TODO: handle notification for mcp-compatible backends
      // -> send to all backends that support it
      return;
    }

    switch (method) {
      case 'initialize': {
        let initMessage = mcpValidate(id, InitializeRequestSchema, msg);
        if (!initMessage.success) return { mcp: initMessage.error, store: true };
        return this.handleInitMessage(id, initMessage.data);
      }

      case 'tools/list': {
        let toolList = mcpValidate(id, ListToolsRequestSchema, msg);
        if (!toolList.success) return { mcp: toolList.error, store: true };
        return this.handleToolListMessage(id);
      }

      case 'tools/call': {
        let toolCall = mcpValidate(id, CallToolRequestSchema, msg);
        if (!toolCall.success) return { mcp: toolCall.error, store: true };
        return this.handleToolCallMessage(id, { ...toolCall.data, id }, opts);
      }

      case 'prompts/list': {
        let promptList = mcpValidate(id, ListPromptsRequestSchema, msg);
        if (!promptList.success) return { mcp: promptList.error, store: true };
        return this.handlePromptListMessage(id);
      }

      case 'prompts/get': {
        let promptGet = mcpValidate(id, GetPromptRequestSchema, msg);
        if (!promptGet.success) return { mcp: promptGet.error, store: true };
        return this.handlePromptGetMessage(id, { ...promptGet.data, id }, opts);
      }

      case 'resources/templates/list': {
        let resourceTemplateList = mcpValidate(id, ListResourceTemplatesRequestSchema, msg);
        if (!resourceTemplateList.success)
          return { mcp: resourceTemplateList.error, store: true };
        return this.handleResourceTemplatesListMessage(id);
      }

      case 'resources/list': {
        let resourceTemplateList = mcpValidate(id, ListResourcesRequestSchema, msg);
        if (!resourceTemplateList.success)
          return { mcp: resourceTemplateList.error, store: true };
        return this.handleResourcesListMessage(
          id,
          resourceTemplateList.data.params ?? {},
          resourceTemplateList.data
        );
      }

      case 'resources/read': {
        let resourceTemplateRead = mcpValidate(id, ReadResourceRequestSchema, msg);
        if (!resourceTemplateRead.success)
          return { mcp: resourceTemplateRead.error, store: true };

        return this.handleResourceReadMessage(id, {
          ...resourceTemplateRead.data.params,
          waitForResponse: opts.waitForResponse
        });
      }
    }

    return {
      store: false,
      mcp: {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32601,
          message: 'Method not found'
        }
      } satisfies JSONRPCErrorResponse
    };
  }

  private async handlePingRequest(id: ID) {
    return {
      store: false,
      mcp: { jsonrpc: '2.0', id, result: {} } satisfies JSONRPCResponse
    };
  }

  private async handlePingResponse(_id: ID) {
    if (this.connection) {
      await db.sessionConnection.updateMany({
        where: { oid: this.connection.oid },
        data: { lastPingAt: new Date(), lastActiveAt: new Date() }
      });
    }

    await db.session.updateMany({
      where: { oid: this.session.oid },
      data: { lastActiveAt: new Date() }
    });

    await this.control.sendControlMessage({
      type: 'ping_received'
    });

    return { store: false, mcp: null };
  }

  private async handleToolListMessage(id: ID) {
    let allTools = await this.manager.listTools();
    if (allTools.status == 'discovery_failed') {
      return {
        store: true,
        mcp: { jsonrpc: '2.0', id, error: allTools.mcpError } satisfies JSONRPCErrorResponse
      };
    }

    let mcpTools = allTools.tools.filter(
      t =>
        t.value.mcpToolType.type === 'tool.callable' || t.value.mcpToolType.type === 'mcp.tool'
    );

    return {
      store: true,
      mcp: {
        jsonrpc: '2.0',
        id,
        result: {
          tools: mcpTools.map(t => {
            let presented = providerToolPresenter(t);
            let mcp = t.value.mcpToolType.type === 'mcp.tool' ? t.value.mcpToolType : null;

            return {
              name: presented.key,
              title: presented.title ?? presented.name,

              inputSchema: presented.inputJsonSchema as any,
              outputSchema:
                presented.outputJsonSchema?.type === 'object'
                  ? (presented.outputJsonSchema as any)
                  : undefined,

              icons: mcp?.icons,
              execution: mcp?.execution,

              description:
                [
                  presented.description,
                  markdownList('Constraints', presented.constraints),
                  markdownList('Instructions', presented.instructions)
                ]
                  .filter(Boolean)
                  .join('\n\n')
                  .trim() || undefined,

              annotations: mcp?.annotations ?? {
                readOnlyHint: presented.tags?.readOnly,
                destructiveHint: presented.tags?.destructive
              }
            };
          })
        } satisfies ListToolsResult
      } satisfies JSONRPCResponse
    };
  }

  private async handlePromptListMessage(id: ID) {
    let allTools = await this.manager.listToolsIncludingInternal();
    if (allTools.status == 'discovery_failed') {
      return {
        store: true,
        mcp: { jsonrpc: '2.0', id, error: allTools.mcpError } satisfies JSONRPCErrorResponse
      };
    }

    let mcpPrompts = allTools.tools.filter(t => t.value.mcpToolType.type === 'mcp.prompt');

    return {
      store: true,
      mcp: {
        jsonrpc: '2.0',
        id,
        result: {
          prompts: mcpPrompts.map(t => {
            let presented = providerToolPresenter(t);
            let mcp = t.value.mcpToolType.type === 'mcp.prompt' ? t.value.mcpToolType : null;

            return {
              name: presented.key,
              title: presented.title ?? presented.name,
              description: presented.description || undefined,
              arguments: mcp?.arguments,
              icons: mcp?.icons
            };
          })
        } satisfies ListPromptsResult
      } satisfies JSONRPCResponse
    };
  }

  private async handleResourceTemplatesListMessage(id: ID) {
    let allTools = await this.manager.listToolsIncludingInternal();
    if (allTools.status == 'discovery_failed') {
      return {
        store: true,
        mcp: { jsonrpc: '2.0', id, error: allTools.mcpError } satisfies JSONRPCErrorResponse
      };
    }

    let mcpResourceTemplates = allTools.tools.filter(
      t => t.value.mcpToolType.type === 'mcp.resource_template'
    );

    return {
      store: true,
      mcp: {
        jsonrpc: '2.0',
        id,
        result: {
          resourceTemplates: mcpResourceTemplates.map(t => {
            let presented = providerToolPresenter(t);
            let mcp =
              t.value.mcpToolType.type === 'mcp.resource_template'
                ? t.value.mcpToolType
                : null;

            return {
              name: presented.name,
              title: presented.title,
              description: presented.description || undefined,
              mimeType: mcp?.mimeType,
              uriTemplate: `${mcp?.uriTemplate}_${t.sessionProvider.tag}`,
              icons: mcp?.icons
            };
          })
        } satisfies ListResourceTemplatesResult
      } satisfies JSONRPCResponse
    };
  }

  private async handleResourcesListMessage(
    id: ID,
    opts: { cursor?: string },
    mcpMessage: JSONRPCMessage & ListResourcesRequest
  ) {
    if (!this.connection) {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot list resources without an active connection'
        })
      );
    }

    let message = await this.manager.createMessage({
      status: 'waiting_for_response',
      type: 'mcp_message',
      source: 'client',
      input: { type: 'mcp', data: mcpMessage },
      senderParticipant: this.connection?.participant!,
      clientMcpId: id,
      transport: 'mcp',
      isProductive: true
    });

    let allTools = await this.manager.listToolsIncludingInternalAndNonAllowed();
    if (allTools.status == 'discovery_failed') {
      return {
        store: true,
        mcp: {
          jsonrpc: '2.0',
          id,
          error: allTools.mcpError
        } satisfies JSONRPCErrorResponse
      };
    }

    let resourceListTools = uniqBy(
      allTools.tools.filter(t => t.value.mcpToolType.type === 'mcp.resources_list'),
      t => t.sessionProvider.tag
    );

    let internalCursor: string | undefined;

    if (opts?.cursor) {
      let parts = opts.cursor.split('_');
      let tag = parts.pop()!;
      let remainingCursor = parts.join('_').trim();

      let firstToolIndex = resourceListTools.findIndex(t => t.sessionProvider.tag === tag);
      if (firstToolIndex < 0) {
        return {
          store: true,
          mcp: {
            jsonrpc: '2.0',
            id,
            error: {
              code: -32000,
              message: `Invalid cursor: provider with tag "${tag}" not found`
            }
          } satisfies JSONRPCErrorResponse
        };
      }

      let remainingTools = resourceListTools.slice(firstToolIndex); // Include the found tool
      resourceListTools = remainingTools;

      if (remainingCursor.length) internalCursor = remainingCursor;
    }

    if (!resourceListTools.length) {
      return {
        store: true,
        mcp: {
          jsonrpc: '2.0',
          id,
          result: {
            resources: []
          } satisfies ListResourcesResult
        } satisfies JSONRPCResponse
      };
    }

    let resources: Resource[] = [];

    let i = 0;
    while (resources.length < 50 && resourceListTools.length) {
      if (i++ > 100) break; // Safety break to avoid infinite loops

      let tool = resourceListTools[0]!;
      let checkResourceAccess = checkResourceAccessManager(tool.sessionProvider);

      let toolResources = await this.manager.callTool({
        toolId: tool.key,
        input: {
          type: 'mcp',
          data: {
            method: 'resources/list',
            jsonrpc: '2.0',
            id: generatePlainId(10),
            params: {
              cursor: internalCursor,
              _meta: mcpMessage.params?._meta
            }
          } satisfies JSONRPCRequest & ListResourcesRequest
        },
        waitForResponse: true,
        transport: 'system',
        parentMessage: message
      });

      if (
        !toolResources.output ||
        toolResources.output.type !== 'mcp' ||
        toolResources.status === 'failed'
      ) {
        let out: any = toolResources.output
          ? await messageTranslator.outputToMcpBasic(
              toolResources.output,
              toolResources.message
            )
          : null;

        return {
          store: true,
          message,
          mcp: {
            jsonrpc: '2.0',
            id,
            error: out?.error ?? {
              code: -32000,
              message: 'Failed to retrieve resources'
            }
          } satisfies JSONRPCErrorResponse
        };
      }

      let res = toolResources.output.data as JSONRPCResponse & { result: ListResourcesResult };

      try {
        let newResources = (res?.result?.resources ?? [])
          .filter(resource => checkResourceAccess(resource.uri).allowed)
          .map(resource => ({
            ...resource,
            uri: `${resource.uri}_${tool.sessionProvider.tag}`
          }));

        resources.push(...newResources);
      } catch (e) {}

      if (!res?.result?.resources?.length || !res?.result?.nextCursor) {
        resourceListTools.shift();
        internalCursor = undefined;
      } else {
        internalCursor = res.result.nextCursor;
      }
    }

    return {
      store: true,
      message,
      mcp: {
        jsonrpc: '2.0',
        id,
        result: { resources } satisfies ListResourcesResult
      } satisfies JSONRPCResponse
    };
  }

  private async handleResourceReadMessage(
    id: ID,
    opts: { uri: string; waitForResponse: boolean }
  ) {
    let parts = opts.uri.split('_');
    let tag = parts.pop()!;
    let remainingUri = parts.join('_').trim();

    let allTools = await this.manager.listToolsIncludingInternalAndNonAllowed();
    if (allTools.status == 'discovery_failed') {
      return {
        store: true,
        mcp: { jsonrpc: '2.0', id, error: allTools.mcpError } satisfies JSONRPCErrorResponse
      };
    }

    let resourceReadTool = allTools.tools.find(
      t => t.value.mcpToolType.type === 'mcp.resources_read' && t.sessionProvider.tag === tag
    );

    if (!resourceReadTool) {
      return {
        store: true,
        mcp: {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32000,
            message: `No resource read tool found for provider with tag "${tag}"`
          }
        } satisfies JSONRPCErrorResponse
      };
    }

    let checkResourceAccess = checkResourceAccessManager(resourceReadTool.sessionProvider);
    if (!checkResourceAccess(remainingUri).allowed) {
      return {
        store: true,
        mcp: {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32000,
            message: 'Resource access not allowed'
          }
        } satisfies JSONRPCErrorResponse
      };
    }

    let result = await this.manager.callTool({
      toolId: resourceReadTool.key,
      input: {
        type: 'mcp',
        data: {
          jsonrpc: '2.0',
          method: 'resources/read',
          id,
          params: {
            uri: remainingUri
          }
        } satisfies JSONRPCRequest & ReadResourceRequest
      },
      waitForResponse: opts.waitForResponse,
      transport: 'mcp'
    });

    return {
      store: true,
      message: result.message,
      mcp: await conduitResultToMcpMessage(result)
    };
  }

  private async handleToolCallMessage(
    id: ID,
    msg: CallToolRequest & JSONRPCRequest,
    opts: { waitForResponse: boolean }
  ) {
    let result = await this.manager.callTool({
      clientMcpId: id,
      toolId: msg.params.name,
      input: {
        type: 'mcp',
        data: msg
      },
      waitForResponse: opts.waitForResponse,
      transport: 'mcp'
    });

    if (!opts.waitForResponse) return { message: result.message };

    return {
      store: true,
      message: result.message,
      mcp: await conduitResultToMcpMessage(result)
    };
  }

  private async handlePromptGetMessage(
    id: ID,
    msg: GetPromptRequest & JSONRPCRequest,
    opts: { waitForResponse: boolean }
  ) {
    let result = await this.manager.callTool({
      clientMcpId: id,
      toolId: msg.params.name,
      input: {
        type: 'mcp',
        data: msg
      },
      waitForResponse: opts.waitForResponse,
      transport: 'mcp'
    });

    if (!opts.waitForResponse) return { message: result.message };

    return {
      store: true,
      message: result.message,
      mcp: await conduitResultToMcpMessage(result)
    };
  }

  private async handleInitMessage(id: ID, msg: InitializeRequest) {
    let init = msg.params;
    let client = init.clientInfo;

    await this.manager.initialize({
      client: {
        ...client,
        name: client.name || 'Unknown',
        identifier: [client.name, client.version].filter(Boolean).join('@').trim() ?? 'unknown'
      },
      mcpCapabilities: init.capabilities,
      mcpProtocolVersion: init.protocolVersion,
      mcpTransport: this.mcpTransport
    });

    let providers = await this.manager.listProviders();

    let name =
      this.session.sharedProviderName ?? providers.map(p => p.provider.name).join(', ');
    let description = [
      this.session.sharedProviderDescription,
      ...providers.map(p => `# ${p.provider.name}\n${p.provider.description ?? ''}`.trim())
    ]
      .filter(Boolean)
      .join('\n\n')
      .trim();

    return {
      store: true,
      mcp: {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: init.protocolVersion,
          capabilities: {
            tools: {},
            prompts: {},
            resources: {}
          },
          serverInfo: {
            name:
              providers.length === 1
                ? Cases.toPascalCase(providers[0]!.provider.name)
                : 'UnifiedProvider',
            title: name,
            version: '1.0.0',
            description
          }
        } satisfies InitializeResult
      } satisfies JSONRPCResponse
    };
  }
}
