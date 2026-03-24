import type {
  Annotations,
  Icons,
  InitializeResult,
  ToolAnnotations,
  ToolExecution
} from '@modelcontextprotocol/sdk/types.js';

export type SpecificationAuthMethodType = 'oauth' | 'token' | 'service_account' | 'custom';

export interface SpecificationTool {
  specId: string;
  specUniqueIdentifier?: string;
  callableId: string;

  key: string;

  name: string;
  title?: string;
  description?: string;

  inputJsonSchema: Record<string, any>;
  outputJsonSchema?: Record<string, any>;

  constraints: string[];
  instructions: string[];

  mcpToolType:
    | {
        type: 'tool.callable';
      }
    | {
        type: 'mcp.tool';
        key: string;
        title: string | undefined;
        icons: Icons['icons'] | undefined;
        annotations: ToolAnnotations | undefined;
        execution: ToolExecution | undefined;
        _meta: { [key: string]: any } | undefined;
      }
    | {
        type: 'mcp.prompt';
        key: string;
        title: string | undefined;
        icons: Icons['icons'] | undefined;
        arguments: {
          name: string;
          description?: string | undefined;
          required?: boolean | undefined;
        }[];
        _meta: { [key: string]: any } | undefined;
      }
    | {
        type: 'mcp.resource_template';
        uriTemplate: string;
        mimeType: string | undefined;
        title: string | undefined;
        variableNames: string[];
        icons: Icons['icons'] | undefined;
        annotations: Annotations | undefined;
        _meta: { [key: string]: any } | undefined;
      }
    | {
        type:
          | 'mcp.resources_list'
          | 'mcp.resources_read'
          | 'mcp.completion_complete'
          | 'mcp.logging_setLevel';
      };

  capabilities: {
    [key: string]: any;
  };

  tags?: {
    destructive?: boolean | undefined;
    readOnly?: boolean | undefined;
  };

  metadata: Record<string, any>;
}

export interface SpecificationAuthMethod {
  specId: string;
  specUniqueIdentifier?: string;
  callableId: string;

  type: SpecificationAuthMethodType;

  key: string;

  name: string;
  description?: string;

  inputJsonSchema: Record<string, any>;
  outputJsonSchema?: Record<string, any>;

  capabilities: {
    [key: string]: any;
  };

  scopes?: {
    id: string;
    title: string;
    description?: string;
  }[];

  metadata: Record<string, any>;
}

export interface SpecificationTrigger {
  specId: string;
  specUniqueIdentifier?: string;
  callableId: string;

  key: string;

  name: string;
  description?: string;

  inputJsonSchema: Record<string, any>;
  outputJsonSchema?: Record<string, any>;

  invocation:
    | {
        type: 'polling';
        intervalSeconds: number;
      }
    | {
        type: 'webhook';
        autoRegistration: boolean;
        autoUnregistration: boolean;
      };

  capabilities: {
    [key: string]: any;
  };

  metadata: Record<string, any>;
}

export interface Specification {
  specId: string;
  specUniqueIdentifier?: string;

  key: string;

  name: string;
  description?: string;

  configJsonSchema: Record<string, any>;
  configVisibility: 'encrypted' | 'plain';

  metadata: Record<string, any>;
  triggers?: SpecificationTrigger[];

  mcp: {
    serverInfo: InitializeResult['serverInfo'];
    capabilities: InitializeResult['capabilities'];
    instructions: InitializeResult['instructions'];
  } | null;
}

export interface SpecificationFeatures {
  supportsAuthMethod: boolean;
  configContainsAuth: boolean;
}
