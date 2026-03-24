import type { ServerConnection } from '../../../prisma/generated/client';
import { db, outputTypeReverseMapper } from '../../db';
import { snowflake } from '../../id';

export class ConnectionLogger {
  #buffer: {
    type: PrismaJson.OutputType;
    lines: string[];
    timestamp: number;
  }[] = [];
  #flushTo: NodeJS.Timeout | null = null;

  constructor(private readonly connection: ServerConnection) {}

  log(type: PrismaJson.OutputType, lines: string[] | string, ts?: number | string | Date) {
    let lastInBuffer = this.#buffer[this.#buffer.length - 1];
    if (
      lastInBuffer &&
      lastInBuffer.type == type &&
      Date.now() - lastInBuffer.timestamp < 1000
    ) {
      if (Array.isArray(lines)) {
        lastInBuffer.lines.push(...lines);
      } else {
        lastInBuffer.lines.push(...lines.split('\n'));
      }
    } else {
      this.#buffer.push({
        type,
        lines: Array.isArray(lines) ? lines : lines.split('\n'),
        timestamp: ts ? new Date(ts).getTime() : Date.now()
      });
    }

    this.scheduleFlush();
  }

  async flush() {
    if (this.#buffer.length === 0) return;

    let buffer = this.#buffer;
    this.#buffer = [];

    await db.serverConnectionLogsTemp.createMany({
      data: {
        oid: snowflake.nextId(),
        logLines: buffer.map(b => [
          b.timestamp,
          outputTypeReverseMapper.get(b.type) ?? 0,
          b.lines
        ]) as PrismaJson.ServerConnectionLogLines,
        serverConnectionOid: this.connection.oid
      }
    });
  }

  private scheduleFlush() {
    if (this.#flushTo) return;

    this.#flushTo = setTimeout(async () => {
      this.#flushTo = null;
      await this.flush();
    }, 5 * 1000);
  }
}
