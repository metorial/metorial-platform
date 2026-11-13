import { badRequestError, ServiceError } from '@lowerdeck/error';
import { billingModes, type BillingMode } from '@metorial/groundstation-spec';

let maxPlanLength = 100;

export type BillingDeclarationDefinition = {
  mode: BillingMode;
  plan: string | null;
  agentId: string | null;
  validFrom: Date;
  validTo: Date | null;
};

let invalid = (message: string) => new ServiceError(badRequestError({ message }));

export let normalizePlan = (plan: string | null | undefined) => plan?.trim() || null;

export let assertValidBillingDeclaration = (d: BillingDeclarationDefinition) => {
  if (!billingModes.includes(d.mode)) throw invalid(`${d.mode} is not a billing mode.`);
  if (d.mode == 'unknown') {
    throw invalid('A billing declaration must declare included, overage or api.');
  }

  if (d.plan !== null && d.plan.length > maxPlanLength) {
    throw invalid(`The plan must be at most ${maxPlanLength} characters.`);
  }

  if (d.agentId === '') throw invalid('agentId must not be empty.');

  if (d.validTo && d.validTo.getTime() <= d.validFrom.getTime()) {
    throw invalid('validTo must be after validFrom.');
  }
};
