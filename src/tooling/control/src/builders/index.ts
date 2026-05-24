import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { ControlError } from '../errors';
import type { ControlService, GeneratedBuildPlan, ServiceRegistry } from '../types';
import type { BuildBuilder } from './base';
import { goBuildBuilder } from './go';
import { nodeBuildBuilder } from './node';
import { rustBuildBuilder } from './rust';

export let BUILDERS: BuildBuilder[] = [nodeBuildBuilder, rustBuildBuilder, goBuildBuilder];

export let getBuilderForService = (service: ControlService): BuildBuilder | null => {
  let requested = service.config.build?.builder;
  if (!requested) return null;
  return BUILDERS.find(builder => builder.kind === requested) ?? null;
};

export let createBuildPlan = (
  service: ControlService,
  registry: ServiceRegistry
): GeneratedBuildPlan | null => {
  let builder = getBuilderForService(service);
  if (!builder) return null;

  let plan = builder.plan(service, registry);
  if (!plan) return null;
  builder.validate?.(plan);
  return plan;
};

export let renderDockerfileForPlan = (plan: GeneratedBuildPlan): string => {
  let builder = BUILDERS.find(candidate => candidate.kind === plan.builder);
  if (!builder) {
    throw new ControlError({
      code: 'unknown_build_builder',
      message: `No build builder registered for "${plan.builder}"`
    });
  }
  return builder.generateDockerfile(plan);
};

export let writeGeneratedDockerfile = (plan: GeneratedBuildPlan): { changed: boolean; content: string } => {
  let content = renderDockerfileForPlan(plan);
  mkdirSync(dirname(plan.dockerfilePath), { recursive: true });

  let current = '';
  try {
    current = readFileSync(plan.dockerfilePath, 'utf8');
  } catch {
    current = '';
  }

  if (current !== content) {
    writeFileSync(plan.dockerfilePath, content);
    return { changed: true, content };
  }

  return { changed: false, content };
};

export let collectBuildPlans = (registry: ServiceRegistry, serviceName?: string): GeneratedBuildPlan[] => {
  let services = serviceName
    ? registry.services.filter(service => service.name === serviceName)
    : registry.services;

  return services
    .map(service => createBuildPlan(service, registry))
    .filter((plan): plan is GeneratedBuildPlan => !!plan)
    .sort((a, b) => a.service.name.localeCompare(b.service.name));
};
