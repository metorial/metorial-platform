import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviderAuthConfigError
} from '@metorial/state';
import { Badge, Callout, Datalist, RenderDate, Text } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { Link, useParams } from 'react-router-dom';
import { ProviderInvocationById } from '../../../scenes/providerInvocations/details';
import { formatTitleCase } from '../../../scenes/providerInvocations/helpers';
import {
  Card,
  Section,
  SectionHeading,
  SectionList
} from '../../../scenes/providerInvocations/styled';

export let ProviderAuthErrorPage = () => {
  let { providerAuthErrorId } = useParams();

  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  let error = useProviderAuthConfigError(instance.data?.id, providerAuthErrorId);

  return renderWithLoader({ error })(({ error }) => {
    let data = error.data;

    let metadata: { label: React.ReactNode; value: React.ReactNode }[] = [
      { label: 'Error ID', value: <ID id={data.id} /> },
      {
        label: 'Status',
        value: (
          <Badge color={data.status === 'processed' ? 'red' : 'orange'}>
            {formatTitleCase(data.status)}
          </Badge>
        )
      },
      { label: 'Type', value: <Text size="2">{formatTitleCase(data.type)}</Text> },
      {
        label: 'Provider',
        value: data.providerId ? <ID id={data.providerId} /> : <Text size="2">—</Text>
      },
      {
        label: 'Auth Config',
        value: data.providerAuthConfigId ? (
          <Link
            to={Paths.instance.providerAuthConfig(
              organization.data,
              project.data,
              instance.data,
              data.providerAuthConfigId
            )}
          >
            <ID id={data.providerAuthConfigId} />
          </Link>
        ) : (
          <Text size="2">—</Text>
        )
      },
      {
        label: 'Auth Credentials',
        value: data.providerAuthCredentialsId ? (
          <Link
            to={Paths.instance.providerAuthCredential(
              organization.data,
              project.data,
              instance.data,
              data.providerAuthCredentialsId
            )}
          >
            <ID id={data.providerAuthCredentialsId} />
          </Link>
        ) : (
          <Text size="2">—</Text>
        )
      },
      {
        label: 'OAuth Setup',
        value: data.providerOauthSetupId ? (
          <ID id={data.providerOauthSetupId} />
        ) : (
          <Text size="2">—</Text>
        )
      },
      {
        label: 'Auth Event',
        value: data.authConfigEventId ? (
          <Link
            to={Paths.instance.providerAuthEvent(
              organization.data,
              project.data,
              instance.data,
              data.authConfigEventId
            )}
          >
            <ID id={data.authConfigEventId} />
          </Link>
        ) : (
          <Text size="2">—</Text>
        )
      },
      {
        label: 'Error Group',
        value: data.groupId ? <ID id={data.groupId} /> : <Text size="2">—</Text>
      },
      {
        label: 'Similar Errors',
        value: <Text size="2">{data.similarErrorCount ?? 0}</Text>
      },
      { label: 'Created', value: <RenderDate date={data.createdAt} /> }
    ];

    return (
      <SectionList>
        <Section>
          <SectionHeading>Error</SectionHeading>
          <Callout color="red">
            <span>
              <strong>{data.code}</strong> — {data.message}
            </span>
          </Callout>
        </Section>

        <Section>
          <SectionHeading>Details</SectionHeading>
          <Card>
            <Datalist items={metadata} />
          </Card>
        </Section>

        {data.providerInvocationId ? (
          <Section>
            <SectionHeading>
              <span>Provider Invocation</span>
              <Text size="1" color="gray600">
                <ID id={data.providerInvocationId} />
              </Text>
            </SectionHeading>
            <ProviderInvocationById providerInvocationId={data.providerInvocationId} />
          </Section>
        ) : (
          <Section>
            <SectionHeading>Provider Invocation</SectionHeading>
            <Callout color="gray">
              <span>
                No provider invocation was captured for this auth error. This can happen when
                the failure occurred outside of a tracked request (e.g. async token refresh).
              </span>
            </Callout>
          </Section>
        )}
      </SectionList>
    );
  });
};
