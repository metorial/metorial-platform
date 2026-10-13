import { badRequestError, ServiceError } from '@lowerdeck/error';
import type { IntegrationFirewallAssignmentTargetType } from '@metorial-subspace/db';

export type FirewallAssignmentInput = {
  targetType: IntegrationFirewallAssignmentTargetType;
  enclaveId?: string;
  providerId?: string;
};

let throwValidationError = (message: string) => {
  throw new ServiceError(
    badRequestError({
      code: 'invalid_firewall_assignments',
      message
    })
  );
};

export let validateFirewallAssignmentInputs = (assignments: FirewallAssignmentInput[]) => {
  let seenEnclaves = new Set<string>();
  let seenProviders = new Set<string>();
  let hasInternetGatewayAssignment = false;

  for (let assignment of assignments) {
    validateFirewallAssignmentInput(assignment);

    if (assignment.targetType === 'enclave') {
      if (seenEnclaves.has(assignment.enclaveId!)) {
        throwValidationError(`Duplicate enclave assignment for "${assignment.enclaveId}".`);
      }
      seenEnclaves.add(assignment.enclaveId!);
    }

    if (assignment.targetType === 'provider') {
      if (seenProviders.has(assignment.providerId!)) {
        throwValidationError(`Duplicate provider assignment for "${assignment.providerId}".`);
      }
      seenProviders.add(assignment.providerId!);
    }

    if (assignment.targetType === 'internet_gateway') {
      if (hasInternetGatewayAssignment) {
        throwValidationError('Duplicate internet gateway assignment.');
      }
      hasInternetGatewayAssignment = true;
    }
  }

  return assignments;
};

export let validateFirewallAssignmentInput = (assignment: FirewallAssignmentInput) => {
  if (assignment.targetType === 'enclave') {
    if (!assignment.enclaveId || assignment.providerId) {
      throwValidationError('Enclave assignments must set enclaveId only.');
    }
    return;
  }

  if (assignment.targetType === 'provider') {
    if (!assignment.providerId || assignment.enclaveId) {
      throwValidationError('Provider assignments must set providerId only.');
    }
    return;
  }

  if (assignment.targetType === 'internet_gateway') {
    if (assignment.enclaveId || assignment.providerId) {
      throwValidationError('Internet gateway assignments must not set a target id.');
    }
    return;
  }

  throwValidationError(
    `Unknown firewall assignment target type "${assignment.targetType as string}".`
  );
};
