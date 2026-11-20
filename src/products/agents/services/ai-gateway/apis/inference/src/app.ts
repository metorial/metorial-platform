import { cors, createHono } from '@lowerdeck/hono';
import type { GatewayPrincipal } from '@mtsrc/ai-gateway-spec';
import type { Context } from 'hono';
import { errorResponse, toGatewayError, type Dialect, type GatewayError } from './lib/errors';
import {
  anthropicModel,
  anthropicModelList,
  openaiModel,
  openaiModelList,
  type ListedModel
} from './lib/models';

export type InferenceDependencies = {
  authenticate: (token: string | undefined) => Promise<GatewayPrincipal>;
  extractToken: (headers: { authorization?: string; apiKey?: string }) => string | undefined;
  route: (d: { principal: GatewayPrincipal; model: string }) => Promise<unknown>;
  listModels: (d: { principal: GatewayPrincipal }) => Promise<ListedModel[]>;
};

type Variables = { principal: GatewayPrincipal; dialect: Dialect };

let maxBodyBytes = 32 * 1024 * 1024;

// Anthropic SDKs always send `anthropic-version`; OpenAI-style clients never do. Shared
// endpoints like /v1/models use it to answer in the shape the caller's SDK expects.
let dialectOfRequest = (c: Context): Dialect =>
  c.req.header('anthropic-version') ? 'anthropic_messages' : 'openai_chat';

let dialectNames: Record<Dialect, string> = {
  openai_chat: 'OpenAI Chat Completions',
  anthropic_messages: 'Anthropic Messages',
  open_responses: 'Open Responses'
};

let notImplemented = (dialect: Dialect): GatewayError => ({
  status: 501,
  code: 'not_implemented',
  message: `Inference through the ${dialectNames[dialect]} API is not available yet.`
});

export let createInferenceApp = (deps: InferenceDependencies) => {
  let app = createHono<{ Variables: Variables }>();

  app.use(
    '/v1/*',
    cors({
      origin: '*',
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowHeaders: [
        'Authorization',
        'Content-Type',
        'x-api-key',
        'anthropic-version',
        'anthropic-beta',
        'OpenAI-Organization',
        'OpenAI-Project'
      ],
      maxAge: 86400
    })
  );

  app.onError((error, c) =>
    errorResponse(c.get('dialect') ?? dialectOfRequest(c), toGatewayError(error))
  );

  app.get('/ping', c => c.text('OK'));

  let authenticated =
    (dialect: Dialect | 'detect') =>
    async (c: Context<{ Variables: Variables }>, next: () => Promise<void>) => {
      let resolved = dialect == 'detect' ? dialectOfRequest(c) : dialect;
      c.set('dialect', resolved);

      try {
        let principal = await deps.authenticate(
          deps.extractToken({
            authorization: c.req.header('authorization'),
            apiKey: c.req.header('x-api-key')
          })
        );
        c.set('principal', principal);
      } catch (error) {
        return errorResponse(resolved, toGatewayError(error));
      }

      await next();
    };

  let readModel = async (
    c: Context<{ Variables: Variables }>
  ): Promise<{ model: string } | { error: GatewayError }> => {
    let declared = Number(c.req.header('content-length') ?? 0);
    if (declared > maxBodyBytes) {
      return {
        error: {
          status: 413,
          code: 'request_too_large',
          message: 'The request body is too large.'
        }
      };
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return {
        error: {
          status: 400,
          code: 'invalid_json',
          message: 'The request body must be valid JSON.'
        }
      };
    }

    let model = (body as { model?: unknown } | null)?.model;
    if (typeof model != 'string' || !model.trim()) {
      return {
        error: {
          status: 400,
          code: 'missing_model',
          message: 'The "model" field is required.',
          param: 'model'
        }
      };
    }

    return { model };
  };

  let inference = (dialect: Dialect) => async (c: Context<{ Variables: Variables }>) => {
    let parsed = await readModel(c);
    if ('error' in parsed) return errorResponse(dialect, parsed.error);

    await deps.route({ principal: c.get('principal'), model: parsed.model });

    return errorResponse(dialect, notImplemented(dialect));
  };

  app.get('/v1/models', authenticated('detect'), async c => {
    let models = await deps.listModels({ principal: c.get('principal') });

    return c.json(
      c.get('dialect') == 'anthropic_messages'
        ? anthropicModelList(models)
        : openaiModelList(models)
    );
  });

  app.get('/v1/models/:model{.+}', authenticated('detect'), async c => {
    let slug = c.req.param('model');
    let models = await deps.listModels({ principal: c.get('principal') });

    let model = models.find(model => model.slug == slug);
    if (!model) {
      return errorResponse(c.get('dialect'), {
        status: 404,
        code: 'model_not_found',
        message: `The model "${slug}" does not exist or is not available to this token.`
      });
    }

    return c.json(
      c.get('dialect') == 'anthropic_messages' ? anthropicModel(model) : openaiModel(model)
    );
  });

  app.post('/v1/chat/completions', authenticated('openai_chat'), inference('openai_chat'));
  app.post('/v1/responses', authenticated('open_responses'), inference('open_responses'));
  app.post(
    '/v1/messages',
    authenticated('anthropic_messages'),
    inference('anthropic_messages')
  );
  app.post(
    '/v1/messages/count_tokens',
    authenticated('anthropic_messages'),
    inference('anthropic_messages')
  );

  app.notFound(c =>
    errorResponse(dialectOfRequest(c), {
      status: 404,
      code: 'route_not_found',
      message: `${c.req.method} ${new URL(c.req.url).pathname} is not an endpoint of the AI gateway.`
    })
  );

  return app;
};
