import { useForm } from '@metorial/data-hooks';
import { Stepper } from '@metorial/explainer';
import { Button, Input, Select, Spacer, Text, theme } from '@metorial/ui';
import React, { useState } from 'react';
import styled from 'styled-components';
import {
  parseAddresses,
  parseRulePorts,
  ruleValues,
  summarizeRule,
  toRuleInput,
  type NetworkRuleInput,
  type RuleValues
} from './ruleEditor';

let Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
`;

let Summary = styled.div`
  padding: 12px;
  border-radius: 8px;
  background: ${theme.colors.gray300};
  overflow-wrap: anywhere;
`;

export let RuleWizard = (p: {
  initialValues?: RuleValues;
  createPolicy?: boolean;
  editing?: boolean;
  locked?: boolean;
  loading: boolean;
  success: boolean;
  errors: React.ReactNode;
  submitLabel: string;
  onSubmit: (rule: NetworkRuleInput, name: string) => Promise<boolean>;
  close: () => void;
}) => {
  let [currentStep, setCurrentStep] = useState(0);
  let form = useForm({
    initialValues: { ...(p.initialValues ?? ruleValues()), name: '' },
    validate: values => {
      let errors: Record<string, string> = {};
      if (p.createPolicy && !values.name.trim()) errors.name = 'Name is required';
      if (!['allow', 'deny'].includes(values.effect)) errors.effect = 'Choose Allow or Block';
      if (!['ingress', 'egress'].includes(values.direction))
        errors.direction = 'Choose a traffic direction';

      try {
        if (values.addressMode === 'specific') parseAddresses(values.addresses);
      } catch (error) {
        errors.addresses = (error as Error).message;
      }

      try {
        if (values.direction === 'egress' && values.portMode === 'specific')
          parseRulePorts(values.ports);
      } catch (error) {
        errors.ports = (error as Error).message;
      }

      if (
        !values.priority.trim() ||
        !Number.isSafeInteger(Number(values.priority)) ||
        Number(values.priority) < 0
      )
        errors.priority = 'Priority must be a whole number, 0 or higher';

      return errors;
    },
    onSubmit: async values => {
      if (await p.onSubmit(toRuleInput(values), values.name.trim())) p.close();
    }
  });

  let goToStep = async (step: number) => {
    if (p.loading || p.locked) return;
    if (step === 0) {
      setCurrentStep(0);
      return;
    }

    let errors = await form.validateForm();
    await form.setTouched({ name: true, effect: true, direction: true }, false);
    if (!errors.name && !errors.effect && !errors.direction) setCurrentStep(1);
  };

  let summary = (() => {
    try {
      let rule = toRuleInput(form.values);
      return `${rule.effect === 'allow' ? 'Allow' : 'Block'} ${summarizeRule(rule).replace(/^./, letter => letter.toLowerCase())}`;
    } catch {
      return 'Choose addresses and ports to complete this rule.';
    }
  })();

  return (
    <Stepper
      currentStep={currentStep}
      setCurrentStep={step => void goToStep(step)}
      steps={[
        {
          title: 'Traffic',
          subtitle: 'Choose what this rule does',
          render: () => (
            <form
              onSubmit={event => {
                event.preventDefault();
                void goToStep(1);
              }}
            >
              {p.createPolicy && (
                <>
                  <Input label="Policy Name" {...form.getFieldProps('name')} />
                  <form.RenderError field="name" />
                  <Spacer size={16} />
                </>
              )}
              <Select
                label="Action"
                description="Allow matching connections or block them."
                value={form.values.effect}
                onChange={value => form.setFieldValue('effect', value)}
                items={[
                  { id: 'allow', label: 'Allow' },
                  { id: 'deny', label: 'Block' }
                ]}
              />
              <form.RenderError field="effect" />
              <Spacer size={16} />
              <Select
                label="Traffic"
                description="Outgoing connections leave your workload. Incoming connections reach it."
                value={form.values.direction}
                onChange={value => form.setFieldValue('direction', value)}
                items={[
                  { id: 'egress', label: 'Outgoing' },
                  { id: 'ingress', label: 'Incoming' }
                ]}
              />
              <form.RenderError field="direction" />
              <Actions>
                <Button type="button" size="2" variant="outline" onClick={p.close}>
                  Cancel
                </Button>
                <Button type="submit" size="2">
                  Continue
                </Button>
              </Actions>
            </form>
          )
        },
        {
          title: 'Connections',
          subtitle: 'Choose addresses and review',
          render: () => (
            <form onSubmit={form.handleSubmit}>
              {p.locked ? (
                <Text size="2">
                  The policy has been created. Retry attaching it to this firewall.
                </Text>
              ) : (
                <>
                  <Select
                    label={
                      form.values.direction === 'egress'
                        ? 'Destination Addresses'
                        : 'Source Addresses'
                    }
                    value={form.values.addressMode}
                    onChange={value => form.setFieldValue('addressMode', value)}
                    items={[
                      { id: 'specific', label: 'Specific Addresses' },
                      { id: 'any', label: 'Any Address' }
                    ]}
                  />
                  <Spacer size={12} />
                  {form.values.addressMode === 'specific' ? (
                    <>
                      <Input
                        label="IP Addresses or CIDRs"
                        placeholder="203.0.113.5, 10.0.0.0/8, 2001:db8::/32"
                        description="Separate addresses with commas. Individual IP addresses are supported."
                        {...form.getFieldProps('addresses')}
                      />
                      <form.RenderError field="addresses" />
                    </>
                  ) : (
                    <Select
                      label="Address Family"
                      value={form.values.addressFamily}
                      onChange={value => form.setFieldValue('addressFamily', value)}
                      items={[
                        { id: 'ipv4', label: 'IPv4' },
                        { id: 'ipv6', label: 'IPv6' },
                        { id: 'both', label: 'IPv4 and IPv6' }
                      ]}
                    />
                  )}
                  {form.values.direction === 'egress' && (
                    <>
                      <Spacer size={16} />
                      <Select
                        label="Ports"
                        value={form.values.portMode}
                        onChange={value => form.setFieldValue('portMode', value)}
                        items={[
                          { id: 'all', label: 'All Ports' },
                          { id: 'specific', label: 'Specific Ports' }
                        ]}
                      />
                      {form.values.portMode === 'specific' && (
                        <>
                          <Spacer size={12} />
                          <Input
                            label="Port Numbers or Ranges"
                            placeholder="443, 8000-9000"
                            {...form.getFieldProps('ports')}
                          />
                          <form.RenderError field="ports" />
                        </>
                      )}
                    </>
                  )}
                  {p.editing && (
                    <>
                      <Spacer size={16} />
                      <Input label="Description" {...form.getFieldProps('description')} />
                      <form.RenderError field="description" />
                    </>
                  )}
                </>
              )}
              <Spacer size={16} />
              <Summary aria-live="polite">
                <Text size="2" weight="strong">
                  {summary}
                </Text>
                {!form.values.enabled && (
                  <Text as="p" size="2" color="gray600">
                    Disabled
                  </Text>
                )}
              </Summary>
              {p.errors}
              <Actions>
                <Button
                  type="button"
                  size="2"
                  variant="outline"
                  disabled={p.loading}
                  onClick={p.close}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="2"
                  variant="outline"
                  disabled={p.loading || p.locked}
                  onClick={() => void goToStep(0)}
                >
                  Back
                </Button>
                <Button type="submit" size="2" loading={p.loading} success={p.success}>
                  {p.submitLabel}
                </Button>
              </Actions>
            </form>
          )
        }
      ]}
    />
  );
};
