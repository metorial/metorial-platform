import { describe, expect, it } from 'vitest';
import {
  validateFirewallBindingInput,
  validateFirewallBindingInputs
} from './firewallBindingValidation';

describe('validateFirewallBindingInput', () => {
  it('accepts enclave bindings with enclaveId only', () => {
    expect(() =>
      validateFirewallBindingInput({
        targetType: 'enclave',
        enclaveId: 'enc_test'
      })
    ).not.toThrow();
  });

  it('rejects enclave bindings with extra target ids', () => {
    expect(() =>
      validateFirewallBindingInput({
        targetType: 'enclave',
        enclaveId: 'enc_test',
        providerId: 'pro_test'
      })
    ).toThrow(/Enclave bindings must set enclaveId only/i);
  });

  it('rejects duplicate bindings in an array', () => {
    expect(() =>
      validateFirewallBindingInputs([
        {
          targetType: 'provider',
          providerId: 'pro_test'
        },
        {
          targetType: 'provider',
          providerId: 'pro_test'
        }
      ])
    ).toThrow(/Duplicate provider binding/i);
  });
});
