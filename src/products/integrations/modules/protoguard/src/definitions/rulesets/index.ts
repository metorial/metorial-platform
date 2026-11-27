import { validateRuleset } from '../../lib/engine';
import { rulesetV1 } from './v1';

export let activeRuleset = rulesetV1;

validateRuleset(activeRuleset);

export let getRuleDefinition = (ruleKey: string) =>
  activeRuleset.rules.find(rule => rule.key == ruleKey) ?? null;

export let getFamilyDefinition = (family: string) =>
  activeRuleset.families.find(definition => definition.key == family) ?? null;
