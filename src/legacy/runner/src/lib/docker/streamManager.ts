import { debug } from '@metorial/debug';

export class DockerStreamManager {
  private recordings = new Map<string, string[]>();

  constructor(
    private stdinStream: Bun.FileSink,
    private stdoutStream: ReadableStream<Uint8Array<ArrayBufferLike>>,
    private stderrStream: ReadableStream<Uint8Array<ArrayBufferLike>>
  ) {}

  private handleStream(
    type: 'stdout' | 'stderr',
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
      if (lines.length > 0) {
        callback(lines);

        let rec = this.recordings.get(type) ?? [];
        rec.push(...lines);
        if (rec.length > 100) rec = rec.slice(-100);
        this.recordings.set(type, rec);
      }

      read();
    };

    read();
  }

  onStdout(callback: (data: string[]) => void) {
    this.handleStream('stdout', this.stdoutStream, callback);
  }

  onStderr(callback: (data: string[]) => void) {
    this.handleStream('stderr', this.stderrStream, callback);
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
