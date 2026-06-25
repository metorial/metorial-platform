import { forbiddenError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { addMinutes, subMinutes } from 'date-fns';
import { db } from '../db';
import type { Context } from '../lib/context';
import { auditLogService } from './auditLog';

class AuthBlockServiceImpl {
  async checkBlocked(d: { email: string; context: Context }) {
    let block = await db.authBlock.findFirst({
      where: {
        blockedUntil: { gt: new Date() },
        OR: [
          {
            identifier: d.email,
            identifierType: 'email'
          }
        ]
      }
    });

    if (block) {
      throw new ServiceError(
        forbiddenError({
          message: `To secure your account, we have temporarily blocked access to it. Please try again later.`
        })
      );
    }
  }

  async blockIfNeeded(d: { email: string; context: Context }) {
    let authActionsFromEmail = await db.authIntent.count({
      where: {
        identifier: d.email,
        identifierType: 'email',
        createdAt: { gt: subMinutes(new Date(), 10) }
      }
    });

    if (authActionsFromEmail > 15) {
      let blockedUntil = addMinutes(new Date(), 60);

      await db.authBlock.create({
        data: {
          blockedUntil,
          identifier: d.email,
          identifierType: 'email',
          ip: d.context.ip
        }
      });

      let user = await db.user.findFirst({
        where: {
          userEmails: { some: { email: d.email } }
        }
      });

      if (user) {
        auditLogService.log({
          appOid: user.appOid,
          type: 'auth.blocked',
          userOid: user.oid,
          ip: d.context.ip,
          metadata: { email: d.email, blockedUntil: blockedUntil.toISOString() }
        });
      }
    }
  }

  async registerBlock(d: { email: string; context: Context }) {
    await this.checkBlocked(d);
    await this.blockIfNeeded(d);
  }
}

export let authBlockService = Service.create(
  'AuthBlockService',
  () => new AuthBlockServiceImpl()
).build();
