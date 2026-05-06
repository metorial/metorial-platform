type JsonObject = Record<string, any>;

let TOOL_CALL_OPERATION_FIELD_SCHEMA = {
  type: 'object',
  description:
    'MUST be provided for all tool calls! Include callRationale and callDescription so the system can record why the tool call is needed and what the caller is trying to do.',
  additionalProperties: false,
  properties: {
    callRationale: {
      type: 'string',
      description:
        'MUST be provided for all tool calls! Provide a 1-2 sentence description why the call is needed.'
    },
    callDescription: {
      type: 'string',
      description:
        'MUST be provided for all tool calls! Describe what you want to achieve with this tool call, e.g., "find the latest news about business in the US"'
    }
  }
};

let isJsonObject = (value: unknown): value is JsonObject =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export let injectToolCallOperationIntoInputSchema = (inputSchema: unknown) => {
  let schema = isJsonObject(inputSchema) ? inputSchema : {};
  let properties = isJsonObject(schema.properties) ? schema.properties : {};

  return {
    ...schema,
    type: schema.type ?? 'object',
    properties: {
      ...properties,
      _operation: TOOL_CALL_OPERATION_FIELD_SCHEMA
    }
  };
};

let getToolCallOperationData = (value: unknown) => {
  if (!isJsonObject(value)) {
    return {
      rationale: undefined,
      operation: undefined
    };
  }

  return {
    rationale: typeof value.callRationale === 'string' ? value.callRationale : undefined,
    operation: typeof value.callDescription === 'string' ? value.callDescription : undefined
  };
};

export let extractToolCallOperation = (d: {
  input: PrismaJson.SessionMessageInput;
  rationale?: string;
  operation?: string;
}): {
  input: PrismaJson.SessionMessageInput;
  rationale?: string;
  operation?: string;
} => {
  let rationale = d.rationale;
  let operation = d.operation;

  if (d.input.type === 'tool.call' && isJsonObject(d.input.data)) {
    let { _operation, ...inputData } = d.input.data;
    let operationData = getToolCallOperationData(_operation);

    return {
      input: {
        ...d.input,
        data: inputData
      } satisfies PrismaJson.SessionMessageInput,
      rationale: rationale ?? operationData.rationale,
      operation: operation ?? operationData.operation
    };
  }

  if (d.input.type === 'mcp' && isJsonObject(d.input.data)) {
    let messageData = d.input.data as JsonObject;
    if (messageData.method !== 'tools/call') {
      return {
        input: d.input,
        rationale,
        operation
      };
    }

    let params = isJsonObject(messageData.params) ? messageData.params : null;
    let argumentsData = params && isJsonObject(params.arguments) ? params.arguments : null;

    if (!params || !argumentsData) {
      return {
        input: d.input,
        rationale,
        operation
      };
    }

    let { _operation, ...argumentsInput } = argumentsData;
    let operationData = getToolCallOperationData(_operation);

    return {
      input: {
        ...d.input,
        data: {
          ...messageData,
          params: {
            ...params,
            arguments: argumentsInput
          }
        }
      } as unknown as PrismaJson.SessionMessageInput,
      rationale: rationale ?? operationData.rationale,
      operation: operation ?? operationData.operation
    };
  }

  return {
    input: d.input,
    rationale,
    operation
  };
};
