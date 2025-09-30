export let logsTs = `export type CapturedLines = {
  type: "info" | "error";
  lines: string[];
};

export class OutputInstrumentation {
  private onLineCaptured: (lines: CapturedLines[]) => void;

  private stdoutBuf = "";
  private stderrBuf = "";
  
  // Batching state
  private batchedLines: CapturedLines[] = [];
  private batchTimer: number | null = null;
  private readonly batchDelayMs = 100;

  private orig = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug,
    stdoutWrite: Deno.stdout.write.bind(Deno.stdout),
    stderrWrite: Deno.stderr.write.bind(Deno.stderr),
    stdoutWriteSync: Deno.stdout.writeSync?.bind(Deno.stdout),
    stderrWriteSync: Deno.stderr.writeSync?.bind(Deno.stderr),
  };

  constructor(cb: (lines: CapturedLines[]) => void) {
    this.onLineCaptured = cb;
    this.patchConsole();
    this.patchWriters();
  }

  private patchConsole() {
    let formatArgs = (args: unknown[]) =>
      args.map(a => {
        try {
          if (typeof a === "object" && a !== null) return JSON.stringify(a);
          return String(a);
        } catch {
          return String(a);
        }
      }).join(" ");

    console.log = (...args: unknown[]) => {
      let text = formatArgs(args) + "\\n";
      this.capture("info", text);
      this.orig.log(...args);
    };

    console.info = (...args: unknown[]) => {
      let text = formatArgs(args) + "\\n";
      this.capture("info", text);
      this.orig.info(...args);
    };

    console.warn = (...args: unknown[]) => {
      let text = formatArgs(args) + "\\n";
      this.capture("info", text);
      this.orig.warn(...args);
    };

    console.debug = (...args: unknown[]) => {
      let text = formatArgs(args) + "\\n";
      this.capture("info", text);
      this.orig.debug(...args);
    };

    console.error = (...args: unknown[]) => {
      let text = formatArgs(args) + "\\n";
      this.capture("error", text);
      this.orig.error(...args);
    };
  }

  private patchWriters() {
    Deno.stdout.write = async (p: Uint8Array) => {
      this.capture("info", new TextDecoder().decode(p));
      return await this.orig.stdoutWrite(p);
    };
    Deno.stderr.write = async (p: Uint8Array) => {
      this.capture("error", new TextDecoder().decode(p));
      return await this.orig.stderrWrite(p);
    };
    if (this.orig.stdoutWriteSync) {
      Deno.stdout.writeSync = (p: Uint8Array) => {
        this.capture("info", new TextDecoder().decode(p));
        return this.orig.stdoutWriteSync!(p);
      };
    }
    if (this.orig.stderrWriteSync) {
      Deno.stderr.writeSync = (p: Uint8Array) => {
        this.capture("error", new TextDecoder().decode(p));
        return this.orig.stderrWriteSync!(p);
      };
    }
  }

  private capture(type: "info" | "error", chunk: string) {
    if (type === "info") {
      this.stdoutBuf += chunk;
      this.flushBuffer("info");
    } else {
      this.stderrBuf += chunk;
      this.flushBuffer("error");
    }
  }

  private flushBuffer(type: "info" | "error") {
    let buf = type === "info" ? this.stdoutBuf : this.stderrBuf;
    let lines = buf.split(/\\r?\\n/);
    // last element may be incomplete line
    let complete = lines.slice(0, -1);
    let rest = lines[lines.length - 1];
    
    if (complete.length > 0) {
      this.addToBatch({ type, lines: complete });
    }
    
    if (type === "info") {
      this.stdoutBuf = rest;
    } else {
      this.stderrBuf = rest;
    }
  }

  private addToBatch(capturedLines: CapturedLines) {
    // Find existing batch entry of same type to merge with
    const existingIndex = this.batchedLines.findIndex(batch => batch.type === capturedLines.type);
    
    if (existingIndex !== -1) {
      // Merge lines with existing batch of same type
      this.batchedLines[existingIndex].lines.push(...capturedLines.lines);
    } else {
      // Add new batch entry
      this.batchedLines.push(capturedLines);
    }

    // Start or restart the batch timer
    if (this.batchTimer !== null) {
      clearTimeout(this.batchTimer);
    }
    
    this.batchTimer = setTimeout(() => {
      this.flushBatch();
    }, this.batchDelayMs);
  }

  private flushBatch() {
    if (this.batchedLines.length > 0) {
      const toFlush = [...this.batchedLines];
      this.batchedLines = [];
      this.batchTimer = null;
      this.onLineCaptured(toFlush);
    }
  }

  drain() {
    // Cancel any pending batch timer and flush immediately
    if (this.batchTimer !== null) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    
    // Flush any batched lines first
    this.flushBatch();
    
    // Then handle any remaining buffer content (original drain behavior)
    let drained: CapturedLines[] = [];
    if (this.stdoutBuf) {
      drained.push({ type: "info", lines: this.stdoutBuf.split(/\\r?\\n/) });
      this.stdoutBuf = "";
    }
    if (this.stderrBuf) {
      drained.push({ type: "error", lines: this.stderrBuf.split(/\\r?\\n/) });
      this.stderrBuf = "";
    }
    if (drained.length > 0) {
      this.onLineCaptured(drained);
    }
  }

  restore() {
    // Clean up batch timer
    if (this.batchTimer !== null) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    this.batchedLines = [];

    console.log = this.orig.log;
    console.info = this.orig.info;
    console.warn = this.orig.warn;
    console.error = this.orig.error;
    console.debug = this.orig.debug;

    Deno.stdout.write = this.orig.stdoutWrite;
    Deno.stderr.write = this.orig.stderrWrite;
    if (this.orig.stdoutWriteSync) Deno.stdout.writeSync = this.orig.stdoutWriteSync;
    if (this.orig.stderrWriteSync) Deno.stderr.writeSync = this.orig.stderrWriteSync;

    this.stdoutBuf = "";
    this.stderrBuf = "";
  }
}
`;
