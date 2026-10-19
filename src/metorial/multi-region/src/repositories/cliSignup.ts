import { Service } from '@lowerdeck/service';
import { cell } from '../cell';
import {
  type CliSignupAttemptOutcome,
  type CliSignupBlockRuleType,
  globalDB,
  Prisma
} from '../db';

class CliSignupRepository {
  async listActiveBlockRules() {
    return await globalDB.cliSignupBlockRule.findMany({
      where: {
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
      }
    });
  }

  async listBlockRules() {
    return await globalDB.cliSignupBlockRule.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  async getBlockRuleById(d: { id: string }) {
    return await globalDB.cliSignupBlockRule.findUnique({
      where: { id: d.id }
    });
  }

  async upsertBlockRule(d: {
    type: CliSignupBlockRuleType;
    value: string;
    note?: string | null;
    createdByAdminId?: string | null;
    expiresAt?: Date | null;
  }) {
    return await globalDB.cliSignupBlockRule.upsert({
      where: {
        type_value: { type: d.type, value: d.value }
      },
      create: {
        type: d.type,
        value: d.value,
        note: d.note ?? null,
        createdByAdminId: d.createdByAdminId ?? null,
        expiresAt: d.expiresAt ?? null
      },
      update: {
        note: d.note ?? null,
        expiresAt: d.expiresAt ?? null
      }
    });
  }

  async deleteBlockRule(d: { id: string }) {
    await globalDB.cliSignupBlockRule.deleteMany({
      where: { id: d.id }
    });
  }

  async acquireIpLock(d: { key: string; durationMs: number }) {
    let now = new Date();
    let lockedUntil = new Date(now.getTime() + d.durationMs);

    let updated = await globalDB.cliSignupIpLock.updateMany({
      where: { key: d.key, lockedUntil: { lte: now } },
      data: { lockedUntil }
    });
    if (updated.count > 0) return { acquired: true as const, lockedUntil };

    try {
      await globalDB.cliSignupIpLock.create({
        data: { key: d.key, lockedUntil }
      });

      return { acquired: true as const, lockedUntil };
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') {
        throw err;
      }
    }

    let existing = await globalDB.cliSignupIpLock.findUnique({
      where: { key: d.key }
    });

    return {
      acquired: false as const,
      lockedUntil: existing?.lockedUntil ?? lockedUntil
    };
  }

  async releaseIpLock(d: { key: string }) {
    await globalDB.cliSignupIpLock.deleteMany({
      where: { key: d.key }
    });
  }

  async recordAttempt(d: {
    outcome: CliSignupAttemptOutcome;
    ip: string;
    country?: string | null;
    asn?: string | null;
    organizationId?: string | null;
    blockRuleId?: string | null;
  }) {
    let currentCell = await cell;

    let blockRule = d.blockRuleId
      ? await globalDB.cliSignupBlockRule.findUnique({ where: { id: d.blockRuleId } })
      : null;

    return await globalDB.cliSignupAttempt.create({
      data: {
        outcome: d.outcome,
        ip: d.ip,
        country: d.country ?? null,
        asn: d.asn ?? null,
        organizationId: d.organizationId ?? null,
        blockRuleOid: blockRule?.oid ?? null,
        cellOid: currentCell.oid
      }
    });
  }

  async listAttempts(d: {
    ip?: string;
    outcome?: CliSignupAttemptOutcome;
    limit: number;
    beforeId?: string;
  }) {
    let before = d.beforeId
      ? await globalDB.cliSignupAttempt.findUnique({ where: { id: d.beforeId } })
      : null;

    return await globalDB.cliSignupAttempt.findMany({
      where: {
        ip: d.ip,
        outcome: d.outcome,
        oid: before ? { lt: before.oid } : undefined
      },
      include: { blockRule: true, cell: true },
      orderBy: { oid: 'desc' },
      take: d.limit
    });
  }
}

export let cliSignupRepository = Service.create(
  'cliSignupRepository',
  () => new CliSignupRepository()
).build();
