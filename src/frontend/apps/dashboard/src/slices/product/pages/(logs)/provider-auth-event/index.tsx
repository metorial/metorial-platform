import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviderAuthConfigEvent
} from '@metorial/state';
import { Attributes, Callout, RenderDate, Text } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { Link, useParams } from 'react-router-dom';
import { ProviderInvocationById } from '../../../scenes/providerInvocations/details';
import {
  Section,
  SectionHeading,
  SectionList
} from '../../../scenes/providerInvocations/styled';

export let ProviderAuthEventPage = () => {
  let { providerAuthEventId } = useParams();

  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  let event = useProviderAuthConfigEvent(instance.data?.id, providerAuthEventId);

  return renderWithLoader({ event })(({ event }) => {
    let data = event.data;

    let isError = data.status === 'error';

    let metadata: { label: React.ReactNode; value: React.ReactNode }[] = [
      { label: 'Event ID', value: <ID id={data.id} /> },
      {
        label: 'Type',
        value: <Text size="2">{data.type}</Text>
      },
      {
        label: 'Provider',
        value: data.providerId ? (
          <Link
            to={Paths.instance.provider(
              organization.data,
              project.data,
              instance.data,
              data.providerId
            )}
          >
            <ID id={data.providerId} />
          </Link>
        ) : (
          <Text size="2">—</Text>
        )
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
      { label: 'Created', value: <RenderDate date={data.createdAt} /> }
    ];

    return (
      <SectionList>
        {isError ? (
          <Section>
            <SectionHeading>Error</SectionHeading>
            <Callout color="red">
              <span>
                This authentication event failed. See the linked auth error
                {data.providerAuthErrorId ? ' and ' : ' or '}
                provider invocation below for more context.
              </span>
            </Callout>
          </Section>
        ) : null}

        <Section>
          <Attributes
            attributes={metadata.map(a => ({ label: a.label, content: a.value }))}
            itemWidth="450px"
          />
        </Section>

        {data.providerInvocationId && (
          <Section>
            <ProviderInvocationById
              providerInvocationId={data.providerInvocationId}
              hideHeader
            />
          </Section>
        )}
      </SectionList>
    );
  });
};
