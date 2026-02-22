import { mtMap } from '@metorial/util-resource-mapper';

export type SessionsMessagesGetOutput = {
  object: 'session.message';
  id: string;
  type: string;
  status: string;
  source: string;
  sessionId: string;
  sessionProviderId: string | null;
  connectionId: string | null;
  providerRunId: string | null;
  hierarchy: {
    object: 'session.message.hierarchy';
    type: string;
    parentMessageId: string | null;
    childMessageIds: string[];
  };
  transport: {
    object: 'session.message.transport';
    type: 'mcp' | 'tool_call' | 'metorial_protocol' | 'system';
    mcp: {
      object: 'session.message.transport#mcp';
      id: string | number;
      protocolVersion: string;
      transport: string;
    } | null;
    toolCall: {
      object: 'session.message.transport#tool_call';
      id: string | null;
    } | null;
  };
  input: Record<string, any> | null;
  output: Record<string, any> | null;
  toolCall: {
    object: 'session.tool_call';
    id: string;
    toolKey: string;
    type: string;
    status: string;
    source: string;
    transport: string;
    sessionId: string;
    messageId: string;
    sessionProviderId: string | null;
    connectionId: string | null;
    providerRunId: string | null;
    tool: {
      object: 'provider.tool';
      id: string;
      key: string;
      name: string;
      description: string | null;
      capabilities: Record<string, any>;
      constraints: string[];
      instructions: string[];
      inputSchema: { type: 'json_schema'; schema: Record<string, any> } | null;
      outputSchema: { type: 'json_schema'; schema: Record<string, any> } | null;
      tags: {
        destructive?: boolean | undefined;
        readOnly?: boolean | undefined;
      } | null;
      specificationId: string;
      providerId: string;
      createdAt: Date;
      updatedAt: Date;
    };
    error: {
      object: 'session.error';
      id: string;
      code: string;
      message: string;
      data: Record<string, any>;
      sessionId: string;
      providerRunId: string | null;
      connectionId: string | null;
      groupId: string;
      similarErrorCount: number;
      createdAt: Date;
    } | null;
    input: Record<string, any> | null;
    output: Record<string, any> | null;
    createdAt: Date;
  } | null;
  senderParticipant: {
    object: 'session.participant';
    id: string;
    type: string;
    identifier: string;
    name: string;
    data: Record<string, any>;
    providerId: string | null;
    createdAt: Date;
  };
  responderParticipant: {
    object: 'session.participant';
    id: string;
    type: string;
    identifier: string;
    name: string;
    data: Record<string, any>;
    providerId: string | null;
    createdAt: Date;
  } | null;
  error: {
    object: 'session.error';
    id: string;
    code: string;
    message: string;
    data: Record<string, any>;
    sessionId: string;
    providerRunId: string | null;
    connectionId: string | null;
    groupId: string;
    similarErrorCount: number;
    createdAt: Date;
  } | null;
  createdAt: Date;
};

