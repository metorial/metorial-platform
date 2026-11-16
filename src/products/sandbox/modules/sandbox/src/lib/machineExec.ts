import {
  badRequestError,
  conflictError,
  createError,
  type ErrorRecord,
  ServiceError,
  timeoutError
} from '@lowerdeck/error';
import type { SandboxMachineExecOutcome } from '@metorial/fabric';

export let machineExecDefaultTimeoutSeconds = 60;
export let machineExecMaxTimeoutSeconds = 300;

let execRequestId = 'exec';
let execOutputLimitBytes = 1024 * 1024;

let textDecoder = new TextDecoder();

let machineUnreachableError = createError({
  status: 502,
  code: 'machine_unreachable',
  message: 'Could not connect to the machine.'
});

let machineConnectionLostError = createError({
  status: 502,
  code: 'machine_connection_lost',
  message: 'The connection to the machine closed before the command finished.'
});

export type MachineExecOutcome = SandboxMachineExecOutcome;

export class MachineExecError extends ServiceError<ErrorRecord<any, any>> {
  constructor(
    readonly outcome: Exclude<MachineExecOutcome, 'exited'>,
    error: ErrorRecord<any, any>
  ) {
    super(error);
  }
}

export type MachineExecResult = {
  exitCode: number | null;
  signal: string | null;
  timedOut: boolean;
  stdout: string;
  stderr: string;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
};

let decodeExecFrame = (data: Uint8Array) => {
  let idLength = data[0];
  if (idLength === undefined || data.length < idLength + 2) return null;

  return {
    id: textDecoder.decode(data.subarray(1, 1 + idLength)),
    tag: data[1 + idLength],
    payload: data.subarray(2 + idLength)
  };
};

let createExecOutput = () => {
  let chunks: Uint8Array[] = [];
  let size = 0;
  let truncated = false;

  return {
    push: (payload: Uint8Array) => {
      let part = payload.subarray(0, execOutputLimitBytes - size);
      if (part.length < payload.length) truncated = true;
      if (!part.length) return;

      chunks.push(part);
      size += part.length;
    },

    get text() {
      return textDecoder.decode(Buffer.concat(chunks));
    },

    get truncated() {
      return truncated;
    }
  };
};

export let runMachineExec = async (d: {
  url: string;
  token: string;
  command: string;
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs: number;
  deadlineMs: number;
  signal?: AbortSignal;
}): Promise<MachineExecResult> => {
  let stdout = createExecOutput();
  let stderr = createExecOutput();

  let exit = await new Promise<{
    exitCode: number | null;
    signal: string | null;
    timedOut: boolean;
  }>((resolve, reject) => {
    let socket = new WebSocket(d.url, [
      'metorial-sandbox-v1',
      `metorial-sandbox-token.${d.token}`
    ]);
    socket.binaryType = 'arraybuffer';

    let opened = false;
    let settled = false;
    let backstop = setTimeout(
      () =>
        fail(
          new MachineExecError(
            'deadline',
            timeoutError({ message: 'The command did not finish in time.' })
          )
        ),
      d.deadlineMs
    );

    let onAbort = () =>
      fail(
        new MachineExecError(
          'disconnected',
          conflictError({ message: 'The request was cancelled before the command finished.' })
        )
      );

    let settle = (done: () => void) => {
      if (settled) return;
      settled = true;

      clearTimeout(backstop);
      d.signal?.removeEventListener('abort', onAbort);
      socket.close(1000, 'done');

      done();
    };

    let fail = (error: MachineExecError) => settle(() => reject(error));

    if (d.signal?.aborted) onAbort();
    else d.signal?.addEventListener('abort', onAbort);

    socket.addEventListener('open', () => {
      opened = true;

      socket.send(
        JSON.stringify({
          id: execRequestId,
          op: 'run',
          v: 1,
          command: ['/bin/sh', '-c', d.command],
          cwd: d.cwd,
          env: d.env,
          timeoutMs: d.timeoutMs
        })
      );
    });

    socket.addEventListener('message', event => {
      if (typeof event.data != 'string') {
        let frame = decodeExecFrame(new Uint8Array(event.data));
        if (frame?.id != execRequestId) return;

        if (frame.tag == 1) stdout.push(frame.payload);
        if (frame.tag == 2) stderr.push(frame.payload);
        return;
      }

      let message: any;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }

      if (message?.id != execRequestId) return;

      if (message.type == 'exit') {
        settle(() =>
          resolve({
            exitCode: typeof message.code == 'number' ? message.code : null,
            signal: typeof message.signal == 'string' ? message.signal : null,
            timedOut: message.timedOut === true
          })
        );
      }

      if (message.type == 'error') {
        fail(
          new MachineExecError(
            'rejected',
            badRequestError({
              message: message.error?.message ?? 'The command could not be run.'
            })
          )
        );
      }
    });

    socket.addEventListener('close', () =>
      fail(
        new MachineExecError(
          'disconnected',
          opened ? machineConnectionLostError : machineUnreachableError
        )
      )
    );
  });

  return {
    ...exit,
    stdout: stdout.text,
    stderr: stderr.text,
    stdoutTruncated: stdout.truncated,
    stderrTruncated: stderr.truncated
  };
};
