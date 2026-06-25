import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { renderWithLoader, useForm } from '@metorial-io/data-hooks';
import { Button, Flex, Text, Group, Badge, Input, Spacer, Datalist, Callout, RenderDate, Copy, confirm } from '@metorial-io/ui';
import { useUser, useUserTokens, useCreateUserToken, useRevokeUserToken } from '../../hooks';
import { BackLink } from '../../components/BackLink';
import { MonoCode } from '../../components/styled';

let getTokenBadgeColor = (status: string): 'green' | 'red' | 'gray' => {
  if (status === 'active') return 'green';
  if (status === 'revoked') return 'red';
  return 'gray';
};

export let UserDetail = () => {
  let { tenantId, userId } = useParams<{ tenantId: string; userId: string }>();
  let user = useUser(tenantId, userId);
  let tokens = useUserTokens(tenantId, userId);
  let createToken = useCreateUserToken();
  let revokeToken = useRevokeUserToken();

  let [showCreateForm, setShowCreateForm] = useState(false);

  let tokenForm = useForm({
    initialValues: {
      tokenName: ''
    },
    onSubmit: async values => {
      if (!tenantId || !userId || !values.tokenName.trim()) return;
      let [, error] = await createToken.mutate({ tenantId, userId, name: values.tokenName.trim() });
      if (!error) {
        tokenForm.setFieldValue('tokenName', '');
        setShowCreateForm(false);
      }
    },
    schema: yup =>
      yup.object({
        tokenName: yup.string().required()
      })
  });

  let handleRevokeToken = (tokenId: string) => {
    confirm({
      title: 'Revoke Token',
      description: 'Are you sure you want to revoke this token? This action cannot be undone and any applications using this token will lose access.',
      confirmText: 'Revoke Token',
      onConfirm: () => {
        if (!tenantId || !userId) return;
        revokeToken.mutate({ tenantId, userId, tokenId });
      }
    });
  };

  return renderWithLoader({ user, tokens })(({ user }) => (
    <Flex direction="column" gap={24}>
      <BackLink to={`/tenants/${tenantId}/users`}>Back to Users</BackLink>

      <Group.Wrapper>
        <Group.Header
          title={user.data!.name}
          description={
            <Flex gap={8}>
              <Badge color="gray" size="1">
                <code>{user.data!.identifier}</code>
              </Badge>
              <Badge color={user.data!.status === 'active' ? 'green' : 'gray'} size="1">
                {user.data!.status}
              </Badge>
            </Flex>
          }
        />
        <Group.Content>
          <Datalist
            items={[
              { label: 'ID', value: <MonoCode>{user.data!.id}</MonoCode> },
              { label: 'Scope', value: user.data!.scope?.identifier ?? '-' },
              { label: 'Created', value: <RenderDate date={user.data!.createdAt} /> }
            ]}
          />
        </Group.Content>
      </Group.Wrapper>

      <Group.Wrapper>
        <Group.Header
          title="API Tokens"
          description="API tokens allow this user to authenticate with the registry API. Tokens can be revoked at any time."
        />
        <Group.Content>
          {showCreateForm ? (
            <form onSubmit={tokenForm.handleSubmit}>
              <Flex direction="column" gap={16}>
                <Input
                  label="Token Name"
                  placeholder="e.g., Production API Key"
                  value={tokenForm.values.tokenName}
                  onChange={e => tokenForm.setFieldValue('tokenName', e.target.value)}
                />
                <tokenForm.RenderError field="tokenName" />
                <createToken.RenderError />
                <Flex gap={8}>
                  <Button
                    type="submit"
                    loading={createToken.isLoading}
                    disabled={!tokenForm.values.tokenName.trim()}
                  >
                    Create Token
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowCreateForm(false)}>
                    Cancel
                  </Button>
                </Flex>
              </Flex>
            </form>
          ) : (
            <Button variant="outline" onClick={() => setShowCreateForm(true)}>
              + Create Token
            </Button>
          )}

          <Spacer size={24} />

          {tokens.data?.items.length === 0 ? (
            <Text size="2" color="gray600">No tokens created yet.</Text>
          ) : (
            <Flex direction="column" gap={12}>
              {tokens.data?.items.map(token => (
                <Callout key={token.id} color="gray">
                  <Flex direction="column" gap={8}>
                    <Flex align="center" justify="space-between">
                      <Flex align="center" gap={8}>
                        <Text size="2" weight="medium">{token.name}</Text>
                        <Badge color={getTokenBadgeColor(token.status)} size="1">
                          {token.status}
                        </Badge>
                      </Flex>
                      {token.status === 'active' && (
                        <Button
                          variant="outline"
                          size="1"
                          color="red"
                          onClick={() => handleRevokeToken(token.id)}
                        >
                          Revoke
                        </Button>
                      )}
                    </Flex>
                    <Copy value={token.secret} />
                    <Flex gap={16} align="center">
                      <Flex align="center" gap={4}>
                        <Text size="1" color="gray600">Created:</Text>
                        <RenderDate date={token.createdAt} />
                      </Flex>
                      {token.expiresAt && (
                        <Flex align="center" gap={4}>
                          <Text size="1" color="gray600">Expires:</Text>
                          <RenderDate date={token.expiresAt} />
                        </Flex>
                      )}
                    </Flex>
                  </Flex>
                </Callout>
              ))}
              {(tokens.data?.pagination.hasMoreBefore || tokens.data?.pagination.hasMoreAfter) && (
                <Flex justify="end" gap={10}>
                  <Button
                    variant="outline"
                    size="2"
                    disabled={!tokens.data?.pagination.hasMoreBefore || tokens.isLoading}
                    onClick={tokens.previous}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="2"
                    disabled={!tokens.data?.pagination.hasMoreAfter || tokens.isLoading}
                    onClick={tokens.next}
                  >
                    Next
                  </Button>
                </Flex>
              )}
            </Flex>
          )}
        </Group.Content>
      </Group.Wrapper>

    </Flex>
  ));
}
