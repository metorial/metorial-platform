import { mtMap } from '@metorial/util-resource-mapper';

export type SessionsEventsListOutput = {
  items: {
    object: 'session.event';
    id: string;
    type: string;
    sessionId: string;
    connection: {
      object: 'session.connection';
      id: string;
      status: string;
      connectionState: string;
      transport: string;
      usage: {
        totalProductiveClientMessageCount: number;
        totalProductiveProviderMessageCount: number;
      };
      mcp: {
        capabilities: Record<string, any>;
        protocolVersion: string;
        transport: string;
      } | null;
      sessionId: string;
      participant: {
        object: 'session.participant';
        id: string;
        type: string;
        identifier: string;
        name: string;
        data: Record<string, any>;
        providerId: string | null;
        createdAt: Date;
      } | null;
      hasErrors: boolean;
      hasWarnings: boolean;
      createdAt: Date;
      lastMessageAt: Date;
      lastActiveAt: Date;
    } | null;
    providerRun: {
      object: 'session.provider_run';
      id: string;
      status: string;
      sessionId: string;
      sessionProviderId: string;
      providerId: string;
      connectionId: string;
      completedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    } | null;
    message: {
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
          inputSchema: {
            type: 'json_schema';
            schema: Record<string, any>;
          } | null;
          outputSchema: {
            type: 'json_schema';
            schema: Record<string, any>;
          } | null;
          tags: {
            destructive: boolean | null;
            readOnly: boolean | null;
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
          status: 'processing' | 'processed';
          sessionId: string;
          providerRunId: string | null;
          connectionId: string | null;
          groupId: string | null;
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
        status: 'processing' | 'processed';
        sessionId: string;
        providerRunId: string | null;
        connectionId: string | null;
        groupId: string | null;
        similarErrorCount: number;
        createdAt: Date;
      } | null;
      createdAt: Date;
    } | null;
    error: {
      object: 'session.error';
      id: string;
      code: string;
      message: string;
      data: Record<string, any>;
      status: 'processing' | 'processed';
      sessionId: string;
      providerRunId: string | null;
      connectionId: string | null;
      groupId: string | null;
      similarErrorCount: number;
      createdAt: Date;
    } | null;
    warning: {
      object: 'session.warning';
      id: string;
      code: string;
      message: string;
      data: Record<string, any>;
      sessionId: string;
      connectionId: string | null;
      createdAt: Date;
    } | null;
    createdAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapSessionsEventsListOutput = mtMap.object<SessionsEventsListOutput>(
  {
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          type: mtMap.objectField('type', mtMap.passthrough()),
          sessionId: mtMap.objectField('session_id', mtMap.passthrough()),
          connection: mtMap.objectField(
            'connection',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              status: mtMap.objectField('status', mtMap.passthrough()),
              connectionState: mtMap.objectField(
                'connection_state',
                mtMap.passthrough()
              ),
              transport: mtMap.objectField('transport', mtMap.passthrough()),
              usage: mtMap.objectField(
                'usage',
                mtMap.object({
                  totalProductiveClientMessageCount: mtMap.objectField(
                    'total_productive_client_message_count',
                    mtMap.passthrough()
                  ),
                  totalProductiveProviderMessageCount: mtMap.objectField(
                    'total_productive_provider_message_count',
                    mtMap.passthrough()
                  )
                })
              ),
              mcp: mtMap.objectField(
                'mcp',
                mtMap.object({
                  capabilities: mtMap.objectField(
                    'capabilities',
                    mtMap.passthrough()
                  ),
                  protocolVersion: mtMap.objectField(
                    'protocol_version',
                    mtMap.passthrough()
                  ),
                  transport: mtMap.objectField('transport', mtMap.passthrough())
                })
              ),
              sessionId: mtMap.objectField('session_id', mtMap.passthrough()),
              participant: mtMap.objectField(
                'participant',
                mtMap.object({
                  object: mtMap.objectField('object', mtMap.passthrough()),
                  id: mtMap.objectField('id', mtMap.passthrough()),
                  type: mtMap.objectField('type', mtMap.passthrough()),
                  identifier: mtMap.objectField(
                    'identifier',
                    mtMap.passthrough()
                  ),
                  name: mtMap.objectField('name', mtMap.passthrough()),
                  data: mtMap.objectField('data', mtMap.passthrough()),
                  providerId: mtMap.objectField(
                    'provider_id',
                    mtMap.passthrough()
                  ),
                  createdAt: mtMap.objectField('created_at', mtMap.date())
                })
              ),
              hasErrors: mtMap.objectField('has_errors', mtMap.passthrough()),
              hasWarnings: mtMap.objectField(
                'has_warnings',
                mtMap.passthrough()
              ),
              createdAt: mtMap.objectField('created_at', mtMap.date()),
              lastMessageAt: mtMap.objectField('last_message_at', mtMap.date()),
              lastActiveAt: mtMap.objectField('last_active_at', mtMap.date())
            })
          ),
          providerRun: mtMap.objectField(
            'provider_run',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              status: mtMap.objectField('status', mtMap.passthrough()),
              sessionId: mtMap.objectField('session_id', mtMap.passthrough()),
              sessionProviderId: mtMap.objectField(
                'session_provider_id',
                mtMap.passthrough()
              ),
              providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
              connectionId: mtMap.objectField(
                'connection_id',
                mtMap.passthrough()
              ),
              completedAt: mtMap.objectField('completed_at', mtMap.date()),
              createdAt: mtMap.objectField('created_at', mtMap.date()),
              updatedAt: mtMap.objectField('updated_at', mtMap.date())
            })
          ),
          message: mtMap.objectField(
            'message',
            mtMap.object({
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
              connectionId: mtMap.objectField(
                'connection_id',
                mtMap.passthrough()
              ),
              providerRunId: mtMap.objectField(
                'provider_run_id',
                mtMap.passthrough()
              ),
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
                      transport: mtMap.objectField(
                        'transport',
                        mtMap.passthrough()
                      )
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
                  transport: mtMap.objectField(
                    'transport',
                    mtMap.passthrough()
                  ),
                  sessionId: mtMap.objectField(
                    'session_id',
                    mtMap.passthrough()
                  ),
                  messageId: mtMap.objectField(
                    'message_id',
                    mtMap.passthrough()
                  ),
                  sessionProviderId: mtMap.objectField(
                    'session_provider_id',
                    mtMap.passthrough()
                  ),
                  connectionId: mtMap.objectField(
                    'connection_id',
                    mtMap.passthrough()
                  ),
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
                      description: mtMap.objectField(
                        'description',
                        mtMap.passthrough()
                      ),
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
                          schema: mtMap.objectField(
                            'schema',
                            mtMap.passthrough()
                          )
                        })
                      ),
                      outputSchema: mtMap.objectField(
                        'output_schema',
                        mtMap.object({
                          type: mtMap.objectField('type', mtMap.passthrough()),
                          schema: mtMap.objectField(
                            'schema',
                            mtMap.passthrough()
                          )
                        })
                      ),
                      tags: mtMap.objectField(
                        'tags',
                        mtMap.object({
                          destructive: mtMap.objectField(
                            'destructive',
                            mtMap.passthrough()
                          ),
                          readOnly: mtMap.objectField(
                            'read_only',
                            mtMap.passthrough()
                          )
                        })
                      ),
                      specificationId: mtMap.objectField(
                        'specification_id',
                        mtMap.passthrough()
                      ),
                      providerId: mtMap.objectField(
                        'provider_id',
                        mtMap.passthrough()
                      ),
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
                      message: mtMap.objectField(
                        'message',
                        mtMap.passthrough()
                      ),
                      data: mtMap.objectField('data', mtMap.passthrough()),
                      status: mtMap.objectField('status', mtMap.passthrough()),
                      sessionId: mtMap.objectField(
                        'session_id',
                        mtMap.passthrough()
                      ),
                      providerRunId: mtMap.objectField(
                        'provider_run_id',
                        mtMap.passthrough()
                      ),
                      connectionId: mtMap.objectField(
                        'connection_id',
                        mtMap.passthrough()
                      ),
                      groupId: mtMap.objectField(
                        'group_id',
                        mtMap.passthrough()
                      ),
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
                  identifier: mtMap.objectField(
                    'identifier',
                    mtMap.passthrough()
                  ),
                  name: mtMap.objectField('name', mtMap.passthrough()),
                  data: mtMap.objectField('data', mtMap.passthrough()),
                  providerId: mtMap.objectField(
                    'provider_id',
                    mtMap.passthrough()
                  ),
                  createdAt: mtMap.objectField('created_at', mtMap.date())
                })
              ),
              responderParticipant: mtMap.objectField(
                'responder_participant',
                mtMap.object({
                  object: mtMap.objectField('object', mtMap.passthrough()),
                  id: mtMap.objectField('id', mtMap.passthrough()),
                  type: mtMap.objectField('type', mtMap.passthrough()),
                  identifier: mtMap.objectField(
                    'identifier',
                    mtMap.passthrough()
                  ),
                  name: mtMap.objectField('name', mtMap.passthrough()),
                  data: mtMap.objectField('data', mtMap.passthrough()),
                  providerId: mtMap.objectField(
                    'provider_id',
                    mtMap.passthrough()
                  ),
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
                  status: mtMap.objectField('status', mtMap.passthrough()),
                  sessionId: mtMap.objectField(
                    'session_id',
                    mtMap.passthrough()
                  ),
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
              status: mtMap.objectField('status', mtMap.passthrough()),
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
          warning: mtMap.objectField(
            'warning',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              code: mtMap.objectField('code', mtMap.passthrough()),
              message: mtMap.objectField('message', mtMap.passthrough()),
              data: mtMap.objectField('data', mtMap.passthrough()),
              sessionId: mtMap.objectField('session_id', mtMap.passthrough()),
              connectionId: mtMap.objectField(
                'connection_id',
                mtMap.passthrough()
              ),
              createdAt: mtMap.objectField('created_at', mtMap.date())
            })
          ),
          createdAt: mtMap.objectField('created_at', mtMap.date())
        })
      )
    ),
    pagination: mtMap.objectField(
      'pagination',
      mtMap.object({
        hasMoreBefore: mtMap.objectField(
          'has_more_before',
          mtMap.passthrough()
        ),
        hasMoreAfter: mtMap.objectField('has_more_after', mtMap.passthrough())
      })
    )
  }
);

export type SessionsEventsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  type?: string | string[] | undefined;
  id?: string | string[] | undefined;
  sessionId?: string | string[] | undefined;
  sessionProviderId?: string | string[] | undefined;
  sessionConnectionId?: string | string[] | undefined;
  providerRunId?: string | string[] | undefined;
  sessionMessageId?: string | string[] | undefined;
  sessionErrorId?: string | string[] | undefined;
};

export let mapSessionsEventsListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough()),
      type: mtMap.objectField(
        'type',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      id: mtMap.objectField(
        'id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      sessionId: mtMap.objectField(
        'session_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      sessionProviderId: mtMap.objectField(
        'session_provider_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      sessionConnectionId: mtMap.objectField(
        'session_connection_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      providerRunId: mtMap.objectField(
        'provider_run_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      sessionMessageId: mtMap.objectField(
        'session_message_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      sessionErrorId: mtMap.objectField(
        'session_error_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      )
    })
  )
]);

