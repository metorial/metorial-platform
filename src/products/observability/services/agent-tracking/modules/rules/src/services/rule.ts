import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type {
  AttributionRule,
  AttributionRuleEffect,
  Entity,
  Organization,
  Prisma
} from '@mtsrc/agent-tracking-db';
import { toAttributionEntity } from '@mtsrc/agent-tracking-module-attribution';
import { db } from '@mtsrc/agent-tracking-db';
import { reachSince, type LinkReach } from '@mtsrc/agent-tracking-module-entities';
import { getId } from '@mtsrc/agent-tracking-db';
import { draftRuleId, testRuleDraft } from '../lib/test';
import type { AttributionRuleMatch } from '@mtsrc/agent-tracking-rule-match';
import { Events } from '@mtsrc/agent-tracking-events';

let senderKinds = ['user', 'device'];

export let ruleInclude = {
  targetEntity: true,
  scopeProject: true,
  scopeInstance: true
} satisfies Prisma.AttributionRuleInclude;

export type RuleWithRelations = Prisma.AttributionRuleGetPayload<{
  include: typeof ruleInclude;
}>;

export type RuleScopeInput = { projectId?: string; instanceId?: string } | null;

type ResolvedScope = { scopeProjectOid: bigint | null; scopeInstanceOid: bigint | null };

class RuleServiceImpl {
  async createRule(d: {
    organization: Organization;
    target: Entity;
    input: {
      name: string;
      effect?: AttributionRuleEffect;
      priority?: number;
      enabled?: boolean;
      scope?: RuleScopeInput;
      match: AttributionRuleMatch;
    };
    reach: LinkReach;
  }) {
    this.assertTargetAllowed(d.target);

    let scope = await this.resolveScope({
      organization: d.organization,
      scope: d.input.scope
    });

    let validFrom = reachSince(d.reach);

    let rule = await db.attributionRule.create({
      data: {
        ...getId('attributionRule'),
        name: d.input.name,
        effect: d.input.effect ?? 'assign',
        priority: d.input.priority ?? 0,
        enabled: d.input.enabled ?? true,
        match: d.input.match,
        validFrom,
        organizationOid: d.organization.oid,
        targetEntityOid: d.target.oid,
        scopeProjectOid: scope.scopeProjectOid,
        scopeInstanceOid: scope.scopeInstanceOid
      },
      include: ruleInclude
    });

    if (rule.enabled) {
      await this.reattribute({
        organization: d.organization,
        rules: [rule],
        since: validFrom
      });
    }

    return rule;
  }

  async updateRule(d: {
    organization: Organization;
    rule: RuleWithRelations;
    target?: Entity;
    input: {
      name?: string;
      effect?: AttributionRuleEffect;
      priority?: number;
      enabled?: boolean;
      scope?: RuleScopeInput;
      match?: AttributionRuleMatch;
    };
    reach: LinkReach;
  }) {
    this.assertRuleActive(d.rule);
    if (d.target) this.assertTargetAllowed(d.target);

    let scope =
      d.input.scope === undefined
        ? null
        : await this.resolveScope({ organization: d.organization, scope: d.input.scope });

    let next = {
      effect: d.input.effect ?? d.rule.effect,
      priority: d.input.priority ?? d.rule.priority,
      enabled: d.input.enabled ?? d.rule.enabled,
      targetEntityOid: d.target?.oid ?? d.rule.targetEntityOid,
      scopeProjectOid: scope ? scope.scopeProjectOid : d.rule.scopeProjectOid,
      scopeInstanceOid: scope ? scope.scopeInstanceOid : d.rule.scopeInstanceOid,
      match: d.input.match ?? d.rule.match
    };

    let affectsAttribution =
      next.effect != d.rule.effect ||
      next.priority != d.rule.priority ||
      next.enabled != d.rule.enabled ||
      next.targetEntityOid != d.rule.targetEntityOid ||
      next.scopeProjectOid != d.rule.scopeProjectOid ||
      next.scopeInstanceOid != d.rule.scopeInstanceOid ||
      JSON.stringify(next.match) != JSON.stringify(d.rule.match);

    // An edited rule only governs sessions from its new validFrom on (07 §6.2), so renames
    // and other cosmetic edits keep the original one.
    let validFrom = affectsAttribution ? reachSince(d.reach) : undefined;

    let rule = await db.attributionRule.update({
      where: { oid: d.rule.oid },
      data: {
        name: d.input.name,
        effect: d.input.effect,
        priority: d.input.priority,
        enabled: d.input.enabled,
        match: d.input.match,
        targetEntityOid: d.target?.oid,
        validFrom,
        ...scope
      },
      include: ruleInclude
    });

    if (validFrom && (rule.enabled || d.rule.enabled)) {
      await this.reattribute({
        organization: d.organization,
        rules: [d.rule, rule],
        since: validFrom
      });
    }

    return rule;
  }

  async deleteRule(d: {
    organization: Organization;
    rule: RuleWithRelations;
    reach: LinkReach;
  }) {
    if (d.rule.archivedAt) return d.rule;

    let rule = await db.attributionRule.update({
      where: { oid: d.rule.oid },
      data: { archivedAt: new Date(), enabled: false },
      include: ruleInclude
    });

    if (d.rule.enabled) {
      await this.reattribute({
        organization: d.organization,
        rules: [d.rule],
        since: reachSince(d.reach)
      });
    }

    return rule;
  }

