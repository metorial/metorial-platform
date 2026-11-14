import { currentContext, type RequestContext } from './context';
import type { Control } from './control';

type Stream = 'stdout' | 'stderr';

let MAX_LINE_CHARS = 256 * 1024;

let partials = new WeakMap<RequestContext, Record<Stream, string>>();

export let installLogCapture = (control: Control) => {
  let send = (ctx: RequestContext, stream: Stream, line: string) =>
    control.send({
      type: 'log',
      requestId: ctx.requestId,
      ts: Date.now(),
      stream,
      line:
        line.length > MAX_LINE_CHARS
          ? line.slice(0, MAX_LINE_CHARS) + ' [line truncated]'
          : line
    });

  let capture = (stream: Stream, target: NodeJS.WriteStream) => {
    let write = target.write.bind(target);

    target.write = function (chunk: any, encoding?: any, callback?: any) {
      let ctx = currentContext();
      if (!ctx) return write(chunk, encoding, callback);

      let text =
        typeof chunk == 'string'
          ? chunk
          : Buffer.from(chunk).toString(
              typeof encoding == 'string' ? (encoding as BufferEncoding) : 'utf8'
            );

      let buffered = partials.get(ctx);
      if (!buffered) {
        let created = { stdout: '', stderr: '' };
        buffered = created;
        partials.set(ctx, created);
        ctx.onEnd(() => {
          for (let s of ['stdout', 'stderr'] as const) {
            if (created[s]) send(ctx!, s, created[s]);
            created[s] = '';
          }
        });
      }

      let lines = (buffered[stream] + text).split('\n');
      buffered[stream] = lines.pop()!;
      for (let line of lines)
        send(ctx, stream, line.endsWith('\r') ? line.slice(0, -1) : line);
      if (buffered[stream].length > MAX_LINE_CHARS) {
        send(ctx, stream, buffered[stream]);
        buffered[stream] = '';
      }

      let cb = typeof encoding == 'function' ? encoding : callback;
      if (typeof cb == 'function') process.nextTick(cb);
      return true;
    } as typeof target.write;
  };

  capture('stdout', process.stdout);
  capture('stderr', process.stderr);
};
