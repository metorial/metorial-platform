import { InvokeCommand, LogType } from '@aws-sdk/client-lambda';
import { awsLambda } from './aws';

interface InvokeLambdaOptions {
  functionName: string;
  payload: {
    action: 'discover' | 'mcp.request' | 'mcp.batch' | 'oauth' | 'callbacks';
    messages?: Array<{
      id?: string | number;
      method: string;
      params?: any;
    }>;
    clientInfo?: {
      name: string;
      version: string;
    };
    args?: Record<string, any>;
    token?: string;
    oauthAction?: string;
    oauthInput?: any;
    callbackAction?: string;
    callbackInput?: any;
  };
}

interface LambdaInvocationResult {
  success: boolean;
  responses?: any[];
  discovery?: any;
  oauth?: any;
  callbacks?: any;
  logs?: Array<{
    type: 'info' | 'error';
    lines: string[];
  }>;
  error?: {
    code: string;
    message: string;
  };
}

export let invokeLambda = async (
  options: InvokeLambdaOptions
): Promise<LambdaInvocationResult> => {
  let command = new InvokeCommand({
    FunctionName: options.functionName,
    InvocationType: 'RequestResponse', // Synchronous invocation
    LogType: LogType.Tail, // Include execution logs
    Payload: JSON.stringify(options.payload)
  });

  let response = await awsLambda.send(command);

  // Check for function errors
  if (response.FunctionError) {
    let errorPayload = response.Payload
      ? JSON.parse(Buffer.from(response.Payload).toString())
      : null;

    throw new Error(
      `Lambda function error: ${response.FunctionError} - ${
        errorPayload?.errorMessage || 'Unknown error'
      }`
    );
  }

  // Parse the response payload
  if (!response.Payload) {
    throw new Error('No payload returned from Lambda');
  }

  let result: LambdaInvocationResult = JSON.parse(Buffer.from(response.Payload).toString());

  // Optionally decode and log CloudWatch logs
  if (response.LogResult) {
    let logs = Buffer.from(response.LogResult, 'base64').toString();
    console.log('Lambda execution logs:', logs);
  }

  return result;
};

// Helper functions for specific actions

export let discoverLambda = async ({
  functionName,
  args
}: {
  functionName: string;
  args?: Record<string, any>;
}) => {
  return invokeLambda({
    functionName,
    payload: {
      action: 'discover',
      args
    }
  });
};

export let invokeMcpRequest = async ({
  functionName,
  messages,
  options
}: {
  functionName: string;
  messages: Array<{
    id?: string | number;
    method: string;
    params?: any;
  }>;
  options?: {
    args?: Record<string, any>;
    clientInfo?: {
      name: string;
      version: string;
    };
  };
}) => {
  return invokeLambda({
    functionName,
    payload: {
      action: messages.length === 1 ? 'mcp.request' : 'mcp.batch',
      messages,
      args: options?.args,
      clientInfo: options?.clientInfo || {
        name: 'Metorial MCP Client',
        version: '1.0.0'
      }
    }
  });
};

export let invokeLambdaOAuth = async ({
  functionName,
  oauthAction,
  input
}: {
  functionName: string;
  oauthAction: 'get' | 'authorization-url' | 'authorization-form' | 'refresh' | 'callback';
  input?: any;
}) => {
  return invokeLambda({
    functionName,
    payload: {
      action: 'oauth',
      oauthAction,
      oauthInput: input
    }
  });
};

export let invokeLambdaCallbacks = async ({
  functionName,
  callbackAction,
  input
}: {
  functionName: string;
  callbackAction: 'get' | 'handle' | 'install' | 'poll';
  input?: any;
}) => {
  return invokeLambda({
    functionName,
    payload: {
      action: 'callbacks',
      callbackAction,
      callbackInput: input
    }
  });
};
