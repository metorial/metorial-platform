import { describe, expect, it } from 'vitest';
import {
  validateFirewallAssignmentInput,
  validateFirewallAssignmentInputs
} from './firewallAssignmentValidation';

describe('validateFirewallAssignmentInput', () => {
  it('accepts enclave assignments with enclaveId only', () => {
    expect(() =>
      validateFirewallAssignmentInput({
        targetType: 'enclave',
        enclaveId: 'enc_test'
      })
    ).not.toThrow();
  });

  it('rejects enclave assignments with extra target ids', () => {
    expect(() =>
      validateFirewallAssignmentInput({
        targetType: 'enclave',
        enclaveId: 'enc_test',
        providerId: 'pro_test'
      })
    ).toThrow(/Enclave assignments must set enclaveId only/i);
  });

  it('rejects duplicate assignments in an array', () => {
    expect(() =>
      validateFirewallAssignmentInputs([
        {
          targetType: 'provider',
          providerId: 'pro_test'
        },
        {
          targetType: 'provider',
          providerId: 'pro_test'
        }
      ])
    ).toThrow(/Duplicate provider assignment/i);
  });

  it('accepts an internet gateway assignment without a target id', () => {
    expect(() =>
      validateFirewallAssignmentInput({ targetType: 'internet_gateway' })
    ).not.toThrow();
  });

  it('rejects an internet gateway assignment with a target id', () => {
    expect(() =>
      validateFirewallAssignmentInput({
        targetType: 'internet_gateway',
        enclaveId: 'enc_test'
      })
    ).toThrow(/must not set a target id/i);
  });

  it('rejects a second internet gateway assignment in an array', () => {
    expect(() =>
      validateFirewallAssignmentInputs([
        { targetType: 'internet_gateway' },
        { targetType: 'internet_gateway' }
      ])
    ).toThrow(/Duplicate internet gateway assignment/i);
  });
});
