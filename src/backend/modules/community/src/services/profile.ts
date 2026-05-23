import { Service } from '@mtsrc/service';
import { createSlugGenerator } from '@mtsrc/slugify';
import { db, ID, Organization, OrganizationActor, Profile, User } from '@metorial/db';

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

  async updateProfile(d: {
    profile: Profile;
    input: {
      name?: string;
      description?: string | null;
    };
    performedBy: OrganizationActor;
  }) {
    await db.profileUpdate.create({
      data: {
        id: await ID.generateId('profileUpdate'),
        profileOid: d.profile.oid,
        createdByOid: d.performedBy.oid,

        before: {
          name: d.profile.name,
          description: d.profile.description,
          image: d.profile.image,
          slug: d.profile.slug
        },

        after: {
          name: d.input.name ?? d.profile.name,
          description: d.input.description ?? d.profile.description,
          image: d.profile.image,
          slug: d.profile.slug
        }
      }
    });

    return await db.profile.update({
      where: { oid: d.profile.oid },
      data: {
        name: d.input.name,
        description: d.input.description,

        isCustomized: true
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
        ...(!profile.isCustomized
          ? {
              name: entity.name
            }
          : {}),

        // TODO: add image updates
        image: entity.image as any
      }
    });
  }
}

export let profileService = Service.create(
  'profileService',
  () => new ProfileService()
).build();
