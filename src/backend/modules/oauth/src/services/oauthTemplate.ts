import { db, ID, OAuthConnectionTemplate, systemProfile } from '@metorial/db';
import { notFoundError, ServiceError } from '@metorial/error';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';

let include = {
  profile: true
};

class OauthTemplateServiceImpl {
  async ensureTemplate(d: {
    slug: string;
    name: string;
    providerName: string;

    discoveryUrl?: string;

    configJsonata: string;
    scopes: PrismaJson.OAuthConfigTemplateScopes;
    variables: PrismaJson.OAuthConfigTemplateVariables;
  }) {
    let data = {
      slug: d.slug,
      name: d.name,
      providerName: d.providerName,

      discoveryUrl: d.discoveryUrl,

      configJsonata: d.configJsonata,
      scopes: d.scopes,
      variables: d.variables
    } satisfies Partial<OAuthConnectionTemplate>;

    return await db.oAuthConnectionTemplate.upsert({
      where: { slug: d.slug },
      update: data,
      create: {
        id: await ID.generateId('oauthConnectionTemplate'),

        profileOid: (await systemProfile).oid,

        ...data
      },
      include: { profile: true }
    });
  }

  async getTemplateById(d: { templateId: string }) {
    let template = await db.oAuthConnectionTemplate.findUnique({
      where: { id: d.templateId },
      include
    });
    if (!template) throw new ServiceError(notFoundError('template', d.templateId));

    return template;
  }

  async listTemplates(d: { profileIds?: string[] }) {
    let profiles = d.profileIds
      ? await db.profile.findMany({
          where: { id: { in: d.profileIds } },
          select: { oid: true }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.oAuthConnectionTemplate.findMany({
            ...opts,
            where: {
              profileOid: profiles ? { in: profiles.map(p => p.oid) } : undefined
            },
            include
          })
      )
    );
  }
}

export let oauthTemplateService = Service.create(
  'oauthTemplate',
  () => new OauthTemplateServiceImpl()
).build();
