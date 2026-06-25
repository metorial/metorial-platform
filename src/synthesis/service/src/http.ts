import { internalServerError, isServiceError } from '@lowerdeck/error';
import { createHono } from '@lowerdeck/hono';
import { streamSSE } from 'hono/streaming';
import { assistantRequestService } from './services';

let toErrorResponse = (error: unknown) => {
  if (isServiceError(error)) {
    return Response.json(error.toResponse(), {
      status: error.data.status
    });
  }

  return Response.json(internalServerError().toResponse(), {
    status: 500
  });
};

export let synthesisHttpApi = createHono()
  .use(async (c, next) => {
    c.res.headers.set('Access-Control-Allow-Origin', c.req.header('Origin') || '*');
    c.res.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    c.res.headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, Cookies, baggage, sentry-trace'
    );
    c.res.headers.set('Access-Control-Allow-Credentials', 'true');
    c.res.headers.set('Access-Control-Max-Age', '86400');

    if (c.req.method === 'OPTIONS') {
      return c.text('OK', 200);
    }

    await next();
  })
  .options('*', c => c.text(''))
  .get('/ping', c => c.text('OK'))
  .get('/assistant-live/requests/:assistantRequestId/deltas', async c => {
    let { assistantRequestId } = c.req.param();

    try {
      await assistantRequestService.getAssistantRequestById({
        requestId: assistantRequestId
      });

      return streamSSE(c, async stream => {
        let controller = new AbortController();
        let closeListener: (() => Promise<void>) | undefined;
        let finished = false;
        let resolveDone!: () => void;
        let done = new Promise<void>(resolve => {
          resolveDone = resolve;
        });

        let finish = async () => {
          if (finished) return;
          finished = true;
          controller.abort();
          if (closeListener) {
            await closeListener();
          }
          resolveDone();
        };

        stream.onAbort(() => {
          void finish();
        });

        try {
          closeListener = await assistantRequestService.listenToAssistantRequestDeltas({
            requestId: assistantRequestId,
            signal: controller.signal,
            onMessage: async message => {
              if (finished) return;

              await stream.writeSSE({
                event: message[0] == 's' ? 'snapshot' : 'delta',
                id: String(message[1]),
                data: JSON.stringify(message)
              });
            },
            onError: async error => {
              if (finished) return;

              await stream.writeSSE({
                event: 'error',
                data: JSON.stringify({
                  message: error.message
                })
              });
              await finish();
            },
            onDone: async message => {
              if (finished) return;

              await stream.writeSSE({
                event: 'done',
                data: JSON.stringify(message)
              });
              await finish();
            }
          });

          await done;
        } finally {
          await finish();
        }
      });
    } catch (error) {
      return toErrorResponse(error);
    }
  });
