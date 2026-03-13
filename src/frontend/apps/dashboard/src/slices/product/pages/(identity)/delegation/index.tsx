import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useIdentityDelegation,
  useIdentityDelegationConfig,
  useIdentityDelegationRequest
} from '@metorial/state';
import { Attributes, Button, RenderDate, Spacer, Text, confirm } from '@metorial/ui';
import { Box, ID, Table } from '@metorial/ui-product';
import { Link, useParams } from 'react-router-dom';
import { UsageScene } from '../../../scenes/usage/usage';

export let IdentityDelegationPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let { identityDelegationId } = useParams();
  let delegation = useIdentityDelegation(instance.data?.id, identityDelegationId);
  let request = useIdentityDelegationRequest(
    instance.data?.id,
    delegation.data?.request?.id,
    delegation.data?.request?.id ? { allowDeleted: true } : undefined
  );
  let revokeMutator = delegation.useRevokeMutator();
  let approveMutator = request.useApproveMutator();
  let denyMutator = request.useDenyMutator();

  let delegationConfig = useIdentityDelegationConfig(
    instance.data?.id,
    delegation.data?.delegationConfigId
  );

  let _delegation = delegation;

  return renderWithLoader({ delegation, instance, organization, project })(
    ({ delegation, instance, organization, project }) => (
      <>
        <Attributes
          itemWidth="300px"
          attributes={[
            {
              label: 'ID',
              content: <ID id={delegation.data.id} />
            },
            {
              label: 'Status',
              content: delegation.data.status
            },
            {
              label: 'Identity',
              content: (
                <Link
                  to={Paths.instance.identity.identity(
                    organization.data,
                    project.data,
                    instance.data,
                    delegation.data.identity.id
                  )}
                >
                  {delegation.data.identity.name}
                </Link>
              )
            },
            {
              label: 'Delegation Config',
              content: delegation.data.delegationConfigId ? (
                <Link
                  to={Paths.instance.identity.delegationConfig(
                    organization.data,
                    project.data,
                    instance.data,
                    delegation.data.delegationConfigId
                  )}
                >
                  {delegationConfig.data?.name ?? '...'}
                </Link>
              ) : (
                '—'
              )
            },
            {
              label: 'Created At',
              content: <RenderDate date={delegation.data.createdAt} />
            },
            {
              label: 'Expires At',
              content: delegation.data.expiresAt ? (
                <RenderDate date={delegation.data.expiresAt} />
              ) : (
                '—'
              )
            }
          ]}
        />

        <Spacer size={20} />

        <UsageScene
          title="Identity Usage"
          description="See how the delegated identity is being used across delegations and requests."
          entities={[{ type: 'identity', id: delegation.data.identity.id }]}
          entityNames={{
            [delegation.data.identity.id]: delegation.data.identity.name ?? delegation.data.identity.id
          }}
        />

        {delegation.data.note && (
          <>
            <Spacer size={20} />

            <Box title="Note" description="Additional information about this delegation.">
              <Text size="2">{delegation.data.note}</Text>
            </Box>
          </>
        )}

        {delegation.data.status === 'active' && (
          <>
            <Spacer size={20} />

            <Box
              title="Revoke Delegation"
              description="Revoke this delegation to remove the delegated access."
            >
              <Button
                size="2"
                color="red"
                loading={revokeMutator.isLoading}
                success={revokeMutator.isSuccess}
                onClick={() =>
                  confirm({
                    title: 'Revoke delegation',
                    description: 'Are you sure you want to revoke this delegation?',
                    onConfirm: async () => {
                      await revokeMutator.mutate({});
                      _delegation.refetch();
                    }
                  })
                }
              >
                Revoke Delegation
              </Button>

              <revokeMutator.RenderError />
            </Box>
          </>
        )}

        <Spacer size={20} />

        <Box title="Parties" description="Actors participating in this delegation.">
          <Table
            headers={['Actor', 'Roles', 'Type', 'ID', 'Created']}
            data={delegation.data.parties.map(party => ({
              href: Paths.instance.identity.actor(
                organization.data,
                project.data,
                instance.data,
                party.actor.id
              ),
              data: [
                party.actor.name,
                party.roles.join(', '),
                party.actor.type,
                <ID id={party.actor.id} />,
                <RenderDate date={party.createdAt} />
              ]
            }))}
          />
        </Box>

        <Spacer size={20} />

        <Box
          title="Attestation"
          description="Attestation attached to this delegation, if one was recorded."
        >
          {delegation.data.attestation ? (
            <Table
              headers={['Type', 'ID', 'Created']}
              data={[
                {
                  data: [
                    delegation.data.attestation.type,
                    <ID id={delegation.data.attestation.id} />,
                    <RenderDate date={delegation.data.attestation.createdAt} />
                  ]
                }
              ]}
            />
          ) : (
            <Text size="2" color="gray600" align="center">
              No attestation attached to this delegation.
            </Text>
          )}
        </Box>

        <Spacer size={20} />

        <Box
          title="Default Permissions"
          description="Permissions granted by this delegation before any credential-specific overrides."
        >
          <Table
            headers={['Permissions', 'Expires', 'Created']}
            data={
              delegation.data.permissions.length > 0
                ? delegation.data.permissions.map(permission => ({
                    data: [
                      permission,
                      delegation.data.expiresAt ? (
                        <RenderDate date={delegation.data.expiresAt} />
                      ) : (
                        '—'
                      ),
                      <RenderDate date={delegation.data.createdAt} />
                    ]
                  }))
                : []
            }
          />

          {delegation.data.permissions.length === 0 && (
            <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
              No default permissions configured for this delegation.
            </Text>
          )}
        </Box>

        <Spacer size={20} />

        <Box
          title="Credentials"
          description="Credential overrides attached to this delegation."
        >
          <Table
            headers={['Credential ID', 'Status', 'Permissions', 'Created', 'Expires']}
            data={delegation.data.credentialOverrides.map(credential => ({
              data: [
                <ID id={credential.credentialId} />,
                credential.status,
                credential.permissions.join(', '),
                <RenderDate date={credential.createdAt} />,
                credential.expiresAt ? <RenderDate date={credential.expiresAt} /> : '—'
              ]
            }))}
          />

          {delegation.data.credentialOverrides.length === 0 && (
            <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
              No credential overrides attached to this delegation.
            </Text>
          )}
        </Box>

        {delegation.data.request?.status === 'pending' && delegation.data.request && (
          <>
            <Spacer size={20} />

            <Box
              title="Pending Request"
              description={
                <>
                  {delegation.data.request.requester.name} requested access on{' '}
                  <RenderDate date={delegation.data.request.createdAt} />.
                </>
              }
            >
              <div style={{ display: 'flex', gap: 10 }}>
                <Button
                  size="2"
                  color="blue"
                  loading={approveMutator.isLoading}
                  success={approveMutator.isSuccess}
                  onClick={() => {
                    approveMutator.mutate({ allowDeleted: true });
                    _delegation.refetch();
                  }}
                >
                  Accept
                </Button>

                <Button
                  size="2"
                  color="red"
                  loading={denyMutator.isLoading}
                  success={denyMutator.isSuccess}
                  onClick={() => {
                    denyMutator.mutate({ allowDeleted: true });
                    _delegation.refetch();
                  }}
                >
                  Deny
                </Button>
              </div>

              <approveMutator.RenderError />
              <denyMutator.RenderError />
            </Box>
          </>
        )}
      </>
    )
  );
};
