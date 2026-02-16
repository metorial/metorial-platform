import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import { Button, Callout, Spacer, Text } from '@metorial/ui';
import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export let ProviderConnectionLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();
  let navigate = useNavigate();

  let authConfigsPath = Paths.instance.providerDeployments(
    organization.data,
    project.data,
    instance.data,
    'auth-configs'
  );

  return (
    <ContentLayout>
      <PageHeader
        title="Auth Connections"
        pagination={[
          {
            label: 'Auth Connections',
            href: Paths.instance.providerConnections(
              organization.data,
              project.data,
              instance.data
            )
          }
        ]}
      />

      <Callout color="blue">
        <Text size="2">
          OAuth connections have been upgraded to Provider Auth Configs in the new Provider API.
          Manage your auth configurations from the Configurations section.
        </Text>

        <Spacer height={10} />

        <Link to={authConfigsPath}>
          <Button as="span" size="2">
            Go to Auth Configs
          </Button>
        </Link>
      </Callout>
    </ContentLayout>
  );
};
