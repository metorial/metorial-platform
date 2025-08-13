import { db, ID, ProviderOAuthConnectionTemplate, systemProfile } from '@metorial/db';
import { badRequestError, notFoundError, ServiceError } from '@metorial/error';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';
import jsonata from 'jsonata';

let include = {
  profile: true
};

class OauthTemplateServiceImpl {
  async ensureTemplate(d: {
    slug: string;
    name: string;
    providerName: string;
    providerUrl: string;

    imageUrl: string;

    discoveryUrl?: string;

    configJsonata: string;
    scopes: PrismaJson.ProviderOAuthConfigTemplateScopes;
    variables: PrismaJson.ProviderOAuthConfigTemplateVariables;
  }) {
    let data = {
      name: d.name,
      providerName: d.providerName,
      providerUrl: d.providerUrl,

      image: { type: 'url', url: d.imageUrl },

      discoveryUrl: d.discoveryUrl,

      configJsonata: d.configJsonata,
      scopes: d.scopes,
      variables: d.variables
    } satisfies Partial<ProviderOAuthConnectionTemplate>;

    return await db.providerOAuthConnectionTemplate.upsert({
      where: { slug: d.slug },
      update: data,
      create: {
        id: await ID.generateId('oauthConnectionTemplate'),

        profileOid: (await systemProfile).oid,
        slug: d.slug,

        ...data
      },
      include: { profile: true }
    });
  }

  async getTemplateById(d: { templateId: string }) {
    let template = await db.providerOAuthConnectionTemplate.findUnique({
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
          await db.providerOAuthConnectionTemplate.findMany({
            ...opts,
            where: {
              profileOid: profiles ? { in: profiles.map(p => p.oid) } : undefined
            },
            include
          })
      )
    );
  }

  async evaluateTemplateConfig(d: {
    template: ProviderOAuthConnectionTemplate;
    data: Record<string, any>;
  }) {
    let inputs: Record<string, any> = {};

    for (let variable of d.template.variables) {
      if (variable.type == 'string') {
        inputs[variable.key] = d.data[variable.key];
      }

      if (!d.data[variable.key] && variable.isRequired) {
        throw new ServiceError(
          badRequestError({
            message: `Missing required variable: ${variable.key}`
          })
        );
      }
    }

    let config = jsonata(d.template.configJsonata).evaluate(inputs);

    if (typeof config !== 'object') {
      throw new ServiceError(
        badRequestError({
          message: 'Invalid config returned from template evaluation'
        })
      );
    }

    return config;
  }
}

export let providerOauthTemplateService = Service.create(
  'providerOauthTemplate',
  () => new OauthTemplateServiceImpl()
).build();
