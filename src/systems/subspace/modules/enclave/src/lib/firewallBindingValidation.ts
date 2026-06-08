import { badRequestError, ServiceError } from '@lowerdeck/error';
import type { FirewallBindingTargetType } from '@metorial-subspace/db';

export type FirewallBindingInput = {
  targetType: FirewallBindingTargetType;
  enclaveId?: string;
  providerId?: string;
  networkId?: string;
};

let throwValidationError = (message: string) => {
  throw new ServiceError(
    badRequestError({
      code: 'invalid_firewall_bindings',
      message
    })
  );
};

export let validateFirewallBindingInputs = (bindings: FirewallBindingInput[]) => {
  let seenEnclaves = new Set<string>();
  let seenProviders = new Set<string>();
  let seenNetworks = new Set<string>();

  for (let binding of bindings) {
    validateFirewallBindingInput(binding);

    if (binding.targetType === 'enclave') {
      if (seenEnclaves.has(binding.enclaveId!)) {
        throwValidationError(`Duplicate enclave binding for "${binding.enclaveId}".`);
      }
      seenEnclaves.add(binding.enclaveId!);
    }

    if (binding.targetType === 'provider') {
      if (seenProviders.has(binding.providerId!)) {
        throwValidationError(`Duplicate provider binding for "${binding.providerId}".`);
      }
      seenProviders.add(binding.providerId!);
    }

    if (binding.targetType === 'network') {
      if (seenNetworks.has(binding.networkId!)) {
        throwValidationError(`Duplicate network binding for "${binding.networkId}".`);
      }
      seenNetworks.add(binding.networkId!);
    }
  }

  return bindings;
};

export let validateFirewallBindingInput = (binding: FirewallBindingInput) => {
  if (binding.targetType === 'enclave') {
    if (!binding.enclaveId || binding.providerId || binding.networkId) {
      throwValidationError('Enclave bindings must set enclaveId only.');
    }
    return;
  }

  if (binding.targetType === 'provider') {
    if (!binding.providerId || binding.enclaveId || binding.networkId) {
      throwValidationError('Provider bindings must set providerId only.');
    }
    return;
  }

  if (binding.targetType === 'network') {
    if (!binding.networkId || binding.enclaveId || binding.providerId) {
      throwValidationError('Network bindings must set networkId only.');
    }
    return;
  }

  throwValidationError(
    `Unknown firewall binding target type "${binding.targetType as string}".`
  );
};
