import { Service } from '@lowerdeck/service';
import type { AuditScope } from '@metorial/audit-scope';
import { Fabric } from '@metorial/fabric';
import { toAuditVirtualModel } from '../lib/audit';
import type { AiGateway, AiGatewayInput, AiGatewayVirtualModel } from '../lib/client';
import { createGatewayPaginator } from '../lib/paginator';
import type { ScopedInstance } from '../lib/scope';
import { aiGatewayTenantService } from './aiGatewayTenant';

type ForVirtualModel<F extends (input: any) => any> = Omit<
  AiGatewayInput<F>,
  'virtualModelId'
>;

class AiGatewayVirtualModelServiceImpl {
  list(d: { instance: ScopedInstance }) {
    return createGatewayPaginator(async page => {
      let { gateway, scope } = await aiGatewayTenantService.ensure(d);

      return await gateway.virtualModel.list({ ...scope, ...page });
    });
  }

  async get(d: { instance: ScopedInstance; virtualModelId: string }) {
    let { gateway, scope } = await aiGatewayTenantService.ensure(d);

    return await gateway.virtualModel.get({ ...scope, virtualModelId: d.virtualModelId });
  }

  async create(d: {
    instance: ScopedInstance;
    auditScope: AuditScope;
    input: AiGatewayInput<AiGateway['virtualModel']['create']>;
  }) {
    let { gateway, scope } = await aiGatewayTenantService.ensure(d);

    let virtualModel = await gateway.virtualModel.create({ ...d.input, ...scope });
    await this.fireCreated({ ...d, virtualModel });

    return virtualModel;
  }

  async createFromTemplate(d: {
    instance: ScopedInstance;
    auditScope: AuditScope;
    input: AiGatewayInput<AiGateway['virtualModel']['createFromTemplate']>;
  }) {
    let { gateway, scope } = await aiGatewayTenantService.ensure(d);

    let virtualModel = await gateway.virtualModel.createFromTemplate({ ...d.input, ...scope });
    await this.fireCreated({ ...d, virtualModel });

    return virtualModel;
  }

  async update(d: {
    instance: ScopedInstance;
    virtualModel: AiGatewayVirtualModel;
    auditScope: AuditScope;
    input: ForVirtualModel<AiGateway['virtualModel']['update']>;
  }) {
    let { gateway, scope } = await aiGatewayTenantService.ensure(d);

    let virtualModel = await gateway.virtualModel.update({
      ...d.input,
      ...scope,
      virtualModelId: d.virtualModel.id
    });
    await this.fireUpdated({ ...d, updated: virtualModel });

    return virtualModel;
  }

  async rollback(d: {
    instance: ScopedInstance;
    virtualModel: AiGatewayVirtualModel;
    auditScope: AuditScope;
    versionId: string;
  }) {
    let { gateway, scope } = await aiGatewayTenantService.ensure(d);

    let virtualModel = await gateway.virtualModel.rollback({
      ...scope,
      virtualModelId: d.virtualModel.id,
      versionId: d.versionId
    });
    await this.fireUpdated({ ...d, updated: virtualModel });

    return virtualModel;
  }

  async archive(d: {
    instance: ScopedInstance;
    virtualModel: AiGatewayVirtualModel;
    auditScope: AuditScope;
  }) {
    let { gateway, scope } = await aiGatewayTenantService.ensure(d);

    let virtualModel = await gateway.virtualModel.archive({
      ...scope,
      virtualModelId: d.virtualModel.id
    });

    await Fabric.fire('ai_gateway.virtual_model.archived:after', {
      auditScope: d.auditScope,
      instance: d.instance,
      virtualModel: toAuditVirtualModel(virtualModel)
    });

    return virtualModel;
  }

  listVersions(d: { instance: ScopedInstance; virtualModel: AiGatewayVirtualModel }) {
    return createGatewayPaginator(async page => {
      let { gateway, scope } = await aiGatewayTenantService.ensure(d);

      return await gateway.virtualModel.listVersions({
        ...scope,
        virtualModelId: d.virtualModel.id,
        ...page
      });
    });
  }

  async getVersion(d: {
    instance: ScopedInstance;
    virtualModel: AiGatewayVirtualModel;
    versionId: string;
  }) {
    let { gateway, scope } = await aiGatewayTenantService.ensure(d);

    return await gateway.virtualModel.getVersion({
      ...scope,
      virtualModelId: d.virtualModel.id,
      versionId: d.versionId
    });
  }

  async listTemplates(d: { instance: ScopedInstance }) {
    let { gateway, scope } = await aiGatewayTenantService.ensure(d);

    return (await gateway.virtualModel.listTemplates(scope)).items;
  }

  // Without a virtual model the input's definition is tested as an unsaved draft.
  async test(d: {
    instance: ScopedInstance;
    virtualModel?: AiGatewayVirtualModel;
    input: ForVirtualModel<AiGateway['virtualModel']['test']>;
  }) {
    let { gateway, scope } = await aiGatewayTenantService.ensure(d);

    return await gateway.virtualModel.test({
      ...d.input,
      ...scope,
      virtualModelId: d.virtualModel?.id
    });
  }

  async replay(d: {
    instance: ScopedInstance;
    virtualModel: AiGatewayVirtualModel;
    input: ForVirtualModel<AiGateway['virtualModel']['replay']>;
  }) {
    let { gateway, scope } = await aiGatewayTenantService.ensure(d);

    return await gateway.virtualModel.replay({
      ...d.input,
      ...scope,
      virtualModelId: d.virtualModel.id
    });
  }

  async insights(d: {
    instance: ScopedInstance;
    virtualModel: AiGatewayVirtualModel;
    input: ForVirtualModel<AiGateway['virtualModel']['insights']>;
  }) {
    let { gateway, scope } = await aiGatewayTenantService.ensure(d);

    return await gateway.virtualModel.insights({
      ...d.input,
      ...scope,
      virtualModelId: d.virtualModel.id
    });
  }

  private async fireCreated(d: {
    instance: ScopedInstance;
    auditScope: AuditScope;
    virtualModel: AiGatewayVirtualModel;
  }) {
    await Fabric.fire('ai_gateway.virtual_model.created:after', {
      auditScope: d.auditScope,
      instance: d.instance,
      virtualModel: toAuditVirtualModel(d.virtualModel)
    });
  }

  private async fireUpdated(d: {
    instance: ScopedInstance;
    auditScope: AuditScope;
    virtualModel: AiGatewayVirtualModel;
    updated: AiGatewayVirtualModel;
  }) {
    await Fabric.fire('ai_gateway.virtual_model.updated:after', {
      auditScope: d.auditScope,
      instance: d.instance,
      virtualModel: toAuditVirtualModel(d.updated),
      previousVirtualModel: toAuditVirtualModel(d.virtualModel)
    });
  }
}

export let aiGatewayVirtualModelService = Service.create(
  'aiGatewayVirtualModelService',
  () => new AiGatewayVirtualModelServiceImpl()
).build();
