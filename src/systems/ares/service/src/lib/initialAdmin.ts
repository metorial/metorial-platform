import { db } from '../db';
import { getId } from '../id';

let INITIAL_ADMIN_EMAIL = 'admin@localhost';
let INITIAL_ADMIN_PASSWORD = 'admin123';

// This creates an initial admin user on first startup for local development
// The initial admin is automatically deleted once another admin is created
(async () => {
  if (process.env.NODE_ENV !== 'development') return;

  let initialAdmin = await db.admin.findFirst({
    where: { email: INITIAL_ADMIN_EMAIL }
  });
  let otherUser = await db.admin.findFirst({
    where: { email: { not: INITIAL_ADMIN_EMAIL } }
  });

  if (!otherUser && !initialAdmin) {
    initialAdmin = await db.admin.upsert({
      where: {
        email: INITIAL_ADMIN_EMAIL
      },
      create: {
        ...getId('admin'),
        email: INITIAL_ADMIN_EMAIL,
        name: 'Initial Admin',
        password: await Bun.password.hash(INITIAL_ADMIN_PASSWORD)
      },
      update: {}
    });

    console.log(
      `[InitialAdmin] Created initial admin: ${INITIAL_ADMIN_EMAIL} / ${INITIAL_ADMIN_PASSWORD}`
    );
  }

  // Auto-cleanup once another admin is created
  while (initialAdmin) {
    await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds

    otherUser = await db.admin.findFirst({
      where: { email: { not: INITIAL_ADMIN_EMAIL } }
    });

    if (otherUser) {
      await db.adminSession.deleteMany({
        where: { adminOid: initialAdmin.oid }
      });
      await db.admin.deleteMany({
        where: { oid: initialAdmin.oid }
      });

      console.log('[InitialAdmin] Deleted initial admin after other admin was created');
      initialAdmin = null;
      break;
    }
  }
})().catch(console.error);
