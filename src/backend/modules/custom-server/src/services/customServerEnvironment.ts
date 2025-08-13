import { CustomServer, db, ID, Instance, Organization, withTransaction } from '@metorial/db';
import { createLock } from '@metorial/lock';
import { profileService } from '@metorial/module-community';
import { Service } from '@metorial/service';
import { createShortIdGenerator } from '@metorial/slugify';

let lock = createLock({ name: 'csrv/ensureEnv' });

let getVariantIdentifier = createShortIdGenerator(
  async id => !(await db.serverVariant.findFirst({ where: { identifier: id } })),
  { length: 8 }
);

class CustomServerEnvironmentServiceImpl {
  async ensureEnvironment(d: {
    server: CustomServer;
    instance: Instance;
    organization: Organization;
  }) {
    return withTransaction(
      async db => {
        let env = await db.customServerEnvironment.findUnique({
          where: {
            instanceOid_customServerOid: {
              instanceOid: d.instance.oid,
              customServerOid: d.server.oid
            }
          }
        });

        if (env) return env;

        return await lock.usingLock(d.server.id, async () => {
          let env = await db.customServerEnvironment.findUnique({
            where: {
              instanceOid_customServerOid: {
                instanceOid: d.instance.oid,
                customServerOid: d.server.oid
              }
            }
          });

          if (env) return env;

          let profile = await profileService.ensureProfile({
            for: {
              type: 'organization',
              organization: d.organization
            }
          });
          let provider = await profileService.ensureProfileVariantProvider({
            profile
          });

          let variant = await db.serverVariant.create({
            data: {
              id: await ID.generateId('serverVariant'),
              identifier: await getVariantIdentifier(),

              // There can be multiple production instances,
              // and hence also multiple default variants.
              // This is not unique.
              isDefault: d.instance.type == 'production',

              defaultForInstanceOid: d.instance.oid,

              providerOid: provider.oid,
              serverOid: d.server.serverOid,

              // TODO: Add other service types as needed
              sourceType:
                d.server.type == 'remote'
                  ? 'remote'
                  : (() => {
                      throw new Error('Unsupported server type');
                    })()
            }
          });

          return await db.customServerEnvironment.upsert({
            where: {
              instanceOid_customServerOid: {
                instanceOid: d.instance.oid,
                customServerOid: d.server.oid
              }
            },
            create: {
              id: await ID.generateId('customServerEnvironment'),
              name: d.instance.name,
              instanceOid: d.instance.oid,
              organizationOid: d.instance.organizationOid,
              customServerOid: d.server.oid,
              serverVariantOid: variant.oid
            },
            update: {}
          });
        });
      },
      { ifExists: true }
    );
  }
}

export let customServerEnvironmentService = Service.create(
  'customServerEnvironment',
  () => new CustomServerEnvironmentServiceImpl()
).build();
