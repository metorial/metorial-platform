import { db, ID } from '@metorial/db';

export let ensureTemplate = (d: {
  contents: PrismaJson.CodeBucketTemplateContents;
  name: string;
  slug: string;
}) => {
  let randomDelay =
    process.env.NODE_ENV == 'development' ? 0 : Math.floor(Math.random() * 30000);

  setTimeout(async () => {
    let existing = await db.managedServerTemplate.findFirst({
      where: { slug: d.slug }
    });

    if (existing) {
      await db.codeBucketTemplate.updateMany({
        where: { oid: existing.bucketTemplateOid },
        data: { contents: d.contents, name: d.name }
      });

      await db.managedServerTemplate.updateMany({
        where: { oid: existing.oid },
        data: { name: d.name, status: 'active', isListed: true }
      });
    } else {
      try {
        let bucketTemplate = await db.codeBucketTemplate.create({
          data: {
            id: await ID.generateId('codeBucketTemplate'),
            name: d.name,
            contents: d.contents
          }
        });

        await db.managedServerTemplate.create({
          data: {
            id: await ID.generateId('managedServerTemplate'),
            name: d.name,
            slug: d.slug,
            bucketTemplateOid: bucketTemplate.oid,
            status: 'active',
            isListed: true
          }
        });
      } catch (e: any) {
        if (e.code === 'P2002') {
          // ignore unique constraint violation
          return;
        }

        throw e;
      }
    }
  }, randomDelay);
};