  async getRuleById(d: { organization: Organization; ruleId: string }) {
    let rule = await db.attributionRule.findFirst({
      where: { id: d.ruleId, organizationOid: d.organization.oid, archivedAt: null },
      include: ruleInclude
    });
    if (!rule) throw new ServiceError(notFoundError('attribution_rule', d.ruleId));

    return rule;
  }

  async listRules(d: {
    organization: Organization;
    targetEntityIds?: string[];
    enabled?: boolean;
  }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.attributionRule.findMany({
            ...opts,
            where: {
              organizationOid: d.organization.oid,
              archivedAt: null,
              enabled: d.enabled,
              targetEntity: d.targetEntityIds ? { id: { in: d.targetEntityIds } } : undefined
            },
            include: ruleInclude
          })
      )
    );
  }

  async testRule(d: {
    organization: Organization;
    target: Entity;
    rule?: RuleWithRelations;
    input: {
      effect?: AttributionRuleEffect;
      priority?: number;
      scope?: RuleScopeInput;
      match: AttributionRuleMatch;
    };
  }) {
    this.assertTargetAllowed(d.target);

    let scope =
      d.input.scope === undefined && d.rule
        ? { project: d.rule.scopeProject, instance: d.rule.scopeInstance }
        : await this.resolveScopeRecords({
            organization: d.organization,
            scope: d.input.scope
          });

    let target = await db.entity.findUniqueOrThrow({
      where: { oid: d.target.oid },
      include: { scopeProject: true, scopeInstance: true }
    });

    return await testRuleDraft({
      organizationId: d.organization.id,
      replacesRuleId: d.rule?.id,
      target: toAttributionEntity(target),
      draft: {
        id: d.rule?.id ?? draftRuleId,
        effect: d.input.effect ?? d.rule?.effect ?? 'assign',
        priority: d.input.priority ?? d.rule?.priority ?? 0,
        targetId: d.target.id,
        scopeProjectId: scope.project?.id ?? null,
        scopeInstanceId: scope.instance?.id ?? null,
        match: d.input.match
      }
    });
  }

  private async reattribute(d: {
    organization: Organization;
    rules: RuleWithRelations[];
    since: Date;
  }) {
    let scopes = d.rules.map(rule => ({
      projectId: rule.scopeProject?.id,
      instanceId: rule.scopeInstance?.id
    }));
    let shared = scopes.every(
      scope =>
        scope.projectId == scopes[0]!.projectId && scope.instanceId == scopes[0]!.instanceId
    );

    await Events.fire('rules.rule.changed:after', {
      organizationId: d.organization.id,
      since: d.since,
      ruleIds: [...new Set(d.rules.map(rule => rule.id))],
      scope: shared ? scopes[0] : undefined
    });
  }

  private async resolveScopeRecords(d: {
    organization: Organization;
    scope: RuleScopeInput | undefined;
  }) {
    if (!d.scope) return { project: null, instance: null };

    let project = d.scope.projectId
      ? await db.project.findFirst({
          where: {
            OR: [{ id: d.scope.projectId }, { ref: d.scope.projectId }],
            organizationOid: d.organization.oid
          }
        })
      : null;
    if (d.scope.projectId && !project) {
      throw new ServiceError(notFoundError('project', d.scope.projectId));
    }

    let instance = d.scope.instanceId
      ? await db.instance.findFirst({
          where: {
            OR: [{ id: d.scope.instanceId }, { ref: d.scope.instanceId }],
            organizationOid: d.organization.oid
          },
          include: { project: true }
        })
      : null;
    if (d.scope.instanceId && !instance) {
      throw new ServiceError(notFoundError('instance', d.scope.instanceId));
    }

    if (project && instance && instance.projectOid != project.oid) {
      throw new ServiceError(
        badRequestError({
          message: 'The scope instance does not belong to the scope project.'
        })
      );
    }

    return { project: project ?? instance?.project ?? null, instance };
  }

  private async resolveScope(d: {
    organization: Organization;
    scope: RuleScopeInput | undefined;
  }): Promise<ResolvedScope> {
    let records = await this.resolveScopeRecords(d);

    return {
      scopeProjectOid: records.project?.oid ?? null,
      scopeInstanceOid: records.instance?.oid ?? null
    };
  }

  private assertTargetAllowed(target: Entity) {
    if (senderKinds.includes(target.kind)) {
      throw new ServiceError(
        badRequestError({
          message: `Rules cannot assign a ${target.kind}; it comes from the sender.`
        })
      );
    }

    if (target.status != 'managed' && target.status != 'discovered') {
      throw new ServiceError(
        badRequestError({ message: `The entity ${target.id} is ${target.status}.` })
      );
    }
  }

  private assertRuleActive(rule: AttributionRule) {
    if (rule.archivedAt) {
      throw new ServiceError(notFoundError('attribution_rule', rule.id));
    }
  }
}

export let ruleService = Service.create('ruleService', () => new RuleServiceImpl()).build();
