import { renderWithPagination } from '@metorial/data-hooks';
import { useCurrentOrganization, useOrganizationMembers } from '@metorial/state';
import { Avatar, Badge, Button, Menu, RenderDate, Title } from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { RiMoreLine } from '@remixicon/react';
import { capitalize } from 'lodash';

export let OrganizationSettingsMembersPage = () => {
  let currentOrganization = useCurrentOrganization()?.data;
  let organizationMembers = useOrganizationMembers(currentOrganization?.id ?? null);

  let deleteOrganizationMember = organizationMembers.deleteMutator();
  let updateOrganizationMember = organizationMembers.updateMutator();

  return (
    <>
      {renderWithPagination(organizationMembers)(organizationMembers => (
        <>
          <Table
            headers={['Member', 'Status', 'Role', 'Created', '']}
            data={organizationMembers.data.items.map(organizationMember => [
              <div style={{ display: 'flex', alignItems: 'center', padding: '5px 0' }}>
                <Avatar
                  size={35}
                  entity={{
                    imageUrl: organizationMember.actor.imageUrl,
                    name: organizationMember.actor.name
                  }}
                />
                <div style={{ marginLeft: 10 }}>
                  <Title as="h2" size="2" weight="bold">
                    {organizationMember.actor.name}
                  </Title>
                  <Title as="h5" size="1" weight="light">
                    {organizationMember.actor.email}
                  </Title>
                </div>
              </div>,
              <Badge
                color={organizationMember.status === 'active' ? 'green' : 'gray'}
                size="1"
              >
                {capitalize(organizationMember.status)}
              </Badge>,
              <Badge color={'gray'} size="1">
                {capitalize(organizationMember.role)}
              </Badge>,
              <RenderDate date={organizationMember.createdAt} />,

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  width: '100%'
                }}
              >
                <Menu
                  items={[
                    {
                      id: 'delete',
                      label: 'Remove',
                      disabled: organizationMember.role === 'admin'
                    },
                    {
                      id: 'makeAdmin',
                      label: 'Make Admin',
                      disabled: organizationMember.role === 'admin'
                    },
                    {
                      id: 'makeMember',
                      label: 'Make Member',
                      disabled:
                        organizationMember.role === 'member' ||
                        organizationMember.id === currentOrganization?.member.id
                    }
                  ]}
                  onItemClick={item => {
                    if (item == 'delete')
                      deleteOrganizationMember.mutate({
                        organizationMemberId: organizationMember.id
                      });
                    if (item == 'makeAdmin')
                      updateOrganizationMember.mutate({
                        organizationMemberId: organizationMember.id,
                        role: 'admin'
                      });
                    if (item == 'makeMember')
                      updateOrganizationMember.mutate({
                        organizationMemberId: organizationMember.id,
                        role: 'member'
                      });
                  }}
                >
                  <Button size="1" variant="outline" iconLeft={<RiMoreLine />} title="More" />
                </Menu>
              </div>
            ])}
          />
        </>
      ))}
    </>
  );
};
