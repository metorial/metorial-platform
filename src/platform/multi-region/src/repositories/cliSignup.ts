import { Service } from '@lowerdeck/service';
import { cell } from '../cell';
import {
  type CliSignupAttemptOutcome,
  type CliSignupBlockRuleType,
  globalDB,
  Prisma
} from '../db';

let SETTINGS_KEY = 'global';

class CliSignupRepository {
  async getSettings() {
    let settings = await globalDB.cliSignupSetting.findUnique({
      where: { key: SETTINGS_KEY }
    });

    return {
      signupDisabled: settings?.signupDisabled ?? false,
      updatedByAdminId: settings?.updatedByAdminId ?? null,
      updatedAt: settings?.updatedAt ?? null
    };
  }

  async setSignupDisabled(d: { disabled: boolean; adminId?: string | null }) {
    let settings = await globalDB.cliSignupSetting.upsert({
      where: { key: SETTINGS_KEY },
      create: {
        key: SETTINGS_KEY,
        signupDisabled: d.disabled,
        updatedByAdminId: d.adminId ?? null
      },
      update: {
        signupDisabled: d.disabled,
        updatedByAdminId: d.adminId ?? null
      }
    });

    return {
      signupDisabled: settings.signupDisabled,
      updatedByAdminId: settings.updatedByAdminId,
      updatedAt: settings.updatedAt
    };
  }

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

  async acquireIpSlot(d: { key: string; limit: number; windowMs: number }) {
    let tryExisting = async () => {
      let now = new Date();
      let windowEndsAt = new Date(now.getTime() + d.windowMs);

      let reset = await globalDB.cliSignupIpWindow.updateMany({
        where: { key: d.key, windowEndsAt: { lte: now } },
        data: { count: 1, windowEndsAt }
      });
      if (reset.count > 0) return true;

      let incremented = await globalDB.cliSignupIpWindow.updateMany({
        where: { key: d.key, windowEndsAt: { gt: now }, count: { lt: d.limit } },
        data: { count: { increment: 1 } }
      });
      return incremented.count > 0;
    };

    if (await tryExisting()) return { acquired: true as const };

    try {
      await globalDB.cliSignupIpWindow.create({
        data: {
          key: d.key,
          count: 1,
          windowEndsAt: new Date(Date.now() + d.windowMs)
        }
      });

      return { acquired: true as const };
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') {
        throw err;
      }
    }

    if (await tryExisting()) return { acquired: true as const };

    let existing = await globalDB.cliSignupIpWindow.findUnique({
      where: { key: d.key }
    });

    return {
      acquired: false as const,
      windowEndsAt: existing?.windowEndsAt ?? new Date(Date.now() + d.windowMs)
    };
  }

  async releaseIpSlot(d: { key: string }) {
    await globalDB.cliSignupIpWindow.updateMany({
      where: { key: d.key, count: { gt: 0 } },
      data: { count: { decrement: 1 } }
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
