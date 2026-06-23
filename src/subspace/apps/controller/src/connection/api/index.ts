import { createHono } from '@lowerdeck/hono';
import { mcpRouter } from './mcp';
import { metorialIntegrationProtocolRouter } from './metorialIntegrationProtocol';

export let api = createHono()
  .route(
    `/:solutionId/:tenantId/sessions/:sessionId/metorial`,
    metorialIntegrationProtocolRouter
  )
  .route(`/:solutionId/:tenantId/sessions/:sessionId/mcp`, mcpRouter);
