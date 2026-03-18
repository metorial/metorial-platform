import { DashboardInstanceIdentitiesDelegationRequestsCreateOutput } from '@metorial/dashboard-sdk';
import { useForm } from '@metorial/data-hooks';
import {
  useCreateIdentityDelegationRequest,
  useCurrentInstance,
  useIdentityActors
} from '@metorial/state';
import {
  Button,
  CheckList,
  Combobox,
  DatePicker,
  Dialog,
  Input,
  Spacer,
  Text
} from '@metorial/ui';

let permissionOptions = [
  {
    id: 'provider:read',
    label: 'Provider Read',
    description: 'Allow the delegatee to read provider data.'
  },
  {
    id: 'provider:call',
    label: 'Provider Call',
    description: 'Allow the delegatee to call providers.'
  }
] as const;

let getPermissionItems = (permissions: string[]) => {
  return permissionOptions.map(option => ({
    id: option.id,
    isChecked: permissions.includes(option.id),
    label: (
      <div>
        <Text size="2" weight="strong">
          {option.label}
        </Text>
        <Text size="1" color="gray600">
          {option.description}
        </Text>
      </div>
    )
  }));
};

export let IdentityDelegationRequestForm = ({
  instanceId: instanceIdProp,
  identityId,
  close,
  onCreate
}: {
  instanceId?: string;
  identityId: string;
  close?: () => void;
  onCreate?: (request: DashboardInstanceIdentitiesDelegationRequestsCreateOutput) => void;
}) => {
  let instance = useCurrentInstance();
  let instanceId = instanceIdProp ?? instance.data?.id;
  let createMutation = useCreateIdentityDelegationRequest();

  let form = useForm({
    initialValues: {
      requesterActorId: '',
      requesterActorName: '',
      permissions: ['provider:read'] as string[],
      note: '',
      expiresAt: null as Date | null
    },
    onSubmit: async values => {
      if (!instanceId || !values.expiresAt) return;

      let [result] = await createMutation.mutate({
        instanceId,
        identityId,
        requesterActorId: values.requesterActorId,
        permissions: values.permissions as ('provider:read' | 'provider:call')[],
        note: values.note.trim() || undefined,
        expiresAt: values.expiresAt
      });

      if (!result) return;

      onCreate?.(result);
      close?.();
    },
    schema: yup =>
      yup.object({
        requesterActorId: yup.string().trim().required('Delegatee is required'),
        requesterActorName: yup.string().ensure(),
        permissions: yup
          .array(yup.string().oneOf(['provider:read', 'provider:call']).defined())
          .defined()
          .min(1, 'Pick at least one permission')
          .required('Pick at least one permission'),
        note: yup.string().ensure(),
        expiresAt: yup
          .date()
          .nullable()
          .defined()
          .test('required-date', 'Expires at is required', value => !!value)
          .test(
            'future-date',
            'Expires at must be in the future',
            value => !!value && value > new Date()
          )
      })
  });

  let actorProvider = ({ searchQuery }: { searchQuery?: string }) => {
    let actors = useIdentityActors(instanceId, {
      limit: 25,
      search: searchQuery,
      status: 'active'
    });

    return {
      items: (actors.data?.items ?? []).map(actor => ({
        id: actor.id,
        label: actor.name,
        description: actor.description,
        data: actor
      })),
      isLoading: actors.isLoading,
      empty: searchQuery ? 'No matching actors found.' : 'No actors available.'
    };
  };

  return (
    <form onSubmit={form.handleSubmit}>
      <Combobox
        label="Delegatee"
        placeholder="Search identity actors"
        value={form.values.requesterActorId || null}
        valueLabel={form.values.requesterActorName || undefined}
        provider={({ searchQuery }) => actorProvider({ searchQuery })}
        onChange={(value, item) => {
          form.setFieldValue('requesterActorId', value ?? '');
          form.setFieldValue('requesterActorName', item?.label ?? '');
        }}
      />
      <form.RenderError field="requesterActorId" />

      <Spacer size={15} />

      <Text size="2" weight="strong">
        Permissions
      </Text>
      <CheckList
        syncItems
        items={getPermissionItems(form.values.permissions)}
        onChange={items => {
          let nextPermissions = items
            .filter(item => item.isChecked)
            .map(item => item.id)
            .filter((value): value is string => !!value);

          form.setFieldValue('permissions', nextPermissions);
        }}
      />
      <form.RenderError field="permissions" />

      <Spacer size={15} />

      <DatePicker
        label="Expires At"
        type="single"
        value={form.values.expiresAt ?? undefined}
        onChange={value => form.setFieldValue('expiresAt', value)}
      />
      <form.RenderError field="expiresAt" />

      <Spacer size={15} />

      <Input label="Note" {...form.getFieldProps('note')} />
      <form.RenderError field="note" />

      <createMutation.RenderError />

      <Spacer size={15} />

      <Dialog.Actions>
        <Button type="button" variant="outline" onClick={close} size="2">
          Cancel
        </Button>
        <Button type="submit" loading={createMutation.isLoading} size="2">
          Create Delegation Request
        </Button>
      </Dialog.Actions>
    </form>
  );
};
