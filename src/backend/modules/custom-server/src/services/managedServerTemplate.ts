import { db } from '@metorial/db';
import { notFoundError, ServiceError } from '@metorial/error';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';

let include = {
  bucketTemplate: true
};

class ManagedServerTemplateServiceImpl {
  async listManagedServerTemplates(d: {}) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.managedServerTemplate.findMany({
            ...opts,
            where: {
              status: 'active',
              isListed: true
            },
            include
          })
      )
    );
  }

  async getManagedServerTemplateById(d: { templateId: string }) {
    let server = await db.managedServerTemplate.findFirst({
      where: {
        id: d.templateId
      },
      include
    });
    if (!server) {
      throw new ServiceError(notFoundError('managed_server.template', d.templateId));
    }

    return server;
  }
}

export let managedServerTemplateService = Service.create(
  'managedServerTemplate',
  () => new ManagedServerTemplateServiceImpl()
).build();
