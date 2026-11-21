import { ServiceError } from '@lowerdeck/error';
import {
  virtualModelDefinitionSchema,
  virtualModelLimits,
  virtualModelSignalNamePattern,
  type VirtualModelDefinition
} from '@mtsrc/ai-gateway-spec';
import { invalidVirtualModelError } from './errors';

export let invalidDefinition = (message: string) =>
  new ServiceError(invalidVirtualModelError({ message }));

export let parseDefinition = (input: unknown): VirtualModelDefinition => {
  let parsed = virtualModelDefinitionSchema.validate(input);
  if (!parsed.success) {
    let first = parsed.errors[0];
    throw invalidDefinition(
      first
        ? `${first.path?.join('.') || 'definition'}: ${first.message}`
        : 'Invalid definition.'
    );
  }

  let definition = parsed.value as VirtualModelDefinition;
  let signals = Object.entries(definition.signals ?? {});

  if (signals.length > virtualModelLimits.signals) {
    throw invalidDefinition(
      `A virtual model can define at most ${virtualModelLimits.signals} signals.`
    );
  }

  for (let [name, signal] of signals) {
    if (!virtualModelSignalNamePattern.test(name)) {
      throw invalidDefinition(
        `Signal "${name}" must start with a letter and contain only lowercase letters, digits and underscores.`
      );
    }

    if (signal.type == 'choice') {
      let options = Object.keys(signal.options);
      if (options.length < 2 || options.length > virtualModelLimits.choiceOptions) {
        throw invalidDefinition(
          `Signal "${name}" needs between 2 and ${virtualModelLimits.choiceOptions} options.`
        );
      }
    }
  }

  if (signals.length && !definition.decision) {
    throw invalidDefinition('Signals need a decision model. Add a "decision" block.');
  }

  let ruleIds = new Set<string>();
  for (let rule of definition.rules) {
    if (ruleIds.has(rule.id))
      throw invalidDefinition(`Rule id "${rule.id}" is used more than once.`);
    ruleIds.add(rule.id);
  }

  return definition;
};

export let definitionTargets = (definition: VirtualModelDefinition) => [
  ...new Set([
    ...definition.rules.flatMap(rule => rule.models.map(target => target.model)),
    ...definition.default.models.map(target => target.model)
  ])
];
