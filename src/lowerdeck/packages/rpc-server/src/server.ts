import { internalServerError, isServiceError, notFoundError } from '@lowerdeck/error';
import { getSentry } from '@lowerdeck/sentry';
import {
  hasActiveSpan,
  isTelemetryEnabled,
  SpanStatusCode,
  trace
} from '@lowerdeck/telemetry';
import { Controller, Handler, ServiceRequest } from './controller';

let Sentry = getSentry();
let tracer = trace.getTracer('lowerdeck.rpc-server.calls');

let verbose = process.env.NODE_ENV !== 'production';

export let createServer =
  (opts: {
    onError?: (opts: {
      request: ServiceRequest;
      error: any;
      reqId: string;
      callId: string;
      callName: string;
    }) => void;
    onRequest?: (opts: {
      reqId: string;
      callId: string;
      callName: string;
      request: ServiceRequest;
      response: { status: number; body: any };
    }) => void;
  }) =>
  (controller: Controller<any>) => {
    let findHandler = (name: string): Handler<any, any, any> | null => {
      let parts = name.split(':');
      let current = controller;

      while (current && parts.length > 0) {
        current = current[parts.shift()!];
        if (!current) return null;
      }

      if (current && current instanceof Handler) return current;

      return null;
    };

    let getSupportedHandlerNames = (controller: Controller<any>): string[] =>
      Object.entries(controller).flatMap(([key, value]) => {
        if (value instanceof Handler) return [key];
        if (typeof value == 'object')
          return getSupportedHandlerNames(value).map(name => `${key}:${name}`);
        return [];
      });

    let handlerNames = getSupportedHandlerNames(controller);

    let run = async (
      req: ServiceRequest,
      call: { id: string; name: string; payload: any },
      reqId: string
    ): Promise<{
      response: any;
      status: number;
      request: ServiceRequest;
    }> => {
      let request = { ...req, body: call.payload };

      let executeCall = async () => {
        try {
          let handler = findHandler(call.name);

          if (!handler) {
            return {
              request,
              status: 404,
              response: notFoundError({ entity: 'handler' }).toResponse()
            };
          }

          let response = await handler.run(request, {});

          return {
            status: 200,
            request: req,
            response: response.response
          };
        } catch (e) {
          if (verbose) console.error(e);

          if (isServiceError(e)) {
            if (e.data.status >= 500) {
              Sentry.captureException(e, {
                tags: { reqId }
              });
            }

            return {
              request,
              status: e.data.status,
              response: e.toResponse()
            };
          }

          Sentry.captureException(e, {
            tags: { reqId }
          });

          opts.onError?.({
            callName: call.name,
            callId: call.id,
            request: req,
            error: e,
            reqId
          });

          throw e;
        }
      };

      let canTrace = isTelemetryEnabled() && hasActiveSpan();
      if (!canTrace) {
        let result = await executeCall();

        return {
          request: result.request,
          status: result.status,
          response: result.response
        };
      }

      let callSpanName = `rpc call: ${call.name}`;
      let callSpanOp = 'rpc.server.call';

      return await tracer.startActiveSpan(callSpanName, async span => {
        span.setAttribute('sentry.op', callSpanOp);
        span.setAttribute('rpc.system', 'lowerdeck');
        span.setAttribute('rpc.method', call.name);
        span.setAttribute('rpc.request_id', reqId);
        span.setAttribute('rpc.call_id', call.id);
        span.setAttribute('rpc.description', callSpanName);
        span.setAttribute('sentry.description', callSpanName);

        let finalize = (result: {
          request: ServiceRequest;
          status: number;
          response: any;
        }) => {
          span.setAttribute('rpc.response.status_code', result.status);
          if (result.status >= 500) {
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: `RPC call failed with status ${result.status}`
            });
          }

          return result;
        };

        try {
          let result = await executeCall();

          return finalize({
            request: result.request,
            status: result.status,
            response: result.response
          });
        } catch (e) {
          span.recordException(e as Error);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: e instanceof Error ? e.message : String(e)
          });

          return finalize({
            request,
            status: 500,
            response: internalServerError().toResponse()
          });
        } finally {
          span.end();
        }
      });
    };

    let runMany = async (
      req: ServiceRequest,
      body: {
        calls: {
          id: string;
          name: string;
          payload: any;
        }[];
        requestId: string;
      }
    ): Promise<{
      status: number;
      body: any;
    }> => {
      let callRes = await Promise.all(
        body.calls.map(async (call, i) => {
          let res = await run(req, call as any, body.requestId);

          try {
            opts.onRequest?.({
              reqId: body.requestId,
              callId: call.id,
              callName: call.name,
              request: res.request,
              response: { status: res.status, body: res.response }
            });
          } catch (e) {
            Sentry.captureException(e);
            if (verbose) console.error(e);
          }

          return {
            __typename: 'rpc.response.call',
            id: call.id,
            name: call.name,
            status: res.status,
            result: res.response
          };
        })
      );

      return {
        status: Math.max(...callRes.map(c => c.status)),
        body: {
          __typename: 'rpc.response',
          calls: callRes
        }
      };
    };

    return {
      handlerNames,
      runMany

      // fetch,

      // http: async (
      //   req: IncomingMessage & {
      //     body: any;
      //   },
      //   res: ServerResponse & { send: (body: any) => void }
      // ) => {
      //   let headers = new Headers(
      //     Object.fromEntries(
      //       Object.entries(req.headers).map(([key, value]) => [
      //         key,
      //         value === undefined ? '' : String(value)
      //       ])
      //     )
      //   );
      //   let url = new URL(req.url ?? '', `http://${req.headers.host}`);

      //   let request = new Request(url.toString(), {
      //     method: req.method,
      //     headers,
      //     body: JSON.stringify(req.body)
      //   });

      //   let response = await fetch(request);

      //   res.statusCode = response.status;

      //   for (let [key, value] of response.headers.entries()) {
      //     res.setHeader(key, value);
      //   }

      //   res.send(response.body);
      // }
    };
  };
