import { preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { createHono } from '@lowerdeck/hono';
import { messageOutputToToolCall } from '@metorial-subspace/db';
import {
  connectionPresenter,
  providerToolPresenter,
  SenderConnection,
  SenderManager,
  sessionMessagePresenter
} from '@metorial-subspace/module-connection';
import { websocket } from 'hono/bun';
import { streamSSE } from 'hono/streaming';
import z from 'zod';
import { useValidation } from '../lib/validator';

export { websocket };

export let metorialIntegrationProtocolRouter = createHono()
  .get(`/live`, c =>
    streamSSE(c, async stream => {
      let con = await SenderConnection.create({
        sessionId: c.req.param('sessionId')!,
        solutionId: c.req.param('solutionId')!,
        tenantId: c.req.param('tenantId')!,
        transport: 'tool_call'
      });

      await stream.writeSSE({
        data: JSON.stringify({ type: 'connected' })
      });

      let listenerStream = con.listener();

      stream.onAbort(() => {
        listenerStream.close();
      });

      for await (let event of listenerStream) {
        await stream.writeSSE({
          data: JSON.stringify(event)
        });
      }
    })
  )
  .post(
    `/initialize`,
    useValidation(
      'json',
      z.object({
        client: z.object({ identifier: z.string(), name: z.string() }).loose()
      })
    ),
    async c => {
      let manager = await SenderManager.create({
        sessionId: c.req.param('sessionId')!,
        solutionId: c.req.param('solutionId')!,
        tenantId: c.req.param('tenantId')!,
        transport: 'tool_call'
      });

      let body = c.req.valid('json');

      let connection = await manager.initialize({
        client: body.client,
        mcpTransport: 'none'
      });

      return c.json(connectionPresenter(connection));
    }
  )
  .get(`/tool.list`, async c => {
    let manager = await SenderManager.create({
      sessionId: c.req.param('sessionId')!,
      solutionId: c.req.param('solutionId')!,
      tenantId: c.req.param('tenantId')!,
      transport: 'tool_call'
    });

    let toolRes = await manager.listTools();

    if (toolRes.status == 'discovery_failed') {
      throw new ServiceError(
        preconditionFailedError({
          message:
            'Tool discovery failed for this connection. Please ensure that the provider supports tool discovery and that the connection is properly configured.'
        })
      );
    }

    return c.json(toolRes.tools.map(t => providerToolPresenter(t)));
  })
  .get(`/tool.get`, useValidation('query', z.object({ toolId: z.string() })), async c => {
    let manager = await SenderManager.create({
      sessionId: c.req.param('sessionId')!,
      solutionId: c.req.param('solutionId')!,
      tenantId: c.req.param('tenantId')!,
      transport: 'tool_call'
    });

    let toolId = c.req.valid('query').toolId;

    let toolRes = await manager.getToolById({
      toolId
    });

    return c.json(providerToolPresenter(toolRes.tool));
  })
  .post(
    `/tool.call`,
    useValidation(
      'json',
      z.object({
        toolId: z.string(),
        input: z.record(z.string(), z.any()),
        waitForResponse: z.boolean().optional(),
        connectionToken: z.string()
      })
    ),
    async c => {
      let body = c.req.valid('json');

      let manager = await SenderManager.create({
        sessionId: c.req.param('sessionId')!,
        solutionId: c.req.param('solutionId')!,
        tenantId: c.req.param('tenantId')!,
        connectionToken: body.connectionToken,
        transport: 'tool_call'
      });

      let toolRes = await manager.callTool({
        toolId: body.toolId,
        input: {
          type: 'tool.call',
          data: body.input
        },
        waitForResponse: !!body.waitForResponse,
        transport: 'tool_call'
      });

      return c.json({
        output: await messageOutputToToolCall(toolRes.output!, toolRes.message),
        message: sessionMessagePresenter(toolRes.message)
      });
    }
  );
