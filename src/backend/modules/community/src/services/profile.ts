import { db, ID, Organization, Profile, User } from '@metorial/db';
import { Service } from '@metorial/service';
import { createSlugGenerator } from '@metorial/slugify';

let ensureProfileSlug = createSlugGenerator(
  async slug => !(await db.profile.findFirst({ where: { slug } }))
);

class ProfileService {
  async ensureProfile(d: {
    for:
      | {
          type: 'organization';
          organization: Organization;
        }
      | {
          type: 'user';
          user: User;
        };
  }) {
    let profile = await db.profile.findFirst({
      where: {
        userOid: d.for.type === 'user' ? d.for.user.oid : undefined,
        organizationOid: d.for.type === 'organization' ? d.for.organization.oid : undefined
      }
    });
    if (profile) return profile;

    let entity = d.for.type === 'user' ? d.for.user : d.for.organization;

    return await db.profile.upsert({
      where:
        d.for.type === 'user'
          ? {
              userOid: d.for.user.oid
            }
          : {
              organizationOid: d.for.organization.oid
            },
      update: {},
      create: {
        id: await ID.generateId('profile'),
        userOid: d.for.type === 'user' ? d.for.user.oid : undefined,
        organizationOid: d.for.type === 'organization' ? d.for.organization.oid : undefined,

        type: d.for.type,

        name: entity.name,
        slug: await ensureProfileSlug({
          input: 'slug' in entity ? entity.slug : entity.name
        }),
        image: entity.image as any,
        attributes: []
      }
    });
  }

  async syncProfile(d: {
    for:
      | {
          type: 'organization';
          organization: Organization;
        }
      | {
          type: 'user';
          user: User;
        };
  }) {
    let profile = await this.ensureProfile(d);

    let entity = d.for.type === 'user' ? d.for.user : d.for.organization;

    await db.profile.updateMany({
      where: { oid: profile.oid },
      data: {
        name: entity.name,
        image: entity.image as any
      }
    });
  }

  async ensureProfileVariantProvider(d: { profile: Profile }) {
    if (d.profile.providerOid) {
      return (await db.serverVariantProvider.findUnique({
        where: { oid: d.profile.providerOid }
      }))!;
    }

    let provider = await db.serverVariantProvider.create({
      data: {
        id: await ID.generateId('serverVariantProvider'),
        name: d.profile.name,
        description: d.profile.description,
        image: d.profile.image as any,
        attributes: d.profile.attributes,
        identifier: `profile-${d.profile.id}`
      }
    });

    await db.profile.updateMany({
      where: { oid: d.profile.oid },
      data: { providerOid: provider.oid }
    });

    return provider;
  }
}

export let profileService = Service.create(
  'profileService',
  () => new ProfileService()
).build();
