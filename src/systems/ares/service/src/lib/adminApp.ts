import { db } from '../db';
import { env } from '../env';
import { accessGroupService } from '../services/accessGroup';
import { adminService } from '../services/admin';

export const ADMIN_APP_SLUG = '__admin__';

export let adminAppClientId: string;

export async function ensureAdminApp() {
  let existing = await db.app.findFirst({ where: { slug: ADMIN_APP_SLUG } });

  if (existing) {
    adminAppClientId = existing.clientId;
    return;
  }

  try {
    let app = await adminService.createApp({
      slug: ADMIN_APP_SLUG,
      defaultRedirectUrl: env.service.ARES_ADMIN_URL,
      redirectDomains: [new URL(env.service.ARES_ADMIN_URL).hostname]
    });

    let accessGroup = await accessGroupService.create({
      app,
      input: {
        name: 'Admin',
        rules: [{ type: 'email_domain', value: 'metorial.com' }]
      }
    });

    await accessGroupService.assignToApp({
      accessGroup,
      app
    });

    adminAppClientId = app.clientId;
    console.log(`Admin app created with clientId: ${app.clientId}`);
  } catch (e: any) {
    // Handle race condition - another instance may have created it
    if (e?.code === 'P2002') {
      let app = await db.app.findFirstOrThrow({ where: { slug: ADMIN_APP_SLUG } });
      adminAppClientId = app.clientId;
    } else {
      throw e;
    }
  }
}
