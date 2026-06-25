import { renderWithLoader } from '@metorial-io/data-hooks';
import { Datalist, Spacer, Title } from '@metorial-io/ui';
import { Table } from '@metorial-io/ui-product';
import { useParams } from 'react-router-dom';
import { userState } from '../../../state';

export let UserPage = () => {
  let { userId } = useParams();
  let user = userState.use({ id: userId! });

  return renderWithLoader({ user })(({ user }) => (
    <>
      <Title weight="strong" as="h1" size="7">
        {user.data.name}
      </Title>

      <Spacer size={15} />

      <Title weight="strong" as="h2" size="4" style={{ marginBottom: 10, marginTop: 20 }}>
        User Profile
      </Title>

      <Datalist
        items={[
          { label: 'ID', value: user.data.id },
          { label: 'Status', value: user.data.status },
          { label: 'Email', value: user.data.email },
          { label: 'Name', value: user.data.name },
          { label: 'First Name', value: user.data.firstName },
          { label: 'Last Name', value: user.data.lastName },
          {
            label: 'Created At',
            value: new Date(user.data.createdAt).toLocaleDateString('de-at')
          },
          {
            label: 'Updated At',
            value: new Date(user.data.updatedAt).toLocaleDateString('de-at')
          },
          {
            label: 'Last Login At',
            value: user.data.lastLoginAt
              ? new Date(user.data.lastLoginAt).toLocaleDateString('de-at')
              : '-'
          },
          {
            label: 'Last Active At',
            value: user.data.lastActiveAt
              ? new Date(user.data.lastActiveAt).toLocaleDateString('de-at')
              : '-'
          }
        ]}
      />

      <Title weight="strong" as="h2" size="4" style={{ marginBottom: 10, marginTop: 20 }}>
        Emails
      </Title>

      <Table
        headers={['Email', 'Primary', 'Verified']}
        data={user.data.emails.map((email: any) => [
          email.email,
          email.isPrimary ? 'Yes' : 'No',
          email.verifiedAt ? new Date(email.verifiedAt).toLocaleDateString('de-at') : 'No'
        ])}
      />

      <Title weight="strong" as="h2" size="4" style={{ marginBottom: 10, marginTop: 20 }}>
        Auth Attempts
      </Title>

      <Table
        headers={['ID', 'Status', 'IP', 'UA', 'Created At']}
        data={user.data.authAttempts.map((attempt: any) => [
          attempt.id,
          attempt.status,
          attempt.ip,
          attempt.ua,
          new Date(attempt.createdAt).toLocaleDateString('de-at')
        ])}
      />

      <Title weight="strong" as="h2" size="4" style={{ marginBottom: 10, marginTop: 20 }}>
        Sessions
      </Title>

      <Table
        headers={['ID', 'Status', 'IP', 'UA', 'Created At', 'Device ID']}
        data={user.data.sessions.map((session: any) => [
          session.id,
          session.loggedOutAt
            ? 'Logged Out'
            : new Date(session.expiresAt) > new Date()
              ? 'Active'
              : 'Expired',
          session.device.ip,
          session.device.ua,
          new Date(session.createdAt).toLocaleDateString('de-at'),
          session.device.id
        ])}
      />
    </>
  ));
};