export let mapSessionsMessagesGetOutput =
  mtMap.object<SessionsMessagesGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    type: mtMap.objectField('type', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    source: mtMap.objectField('source', mtMap.passthrough()),
    sessionId: mtMap.objectField('session_id', mtMap.passthrough()),
    sessionProviderId: mtMap.objectField(
      'session_provider_id',
      mtMap.passthrough()
    ),
    connectionId: mtMap.objectField('connection_id', mtMap.passthrough()),
    providerRunId: mtMap.objectField('provider_run_id', mtMap.passthrough()),
    hierarchy: mtMap.objectField(
      'hierarchy',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        type: mtMap.objectField('type', mtMap.passthrough()),
        parentMessageId: mtMap.objectField(
          'parent_message_id',
          mtMap.passthrough()
        ),
        childMessageIds: mtMap.objectField(
          'child_message_ids',
          mtMap.array(mtMap.passthrough())
        )
      })
    ),
    transport: mtMap.objectField(
      'transport',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        type: mtMap.objectField('type', mtMap.passthrough()),
        mcp: mtMap.objectField(
          'mcp',
          mtMap.object({
            object: mtMap.objectField('object', mtMap.passthrough()),
            id: mtMap.objectField(
              'id',
              mtMap.union([
                mtMap.unionOption('number', mtMap.passthrough()),
                mtMap.unionOption('string', mtMap.passthrough())
              ])
            ),
            protocolVersion: mtMap.objectField(
              'protocol_version',
              mtMap.passthrough()
            ),
            transport: mtMap.objectField('transport', mtMap.passthrough())
          })
        ),
        toolCall: mtMap.objectField(
          'tool_call',
          mtMap.object({
            object: mtMap.objectField('object', mtMap.passthrough()),
            id: mtMap.objectField('id', mtMap.passthrough())
          })
        )
      })
    ),
    input: mtMap.objectField('input', mtMap.passthrough()),
    output: mtMap.objectField('output', mtMap.passthrough()),
    toolCall: mtMap.objectField(
      'tool_call',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        toolKey: mtMap.objectField('tool_key', mtMap.passthrough()),
        type: mtMap.objectField('type', mtMap.passthrough()),
        status: mtMap.objectField('status', mtMap.passthrough()),
        source: mtMap.objectField('source', mtMap.passthrough()),
        transport: mtMap.objectField('transport', mtMap.passthrough()),
        sessionId: mtMap.objectField('session_id', mtMap.passthrough()),
        messageId: mtMap.objectField('message_id', mtMap.passthrough()),
        sessionProviderId: mtMap.objectField(
          'session_provider_id',
          mtMap.passthrough()
        ),
        connectionId: mtMap.objectField('connection_id', mtMap.passthrough()),
        providerRunId: mtMap.objectField(
          'provider_run_id',
          mtMap.passthrough()
        ),
        tool: mtMap.objectField(
          'tool',
          mtMap.object({
            object: mtMap.objectField('object', mtMap.passthrough()),
            id: mtMap.objectField('id', mtMap.passthrough()),
            key: mtMap.objectField('key', mtMap.passthrough()),
            name: mtMap.objectField('name', mtMap.passthrough()),
            description: mtMap.objectField('description', mtMap.passthrough()),
            capabilities: mtMap.objectField(
              'capabilities',
              mtMap.passthrough()
            ),
            constraints: mtMap.objectField(
              'constraints',
              mtMap.array(mtMap.passthrough())
            ),
            instructions: mtMap.objectField(
              'instructions',
              mtMap.array(mtMap.passthrough())
            ),
            inputSchema: mtMap.objectField(
              'input_schema',
              mtMap.object({
                type: mtMap.objectField('type', mtMap.passthrough()),
                schema: mtMap.objectField('schema', mtMap.passthrough())
              })
            ),
            outputSchema: mtMap.objectField(
              'output_schema',
              mtMap.object({
                type: mtMap.objectField('type', mtMap.passthrough()),
                schema: mtMap.objectField('schema', mtMap.passthrough())
              })
            ),
            tags: mtMap.objectField(
              'tags',
              mtMap.object({
                destructive: mtMap.objectField(
                  'destructive',
                  mtMap.passthrough()
                ),
                readOnly: mtMap.objectField('read_only', mtMap.passthrough())
              })
            ),
            specificationId: mtMap.objectField(
              'specification_id',
              mtMap.passthrough()
            ),
            providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
            createdAt: mtMap.objectField('created_at', mtMap.date()),
            updatedAt: mtMap.objectField('updated_at', mtMap.date())
          })
        ),
        error: mtMap.objectField(
          'error',
          mtMap.object({
            object: mtMap.objectField('object', mtMap.passthrough()),
            id: mtMap.objectField('id', mtMap.passthrough()),
            code: mtMap.objectField('code', mtMap.passthrough()),
            message: mtMap.objectField('message', mtMap.passthrough()),
            data: mtMap.objectField('data', mtMap.passthrough()),
            sessionId: mtMap.objectField('session_id', mtMap.passthrough()),
            providerRunId: mtMap.objectField(
              'provider_run_id',
              mtMap.passthrough()
            ),
            connectionId: mtMap.objectField(
              'connection_id',
              mtMap.passthrough()
            ),
            groupId: mtMap.objectField('group_id', mtMap.passthrough()),
            similarErrorCount: mtMap.objectField(
              'similar_error_count',
              mtMap.passthrough()
            ),
            createdAt: mtMap.objectField('created_at', mtMap.date())
          })
        ),
        input: mtMap.objectField('input', mtMap.passthrough()),
        output: mtMap.objectField('output', mtMap.passthrough()),
        createdAt: mtMap.objectField('created_at', mtMap.date())
      })
    ),
    senderParticipant: mtMap.objectField(
      'sender_participant',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        type: mtMap.objectField('type', mtMap.passthrough()),
        identifier: mtMap.objectField('identifier', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        data: mtMap.objectField('data', mtMap.passthrough()),
        providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
        createdAt: mtMap.objectField('created_at', mtMap.date())
      })
    ),
    responderParticipant: mtMap.objectField(
      'responder_participant',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        type: mtMap.objectField('type', mtMap.passthrough()),
        identifier: mtMap.objectField('identifier', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        data: mtMap.objectField('data', mtMap.passthrough()),
        providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
        createdAt: mtMap.objectField('created_at', mtMap.date())
      })
    ),
    error: mtMap.objectField(
      'error',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        code: mtMap.objectField('code', mtMap.passthrough()),
        message: mtMap.objectField('message', mtMap.passthrough()),
        data: mtMap.objectField('data', mtMap.passthrough()),
        sessionId: mtMap.objectField('session_id', mtMap.passthrough()),
        providerRunId: mtMap.objectField(
          'provider_run_id',
          mtMap.passthrough()
        ),
        connectionId: mtMap.objectField('connection_id', mtMap.passthrough()),
        groupId: mtMap.objectField('group_id', mtMap.passthrough()),
        similarErrorCount: mtMap.objectField(
          'similar_error_count',
          mtMap.passthrough()
        ),
        createdAt: mtMap.objectField('created_at', mtMap.date())
      })
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date())
  });

