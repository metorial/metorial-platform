import { renderWithLoader, useForm } from '@metorial/data-hooks';
import { DetailsOverviewLayout } from '@metorial/details-layout';
import {
  useAttachNetworkPolicyToFirewall,
  useCreateNetworkPolicy,
  useCurrentInstance,
  useDetachNetworkPolicyFromFirewall,
  useFirewall,
  useNetworkPolicy
} from '@metorial/state';
import {
  Badge,
  Button,
  Dialog,
  Input,
  Menu,
  Spacer,
  Text,
  Title,
  showModal
} from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { RiArrowDownSLine, RiArrowUpSLine, RiMore2Line } from '@remixicon/react';
import { useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import styled from 'styled-components';
import { EmptyText } from '../_common';
import { useNetworkManagementAccess } from '../_gate';
import {
  movePolicyRule,
  nextRulePriority,
  policyRuleInput,
  ruleValues,
  sortRules,
  summarizeRule,
  type NetworkRuleInput
} from './ruleEditor';
import { RuleWizard } from './ruleWizard';

type PolicyRule = Omit<NetworkRuleInput, 'description' | 'ports'> & {
  id: string;
  description: string | null;
  ports: { from: number; to: number }[] | null;
};

let PolicyList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 17px;
`;

let PolicySection = styled.section`
  min-width: 0;
`;

let PolicyHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 0px;
`;

let Actions = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
`;

let RuleRow = styled.div`
  display: flex;
  align-items: start;
  gap: 12px;
  padding: 6px 0;
`;

let RuleContent = styled.div`
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
`;

let showCreatePolicyModal = (p: {
  instanceId: string;
  firewallId: string;
  onComplete: () => void;
}) =>
  showModal(({ dialogProps, close }) => {
    let createPolicy = useCreateNetworkPolicy();
    let attachPolicy = useAttachNetworkPolicyToFirewall();
    let createdPolicyId = useRef<string | null>(null);
    let [created, setCreated] = useState(false);

    return (
      <Dialog.Wrapper {...dialogProps} width={640}>
        <Dialog.Title>Add Network Policy</Dialog.Title>
        <Dialog.Description>Name your policy and configure its first rule.</Dialog.Description>
        <RuleWizard
          createPolicy
          locked={created}
          loading={createPolicy.isLoading || attachPolicy.isLoading}
          success={attachPolicy.isSuccess}
          submitLabel={created ? 'Retry Attachment' : 'Add Policy'}
          close={close}
          errors={
            <>
              <createPolicy.RenderError />
              <attachPolicy.RenderError />
            </>
          }
          onSubmit={async (rule, name) => {
            if (!createdPolicyId.current) {
              let [policy] = await createPolicy.mutate({
                instanceId: p.instanceId,
                name,
                rules: [rule]
              });
              if (!policy) return false;

              createdPolicyId.current = policy.id;
              setCreated(true);
            }

            let [attached] = await attachPolicy.mutate({
              instanceId: p.instanceId,
              firewallId: p.firewallId,
              networkPolicyId: createdPolicyId.current
            });
            if (!attached) return false;

            p.onComplete();
            return true;
          }}
        />
      </Dialog.Wrapper>
    );
  });

let showRuleModal = (p: {
  instanceId: string;
  policyId: string;
  rule?: PolicyRule;
  priority: number;
  onComplete: () => void;
}) =>
  showModal(({ dialogProps, close }) => {
    let policy = useNetworkPolicy(p.instanceId, p.policyId);
    let createRule = policy.useCreateRuleMutator();
    let updateRule = policy.useUpdateRuleMutator();
    let mutator = p.rule ? updateRule : createRule;

    return (
      <Dialog.Wrapper {...dialogProps} width={640}>
        <Dialog.Title>{p.rule ? 'Edit Network Rule' : 'Add Network Rule'}</Dialog.Title>
        <Dialog.Description>
          Choose the traffic and connections this rule matches.
        </Dialog.Description>
        <RuleWizard
          editing={!!p.rule}
          initialValues={ruleValues(p.rule, p.priority)}
          loading={mutator.isLoading}
          success={mutator.isSuccess}
          submitLabel={p.rule ? 'Save Changes' : 'Add Rule'}
          close={close}
          errors={<mutator.RenderError />}
          onSubmit={async rule => {
            if (!policy.data) return false;

            let [result] = p.rule
              ? await updateRule.mutate({
                  ruleId: p.rule.id,
                  rule,
                  currentRules: policy.data.rules
                })
              : await createRule.mutate(rule);
            if (!result) return false;

            p.onComplete();
            return true;
          }}
        />
      </Dialog.Wrapper>
    );
  });

let showEditPolicyModal = (p: {
  instanceId: string;
  policyId: string;
  onComplete: () => void;
}) =>
  showModal(({ dialogProps, close }) => {
    let policy = useNetworkPolicy(p.instanceId, p.policyId);
    let update = policy.useUpdateMutator();
    let form = useForm({
      initialValues: {
        name: policy.data?.name ?? '',
        description: policy.data?.description ?? ''
      },
      schema: yup =>
        yup.object({
          name: yup.string().trim().required('Name is required'),
          description: yup.string()
        }),
      onSubmit: async values => {
        let [result] = await update.mutate({
          name: values.name.trim(),
          description: values.description || undefined
        });
        if (!result) return;

        p.onComplete();
        close();
      }
    });

    return (
      <Dialog.Wrapper {...dialogProps} width={640}>
        <Dialog.Title>Edit Network Policy</Dialog.Title>
        <Dialog.Description>Update the policy name and description.</Dialog.Description>
        <form onSubmit={form.handleSubmit}>
          <Input label="Name" {...form.getFieldProps('name')} />
          <form.RenderError field="name" />
          <Spacer size={12} />
          <Input label="Description" {...form.getFieldProps('description')} />
          <form.RenderError field="description" />
          <Spacer size={16} />
          <Dialog.Actions>
            <Button
              type="button"
              variant="outline"
              size="2"
              disabled={update.isLoading}
              onClick={close}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="2"
              loading={update.isLoading}
              success={update.isSuccess}
            >
              Save Changes
            </Button>
          </Dialog.Actions>
          <update.RenderError />
        </form>
      </Dialog.Wrapper>
    );
  });

let PolicyGroup = (p: {
  instanceId: string;
  firewallId: string;
  policyId: string;
  onComplete: () => void;
  canWrite: boolean;
}) => {
  let policy = useNetworkPolicy(p.instanceId, p.policyId);
  let deleteRule = policy.useDeleteRuleMutator();
  let detachPolicy = useDetachNetworkPolicyFromFirewall();
  let reorder = policy.useUpdateMutator();
  let [movingRule, setMovingRule] = useState<string | null>(null);
  let reordering = useRef(false);
  let busy =
    deleteRule.isLoading || detachPolicy.isLoading || reorder.isLoading || !!movingRule;

  return renderWithLoader({ policy })(({ policy }) => {
    let addRule = () =>
      showRuleModal({
        instanceId: p.instanceId,
        policyId: p.policyId,
        priority: nextRulePriority(policy.data.rules),
        onComplete: p.onComplete
      });

    let orderedRules = sortRules(policy.data.rules);
    let moveRule = async (ruleId: string, offset: -1 | 1) => {
      if (busy || reordering.current) return;
      reordering.current = true;
      setMovingRule(ruleId);

      try {
        let [, error] = await reorder.mutate({
          rules: movePolicyRule(policy.data.rules, ruleId, offset).map(policyRuleInput)
        });
        if (!error) p.onComplete();
      } finally {
        reordering.current = false;
        setMovingRule(null);
      }
    };

    return (
      <PolicySection>
        <PolicyHeader>
          <div>
            <Title as="h3" size="2" weight="strong">
              {policy.data.name}
            </Title>
            {policy.data.description && (
              <Text as="p" size="2" color="gray600">
                {policy.data.description}
              </Text>
            )}
          </div>
          {p.canWrite && (
            <Actions>
              <Button size="1" variant="outline" disabled={busy} onClick={addRule}>
                Add Rule
              </Button>
              <Menu
                items={[
                  { id: 'edit', label: 'Edit Policy' },
                  { id: 'detach', label: 'Remove From Firewall' }
                ]}
                onItemClick={async item => {
                  if (busy) return;
                  if (item === 'edit')
                    showEditPolicyModal({
                      instanceId: p.instanceId,
                      policyId: p.policyId,
                      onComplete: p.onComplete
                    });
                  if (item === 'detach') {
                    let [, error] = await detachPolicy.mutate({
                      instanceId: p.instanceId,
                      firewallId: p.firewallId,
                      networkPolicyId: p.policyId
                    });
                    if (!error) p.onComplete();
                  }
                }}
              >
                <Button
                  size="1"
                  variant="outline"
                  disabled={busy}
                  loading={detachPolicy.isLoading}
                  success={detachPolicy.isSuccess}
                  iconLeft={<RiMore2Line />}
                  title={`Actions for ${policy.data.name}`}
                />
              </Menu>
            </Actions>
          )}
        </PolicyHeader>
        {orderedRules.length > 1 && (
          <Text as="p" size="1" color="gray600">
            Rules in this policy are evaluated from top to bottom.
          </Text>
        )}
        {orderedRules.map((rule, index) => (
          <RuleRow key={rule.id}>
            <Badge color={rule.effect === 'allow' ? 'green' : 'red'}>
              {rule.effect === 'allow' ? 'Allow' : 'Block'}
            </Badge>
            <RuleContent>
              <Text size="2">
                {summarizeRule({ ...rule, ports: rule.ports ?? undefined })}
              </Text>
              {!rule.enabled && (
                <Text as="p" size="2" color="gray600">
                  Disabled
                </Text>
              )}
              {rule.description && (
                <Text as="p" size="2" color="gray600">
                  {rule.description}
                </Text>
              )}
            </RuleContent>
            {p.canWrite && (
              <Actions>
                {orderedRules.length > 1 && (
                  <>
                    <Button
                      size="1"
                      variant="outline"
                      title="Move Rule Up"
                      aria-label="Move Rule Up"
                      disabled={busy || index === 0}
                      onClick={() => void moveRule(rule.id, -1)}
                      iconLeft={<RiArrowUpSLine />}
                    />
                    <Button
                      size="1"
                      variant="outline"
                      title="Move Rule Down"
                      aria-label="Move Rule Down"
                      disabled={busy || index === orderedRules.length - 1}
                      onClick={() => void moveRule(rule.id, 1)}
                      iconLeft={<RiArrowDownSLine />}
                    />
                  </>
                )}
                <Menu
                  items={[
                    { id: 'edit', label: 'Edit Rule' },
                    { id: 'remove', label: 'Remove Rule' }
                  ]}
                  onItemClick={async item => {
                    if (busy) return;
                    if (item === 'edit')
                      showRuleModal({
                        instanceId: p.instanceId,
                        policyId: p.policyId,
                        rule,
                        priority: rule.priority,
                        onComplete: p.onComplete
                      });
                    if (item === 'remove') {
                      let [, error] = await deleteRule.mutate({ ruleId: rule.id });
                      if (!error) p.onComplete();
                    }
                  }}
                >
                  <Button
                    size="1"
                    variant="outline"
                    disabled={busy}
                    iconLeft={<RiMore2Line />}
                    title="Rule Actions"
                  />
                </Menu>
              </Actions>
            )}
          </RuleRow>
        ))}
        {!policy.data.rules.length && (
          <Text as="p" size="2" color="gray600">
            No rules yet. {p.canWrite ? 'Use Add Rule to configure this policy.' : ''}
          </Text>
        )}
        <reorder.RenderError />
        <deleteRule.RenderError />
        <detachPolicy.RenderError />
      </PolicySection>
    );
  });
};

export let NetworkFirewallPage = () => {
  let instance = useCurrentInstance();
  let { firewallId } = useParams();
  let firewall = useFirewall(instance.data?.id, firewallId);
  let { canWrite } = useNetworkManagementAccess();

  return renderWithLoader({ firewall })(({ firewall }) => (
    <DetailsOverviewLayout>
      <Box
        title="Network Policies"
        description="Choose which incoming and outgoing connections this firewall allows or blocks."
        rightActions={
          canWrite ? (
            <Button
              size="2"
              onClick={() =>
                showCreatePolicyModal({
                  instanceId: instance.data!.id,
                  firewallId: firewall.data.id,
                  onComplete: () => firewall.refetch()
                })
              }
            >
              Add Policy
            </Button>
          ) : undefined
        }
      >
        {firewall.data.networkPolicies.length ? (
          <PolicyList>
            {firewall.data.networkPolicies.map(policy => (
              <PolicyGroup
                key={policy.id}
                instanceId={instance.data!.id}
                firewallId={firewall.data.id}
                policyId={policy.id}
                canWrite={canWrite}
                onComplete={() => firewall.refetch()}
              />
            ))}
          </PolicyList>
        ) : (
          <EmptyText>No policies attached to this firewall.</EmptyText>
        )}
      </Box>
    </DetailsOverviewLayout>
  ));
};
