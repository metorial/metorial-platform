import { renderWithLoader, useForm, useMutation } from '@metorial-io/data-hooks';
import { Button, Dialog, Input, Select, showModal, Spacer, Title } from '@metorial-io/ui';
import { Table } from '@metorial-io/ui-product';
import { Link, useParams } from 'react-router-dom';
import { accessGroupState } from '../../../../../state';
import { adminClient } from '../../../../../state/client';

let RULE_TYPES = [
  { value: 'email', label: 'Email' },
  { value: 'email_domain', label: 'Email Domain' },
  { value: 'sso_tenant', label: 'SSO Tenant' },
  { value: 'sso_group', label: 'SSO Group' },
  { value: 'sso_role', label: 'SSO Role' }
];

let ruleTypeLabel = (type: string) => RULE_TYPES.find(t => t.value === type)?.label ?? type;

export let AccessGroupPage = () => {
  let { appId, accessGroupId } = useParams();
  let accessGroup = accessGroupState.use({ id: accessGroupId! });
  let accessGroupRoot = accessGroup;

  return renderWithLoader({ accessGroup })(({ accessGroup }) => (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <Title weight="strong" as="h1" size="7">
          {accessGroup.data.name}
        </Title>

        <Link to={`/apps/${appId}/access-groups`}>
          <Button as="span" size="1" variant="outline">
            Back to Access Groups
          </Button>
        </Link>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginTop: 20,
          marginBottom: 10
        }}
      >
        <Title weight="strong" as="h2" size="4">
          Rules
        </Title>

        <Button
          size="1"
          onClick={() =>
            showModal(({ dialogProps, close }) => {
              let update = useMutation(adminClient.accessGroup.update);

              let form = useForm({
                initialValues: {
                  type: 'email' as string,
                  value: ''
                },
                onSubmit: async values => {
                  let existingRules = (accessGroup.data.rules ?? []).map((r: any) => ({
                    type: r.type,
                    value: r.value
                  }));

                  let [res] = await update.mutate({
                    id: accessGroupId!,
                    rules: [...existingRules, { type: values.type, value: values.value }]
                  });
                  if (res) {
                    close();
                    accessGroupRoot.refetch();
                  }
                },
                schema: yup =>
                  yup.object({
                    type: yup.string().required('Type is required'),
                    value: yup.string().required('Value is required')
                  }) as any
              });

              return (
                <Dialog.Wrapper {...dialogProps}>
                  <Dialog.Title>Add Rule</Dialog.Title>

                  <form onSubmit={form.handleSubmit}>
                    <Select
                      label="Type"
                      value={form.values.type}
                      onChange={val => form.setFieldValue('type', val)}
                      items={RULE_TYPES.map(rt => ({ id: rt.value, label: rt.label }))}
                    />

                    <Input label="Value" {...form.getFieldProps('value')} />
                    <form.RenderError field="value" />

                    <Spacer size={15} />

                    <Button
                      type="submit"
                      loading={update.isLoading}
                      success={update.isSuccess}
                    >
                      Add Rule
                    </Button>
                    <update.RenderError />
                  </form>
                </Dialog.Wrapper>
              );
            })
          }
        >
          Add Rule
        </Button>
      </div>

      <Table
        headers={['Type', 'Value', '']}
        data={(accessGroup.data.rules ?? []).map((rule: any) => [
          ruleTypeLabel(rule.type),
          rule.value,
          <RuleActions
            rule={rule}
            accessGroupId={accessGroupId!}
            allRules={accessGroup.data.rules}
            onUpdate={() => accessGroupRoot.refetch()}
          />
        ])}
      />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginTop: 30,
          marginBottom: 10
        }}
      >
        <Title weight="strong" as="h2" size="4">
          Assignments
        </Title>

        <Button
          size="1"
          onClick={() =>
            showModal(({ dialogProps, close }) => {
              let assignApp = useMutation(adminClient.accessGroup.assignToApp);

              let existingAssignments = accessGroup.data.assignments ?? [];
              let isAppAssigned = existingAssignments.some(
                (a: any) => a.target?.type === 'app' && a.target.id === accessGroup.data.id
              );

              let assignedSurfaceIds = new Set(
                existingAssignments
                  .filter((a: any) => a.target?.type === 'surface')
                  .map((a: any) => a.target.id)
              );

              let targets = [
                ...(!isAppAssigned
                  ? [{ value: `app:${appId}`, label: 'App (entire app)' }]
                  : [])
              ];

              let form = useForm({
                initialValues: { target: targets[0]?.value ?? '' },
                onSubmit: async values => {
                  let [type, id] = values.target.split(':') as [string, string];
                  let res: any;
                  if (type === 'app') {
                    [res] = await assignApp.mutate({
                      accessGroupId: accessGroupId!,
                      appId: id
                    });
                  }
                  if (res) {
                    close();
                    accessGroupRoot.refetch();
                  }
                },
                schema: yup =>
                  yup.object({
                    target: yup.string().required('Select a target')
                  }) as any
              });

              let isLoading = assignApp.isLoading;
              let isSuccess = assignApp.isSuccess;

              return (
                <Dialog.Wrapper {...dialogProps}>
                  <Dialog.Title>Assign to App or Surface</Dialog.Title>

                  {targets.length === 0 ? (
                    <p style={{ color: '#888' }}>Already assigned to all available targets.</p>
                  ) : (
                    <form onSubmit={form.handleSubmit}>
                      <Select
                        label="Target"
                        value={form.values.target}
                        onChange={val => form.setFieldValue('target', val)}
                        items={targets.map(t => ({ id: t.value, label: t.label }))}
                      />

                      <Button type="submit" loading={isLoading} success={isSuccess}>
                        Assign
                      </Button>
                      <assignApp.RenderError />
                    </form>
                  )}
                </Dialog.Wrapper>
              );
            })
          }
        >
          Assign
        </Button>
      </div>

      <p style={{ fontSize: 13, color: '#888', marginBottom: 10 }}>
        Assign this access group to the app or specific surfaces to restrict access.
      </p>

      <Table
        headers={['Target', 'Type', '']}
        data={(accessGroup.data.assignments ?? []).map((assignment: any) => {
          let target = assignment.target;
          let targetLabel = target
            ? target.type === 'app'
              ? target.clientId
              : target.clientId
            : 'Unknown';
          let targetType = target?.type === 'app' ? 'App' : 'Surface';

          return [
            targetLabel,
            targetType,
            <AssignmentActions
              assignment={assignment}
              onUpdate={() => accessGroupRoot.refetch()}
            />
          ];
        })}
      />
    </>
  ));
};

let AssignmentActions = ({
  assignment,
  onUpdate
}: {
  assignment: any;
  onUpdate: () => void;
}) => {
  let unassign = useMutation(adminClient.accessGroup.unassign);

  return (
    <Button
      size="1"
      variant="outline"
      loading={unassign.isLoading}
      onClick={async () => {
        if (!confirm('Remove this assignment?')) return;
        await unassign.mutate({ assignmentId: assignment.id });
        onUpdate();
      }}
    >
      Remove
    </Button>
  );
};

let RuleActions = ({
  rule,
  accessGroupId,
  allRules,
  onUpdate
}: {
  rule: any;
  accessGroupId: string;
  allRules: any[];
  onUpdate: () => void;
}) => {
  let update = useMutation(adminClient.accessGroup.update);

  return (
    <Button
      size="1"
      variant="outline"
      loading={update.isLoading}
      onClick={async () => {
        if (!confirm('Delete this rule?')) return;
        let remainingRules = allRules
          .filter((r: any) => r.id !== rule.id)
          .map((r: any) => ({ type: r.type, value: r.value }));
        await update.mutate({
          id: accessGroupId,
          rules: remainingRules
        });
        onUpdate();
      }}
    >
      Delete
    </Button>
  );
};
