import { syncBuiltinESMExports } from 'node:module';
import net from 'node:net';
import { isMainThread } from 'node:worker_threads';
import { beginRequest, RequestContext, setConcurrency, type Concurrency } from './context';
import { Control } from './control';
import { createInvoker, loadEntrypoint, serializeResult, type Entrypoint } from './entrypoint';
import { installLogCapture } from './logs';
import { installNetwork } from './network';
import { installPools } from './pools';
import { denyWorkerThreadNetwork, installWorkerThreads } from './threads';

let INTERNAL_ENV = [
  'METORIAL_SUPERVISOR_SOCKET',
  'METORIAL_CONTROL_FD',
  'METORIAL_ENTRYPOINT',
  'METORIAL_CONCURRENCY',
  'METORIAL_BUNDLE_DIR'
];

let readConfig = () => {
  let env = process.env;
  let config = {
    socketPath: env.METORIAL_SUPERVISOR_SOCKET ?? '',
    controlFd: Number(env.METORIAL_CONTROL_FD ?? '3'),
    entrypoint: JSON.parse(env.METORIAL_ENTRYPOINT ?? 'null') as Entrypoint,
    concurrency: (env.METORIAL_CONCURRENCY == 'exclusive'
      ? 'exclusive'
      : 'shared') as Concurrency,
    bundleDir: env.METORIAL_BUNDLE_DIR ?? process.cwd()
  };
  for (let name of INTERNAL_ENV) delete env[name];

  if (!config.socketPath) throw new Error('METORIAL_SUPERVISOR_SOCKET is not set');
  if (!config.entrypoint?.path) throw new Error('METORIAL_ENTRYPOINT is not set');
  return config;
};

let main = async () => {
  let config = readConfig();

  let control = new Control(
    new net.Socket({ fd: config.controlFd, readable: true, writable: true })
  );
  control.onClose(() => process.exit(0));

  let crash = (phase: 'boot' | 'runtime', err: any) => {
    control.send({
      type: 'crash',
      phase,
      message: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
      stack: err instanceof Error ? err.stack : undefined
    });
  };

  process.on('uncaughtException', err => {
    console.error(err);
    crash('runtime', err);
    setTimeout(() => process.exit(1), 50).unref();
  });

  setConcurrency(config.concurrency);
  installNetwork(control, config.socketPath);
  await installPools();
  installWorkerThreads();
  installLogCapture(control);
  syncBuiltinESMExports();

  let invoke: (payloadJson: string) => Promise<unknown>;
  try {
    invoke = createInvoker(
      await loadEntrypoint(config.bundleDir, config.entrypoint),
      config.entrypoint
    );
  } catch (err) {
    console.error(err);
    crash('boot', err);
    setTimeout(() => process.exit(1), 50).unref();
    return;
  }

  let requests = new Map<string, RequestContext>();

  control.on('invoke', frame => {
    let requestId = frame.requestId!;
    let ctx = new RequestContext(
      requestId,
      frame.context?.invocationId ?? '',
      frame.context?.deadlineMs ?? 0
    );
    requests.set(requestId, ctx);
    beginRequest(ctx);

    ctx
      .run(() => invoke(String(frame.payload ?? '')))
      .then(result => {
        if (ctx.ended) return;
        let json = serializeResult(result);
        ctx.end();
        requests.delete(requestId);
        control.sendJson(
          `{"type":"result","requestId":${JSON.stringify(requestId)},"payload":${json}}`
        );
      });
  });

  control.on('cancel', frame => {
    let ctx = requests.get(frame.requestId!);
    requests.delete(frame.requestId!);
    ctx?.end();
  });

  control.send({ type: 'ready' });
};

if (isMainThread) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
} else {
  denyWorkerThreadNetwork();
  syncBuiltinESMExports();
}
