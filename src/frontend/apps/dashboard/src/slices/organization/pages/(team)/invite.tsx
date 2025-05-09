import { renderWithLoader, renderWithPagination, useForm } from '@metorial/data-hooks';
import {
  useCurrentOrganization,
  useOrganizationInviteLink,
  useOrganizationInvites
} from '@metorial/state';
import {
  Badge,
  Button,
  Copy,
  Dialog,
  Group,
  Input,
  RenderDate,
  Select,
  showModal,
  Spacer,
  Text,
  Title,
  toast
} from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { capitalize } from 'lodash';

type OrganizationMemberRole = 'member' | 'admin';

export let OrganizationSettingsInvitesPage = () => {
  let organization = useCurrentOrganization();
  let link = useOrganizationInviteLink(organization?.data?.id ?? null);
  let organizationInvites = useOrganizationInvites(organization?.data?.id ?? null);

  let deleteOrganizationInvite = organizationInvites.deleteMutator();

  let onClickDeleteOrganization = async (organizationInviteId: string) => {
    try {
      await deleteOrganizationInvite.mutate({ organizationInviteId });
      toast.success('Invite revoked successfully.');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  let organizationInviteModal = () => {
    showModal(({ dialogProps, close }) => {
      let createOrganizationInvite = organizationInvites.createByEmailMutator();

      let organizationInviteForm = useForm({
        initialValues: {
          email: '',
          message: '',
          role: 'member' as 'member' | 'admin'
        },
        enableReinitialize: true,
        onSubmit: async values => {
          if (!values.email) return toast.error('Email is required');

          let [res] = await createOrganizationInvite.mutate(values);
          if (res) close();
        },
        schema: yup =>
          yup.object({
            email: yup.string().email('Invalid email').required('Email is required'),
            message: yup.string().default('').optional(),
            role: yup
              .mixed<OrganizationMemberRole>()
              .oneOf(['member', 'admin'])
              .required('Role is required')
          })
      });

      return (
        <Dialog.Wrapper {...dialogProps}>
          <Dialog.Title>Invite User</Dialog.Title>
          <Dialog.Description>Invite a new user to your organization.</Dialog.Description>

          <form onSubmit={organizationInviteForm.handleSubmit}>
            <Input
              label="Email"
              {...organizationInviteForm.getFieldProps('email')}
              type="email"
            />
            <organizationInviteForm.RenderError field="email" />

            <Spacer size={10} />

            <Select
              items={[
                { label: 'Member', id: 'member' },
                { label: 'Admin', id: 'admin' }
              ]}
              label="Role"
              value={organizationInviteForm.values.role}
              onChange={value => organizationInviteForm.setFieldValue('role', value)}
            />

            <Spacer size={10} />

            <Input
              label="Message"
              as="textarea"
              minRows={5}
              {...organizationInviteForm.getFieldProps('message')}
            />
            <organizationInviteForm.RenderError field="message" />

            <Spacer size={15} />

            <Dialog.Actions>
              <Button
                size="1"
                variant="soft"
                onClick={close}
                type="button"
                disabled={createOrganizationInvite.isLoading}
              >
                Cancel
              </Button>

              <Button
                size="1"
                type="submit"
                loading={createOrganizationInvite.isLoading}
                success={createOrganizationInvite.isSuccess}
              >
                Send Invite
              </Button>
            </Dialog.Actions>
          </form>
        </Dialog.Wrapper>
      );
    });
  };

  return (
    <>
      {renderWithLoader({ organization })(({ organization }) => (
        <>
          {organization.data.member.role == 'admin' && (
            <>
              <Group.Wrapper>
                <Group.Header
                  title="Invite Link"
                  description="Invite users to your organization by email."
                />

                <Group.Content>
                  <Copy label="Invite Link" value={link ?? '...'} />
                </Group.Content>
              </Group.Wrapper>

              <Spacer height={20} />
            </>
          )}
        </>
      ))}

      {renderWithPagination(organizationInvites)(organizationInvites => (
        <>
          {organizationInvites.data.items.length === 0 ? (
            <>
              <Text>
                No invites yet. Invite users to your organization by clicking the "Invite"
                button below.
              </Text>
            </>
          ) : (
            <Table
              headers={['Email', 'Role', 'Status', 'Created', 'Expires', '']}
              data={organizationInvites.data.items.map(organizationInvite => [
                <Title as="h2" size="2" weight="bold" style={{ margin: '10px 0' }}>
                  {organizationInvite.email ?? 'n/a'}
                </Title>,
                <Badge
                  color={organizationInvite.role === 'admin' ? 'purple' : 'gray'}
                  size="1"
                >
                  {capitalize(organizationInvite.role)}
                </Badge>,
                <Badge
                  color={
                    {
                      pending: 'orange' as const,
                      accepted: 'green' as const,
                      rejected: 'red' as const,
                      expired: 'gray' as const,
                      deleted: 'black' as const
                    }[organizationInvite.status]
                  }
                  size="1"
                >
                  {capitalize(organizationInvite.status)}
                </Badge>,
                <RenderDate date={organizationInvite.createdAt} />,
                <RenderDate date={organizationInvite.expiresAt} />,
                <Button
                  size="1"
                  variant="outline"
                  title="More"
                  onClick={() => onClickDeleteOrganization(organizationInvite.id)}
                >
                  Remove
                </Button>
              ])}
            />
          )}

          <Spacer size={15} />

          <Button size="2" variant="outline" onClick={() => organizationInviteModal()}>
            Invite
          </Button>
        </>
      ))}
    </>
  );
};
