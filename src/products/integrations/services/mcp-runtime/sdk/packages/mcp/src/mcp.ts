import { ServerOptions } from '@modelcontextprotocol/sdk/server/index.js';
import { McpServer, ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import {
  Implementation,
  ServerNotification,
  ServerRequest,
  ToolAnnotations
} from '@modelcontextprotocol/sdk/types.js';
import z from 'zod';

export type McpServerInfo = Implementation & ServerOptions;

export interface McpToolAnnotations extends ToolAnnotations {}

export interface McpToolOpts {
  name: string;
  title?: string;
  description?: string;
  annotations?: McpToolAnnotations;
  _meta?: Record<string, unknown>;
}

export type McpToolHandlerOutputSync<Output> =
  | Output
  | { structuredContent: Output }
  | ReturnType<ToolCallback<any>>;
export type McpToolHandlerOutput<Output> =
  | Promise<McpToolHandlerOutputSync<Output>>
  | McpToolHandlerOutputSync<Output>;

export type McpToolImplementation<Input, Output> = (
  input: Input,
  extra: RequestHandlerExtra<ServerRequest, ServerNotification>
) => McpToolHandlerOutput<Output>;

export class McpTool<Input = unknown, Output = unknown> {
  private inputSchema?: z.ZodType<Input>;
  private outputSchema?: z.ZodType<Output>;
  private handler?: ToolCallback<any>;

  private constructor(private opts: McpToolOpts) {}

  static create(name: string, opts: Partial<McpToolOpts> = {}) {
    return new McpTool({ name, ...opts });
  }

  static build<Input, Output>(tool: McpTool<Input, Output>) {
    if (!tool.handler) {
      throw new Error(`Tool ${tool.opts.name} is missing a handler`);
    }
    if (!tool.inputSchema) {
      tool.inputSchema = z.object({}) as any;
    }

    return {
      name: tool.opts.name,
      params: {
        ...tool.opts,
        inputSchema: tool.inputSchema,
        outputSchema: tool.outputSchema
      },
      handler: tool.handler
    };
  }

  input<D>(schema: z.ZodType<D>) {
    this.inputSchema = schema as any;
    return this as any as McpTool<D, Output>;
  }

  output<D>(schema: z.ZodType<D>) {
    this.outputSchema = schema as any;
    return this as any as McpTool<Input, D>;
  }

  handle(cb: McpToolImplementation<Input, Output>) {
    this.handler = async (input: any, extra: any) => {
      let res = await cb(input, extra);

      if (typeof res == 'object' && res !== null) {
        if ('content' in res) return res;
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(res, null, 2)
          }
        ],
        structuredContent: res as any
      };
    };
    return this;
  }
}

export type CreateMcpServerOpts = McpServerInfo & { tools: McpTool[] };

export let createMcpServer = (opts: CreateMcpServerOpts) => {
  let server = new McpServer(
    {
      name: opts.name,
      title: opts.title,
      icons: opts.icons,
      version: opts.version,
      websiteUrl: opts.websiteUrl,
      description: opts.description
    },
    opts
  );

  for (let tool of opts.tools) {
    let toolSpec = McpTool.build(tool);
    server.registerTool(
      toolSpec.name,
      {
        title: toolSpec.params.title,
        description: toolSpec.params.description,
        annotations: toolSpec.params.annotations,
        _meta: toolSpec.params._meta,
        inputSchema: toolSpec.params.inputSchema as any,
        outputSchema: toolSpec.params.outputSchema as any
      },
      toolSpec.handler as any
    );
  }

  return server;
};
