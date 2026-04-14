import {
  notFoundError,
  ServiceError,
  unauthorizedError
} from '@lowerdeck/error';
import { generatePlainId } from '@lowerdeck/id';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { addHours } from 'date-fns';
import type { Admin, App } from '../../prisma/generated/client';
import { db, withTransaction } from '../db';
import { getId, ID } from '../id';
import type { Context } from '../lib/context';
import { normalizeRedirectDomains } from '../lib/redirectDomains';

class AdminServiceImpl {
  async createAdminSession(d: { admin: Admin; context: Context }) {
    return await db.adminSession.create({
      data: {
        ...getId('adminSession'),
        clientSecret: generatePlainId(50),
        adminOid: d.admin.oid,
        expiresAt: addHours(new Date(), 1),
        ip: d.context.ip,
        ua: d.context.ua
      }
    });
  }

  async listUsers(d: { app: App; search?: string }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.user.findMany({
            ...opts,
            where: {
              appOid: d.app.oid,
              OR: d.search
                ? [
                    { userEmails: { some: { email: { contains: d.search } } } },
                    { name: { contains: d.search } },
                    { firstName: { contains: d.search } },
                    { lastName: { contains: d.search } }
                  ]
                : undefined
            },
            include: { userEmails: true }
          })
      )
    );
  }

  async getUser(d: { userId: string }) {
    let user = await db.user.findUnique({
      where: { id: d.userId },
      include: {
        userEmails: true,
        authDeviceUserSessions: {
          include: { device: true }
        },
        authAttempts: true
      }
    });
    if (!user) throw new ServiceError(notFoundError('user', d.userId));
    return user;
  }

  async listAdmins() {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.admin.findMany({
            ...opts
          })
      )
    );
  }

  async authenticateAdmin(d: { clientSecret: string }) {
    let session = await db.adminSession.findUnique({
      where: { clientSecret: d.clientSecret },
      include: { admin: true }
    });
    if (!session || session.expiresAt < new Date()) {
      throw new ServiceError(unauthorizedError({ message: 'Invalid session' }));
    }

    return session.admin;
  }

  async createApp(d: {
    defaultRedirectUrl: string;
    slug?: string;
    redirectDomains?: string[];
    isSessionless?: boolean;
    disableEmailAuth?: boolean;
  }) {
    let redirectDomains =
      d.redirectDomains !== undefined ? normalizeRedirectDomains(d.redirectDomains) : [];

    return withTransaction(async db => {
      let app = await db.app.create({
        data: {
          ...getId('app'),
          clientId: await ID.generateId('app_clientId'),
          slug: d.slug || null,
          isSessionless: d.isSessionless ?? false,
          disableEmailAuth: d.disableEmailAuth ?? false,
          defaultRedirectUrl: d.defaultRedirectUrl,
          redirectDomains
        }
      });

      let tenant = await db.tenant.create({
        data: {
          ...getId('tenant'),
          clientId: await ID.generateId('tenant_clientId'),
          appOid: app.oid
        }
      });

      return await db.app.update({
        where: { oid: app.oid },
        data: { defaultTenantOid: tenant.oid },
        include: {
          defaultTenant: true,
          _count: { select: { users: true, tenants: true } }
        }
      });
    });
  }

  async upsertApp(d: {
    defaultRedirectUrl: string;
    slug: string;
    redirectDomains?: string[];
    isSessionless?: boolean;
    disableEmailAuth?: boolean;
  }) {
    let existingApp = await db.app.findUnique({
      where: { slug: d.slug },
      include: {
        defaultTenant: true,
        _count: { select: { users: true, tenants: true } }
      }
    });
    try {
      return await this.createApp({
        defaultRedirectUrl: d.defaultRedirectUrl,
        slug: d.slug,
        redirectDomains: d.redirectDomains,
        isSessionless: d.isSessionless,
        disableEmailAuth: d.disableEmailAuth
      });
    } catch (e: any) {
      if (e.code !== 'P2002') {
        throw e;
      }

      existingApp = await db.app.findUnique({
        where: { slug: d.slug },
        include: {
          defaultTenant: true,
          _count: { select: { users: true, tenants: true } }
        }
      });
      if (!existingApp) throw e;
    }

    return await this.updateApp({
      app: existingApp,
      input: {
        redirectDomains: d.redirectDomains,
        slug: d.slug,
        isSessionless: d.isSessionless,
        disableEmailAuth: d.disableEmailAuth
      }
    });
  }

  async updateApp(d: {
    app: App;
    input: {
      slug?: string;
      redirectDomains?: string[];
      isSessionless?: boolean;
      disableEmailAuth?: boolean;
    };
  }) {
    let redirectDomains =
      d.input.redirectDomains !== undefined
        ? normalizeRedirectDomains(d.input.redirectDomains)
        : undefined;

    return await db.app.update({
      where: { oid: d.app.oid },
      data: {
        slug: d.input.slug !== undefined ? d.input.slug || null : undefined,
        isSessionless:
          d.input.isSessionless !== undefined ? d.input.isSessionless : undefined,
        disableEmailAuth:
          d.input.disableEmailAuth !== undefined ? d.input.disableEmailAuth : undefined,
        redirectDomains
      },
      include: {
        defaultTenant: true,
        _count: { select: { users: true, tenants: true } }
      }
    });
  }

  async listApps() {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.app.findMany({
            ...opts,
            include: {
              defaultTenant: true,
              _count: { select: { users: true, tenants: true } }
            }
          })
      )
    );
  }

  async getApp(d: { appId: string }) {
    let app = await db.app.findUnique({
      where: { id: d.appId },
      include: {
        defaultTenant: true,
        tenants: true,
        _count: { select: { users: true } }
      }
    });
    if (!app) throw new ServiceError(notFoundError('app', d.appId));
    return app;
  }

  async listTenants(d: { app: App }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.tenant.findMany({
            ...opts,
            where: { appOid: d.app.oid },
            include: {
              _count: { select: { users: true } }
            }
          })
      )
    );
  }

  async getTenant(d: { tenantId: string }) {
    let tenant = await db.tenant.findUnique({
      where: { id: d.tenantId },
      include: {
        app: true,
        _count: { select: { users: true } }
      }
    });
    if (!tenant) throw new ServiceError(notFoundError('tenant', d.tenantId));
    return tenant;
  }
}

export let adminService = Service.create('AdminService', () => new AdminServiceImpl()).build();
