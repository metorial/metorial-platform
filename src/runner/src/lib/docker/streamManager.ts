import { debug } from '@metorial/debug';

export class DockerStreamManager {
  constructor(
    private stdinStream: Bun.FileSink,
    private stdoutStream: ReadableStream<Uint8Array<ArrayBufferLike>>,
    private stderrStream: ReadableStream<Uint8Array<ArrayBufferLike>>
  ) {}

  private handleStream(
    stream: ReadableStream<Uint8Array<ArrayBufferLike>>,
    callback: (data: string[]) => void
  ) {
    let reader = stream.getReader();
    let decoder = new TextDecoder();

    let lineBuffer = '';

    let read = async () => {
      let { done, value } = await reader.read();
      if (done) return;

      let data = decoder.decode(value);
      lineBuffer += data;

      let lines = lineBuffer.split('\n');
      lineBuffer = lines.pop() || '';

      lines = lines.filter(line => line.length > 0);
      if (lines.length > 0) callback(lines);

      read();
    };

    read();
  }

  onStdout(callback: (data: string[]) => void) {
    this.handleStream(this.stdoutStream, callback);
  }

  onStderr(callback: (data: string[]) => void) {
    this.handleStream(this.stderrStream, callback);
  }

  stdin(data: string[]) {
    try {
      for (let line of data) {
        this.stdinStream.write(line + '\n');
      }
    } catch (err) {
      debug.warn('Failed to write to stdin:', err);
    }
  }
}
