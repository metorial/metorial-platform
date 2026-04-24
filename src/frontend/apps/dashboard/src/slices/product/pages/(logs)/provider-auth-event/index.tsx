import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviderAuthConfigEvent
} from '@metorial/state';
import { Badge, Callout, Datalist, RenderDate, theme } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import styled from 'styled-components';
import { ProviderInvocationById } from '../../../scenes/providerInvocations/details';
import { SectionList } from '../../../scenes/providerInvocations/styled';
import { CollapsibleBox } from '../../../scenes/sessionTracing/components/collapsibleBox';

let EVENT_LABELS: Record<string, string> = {
  setup_link_opened: 'Setup Link Opened',
  get_authorization_url: 'Authorization URL Generated',
  exchange_authorization_code: 'Authorization Code Exchanged',
  access_token_received: 'Access Token Received',
  oauth_setup_completed: 'OAuth Setup Completed',
  oauth_setup_failed: 'OAuth Setup Failed',
  oauth_token_refresh_failed: 'OAuth Token Refresh Failed'
};

let humanizeType = (type: string) =>
  type
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

let getEventLabel = (type: string) => EVENT_LABELS[type] ?? humanizeType(type);

let DashedLink = styled(Link)`
  color: ${theme.colors.gray900};
  text-decoration: underline dashed;
  text-decoration-color: ${theme.colors.gray500};
  text-underline-offset: 3px;
  text-decoration-thickness: 1px;
  font-weight: 500;
  word-break: break-all;
  transition:
    color 120ms ease,
    text-decoration-color 120ms ease;

  &:hover {
    color: ${theme.colors.gray700};
    text-decoration-color: ${theme.colors.gray700};
  }
`;

let ErrorCallout = styled.div`
  margin-bottom: 4px;
`;

export let ProviderAuthEventPage = () => {
  let { providerAuthEventId } = useParams();

  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  let event = useProviderAuthConfigEvent(instance.data?.id, providerAuthEventId);

  return renderWithLoader({ event })(({ event }) => {
    let data = event.data;

    let isError = data.status === 'error';

    let items: { label: ReactNode; value: ReactNode }[] = [
      { label: 'Event ID', value: <ID id={data.id} /> },
      {
        label: 'Status',
        value: (
          <Badge size="1" color={isError ? 'red' : 'green'}>
            {data.status}
          </Badge>
        )
      },
      { label: 'Type', value: <>{getEventLabel(data.type)}</> },
      { label: 'Created', value: <RenderDate date={data.createdAt} /> }
    ];

    if (data.providerId) {
      items.push({
        label: 'Provider',
        value: (
          <DashedLink
            to={Paths.instance.provider(
              organization.data,
              project.data,
              instance.data,
              data.providerId
            )}
          >
            <ID id={data.providerId} />
          </DashedLink>
        )
      });
    }

    if (data.providerAuthConfigId) {
      items.push({
        label: 'Auth Config',
        value: (
          <DashedLink
            to={Paths.instance.providerAuthConfig(
              organization.data,
              project.data,
              instance.data,
              data.providerAuthConfigId
            )}
          >
            <ID id={data.providerAuthConfigId} />
          </DashedLink>
        )
      });
    }

    if (data.providerAuthCredentialsId) {
      items.push({
        label: 'Auth Credentials',
        value: (
          <DashedLink
            to={Paths.instance.providerAuthCredential(
              organization.data,
              project.data,
              instance.data,
              data.providerAuthCredentialsId
            )}
          >
            <ID id={data.providerAuthCredentialsId} />
          </DashedLink>
        )
      });
    }

    if (data.providerAuthErrorId) {
      items.push({
        label: 'Auth Error',
        value: (
          <DashedLink
            to={Paths.instance.providerAuthError(
              organization.data,
              project.data,
              instance.data,
              data.providerAuthErrorId
            )}
          >
            <ID id={data.providerAuthErrorId} />
          </DashedLink>
        )
      });
    }

    return (
      <SectionList>
        {isError ? (
          <ErrorCallout>
            <Callout color="red">
              <span>
                <strong>{getEventLabel(data.type)}</strong> — this authentication event failed.{' '}
                See below for details.
              </span>
            </Callout>
          </ErrorCallout>
        ) : null}

        <CollapsibleBox
          id="provider-auth-event-details"
          title="Details"
          description={`${getEventLabel(data.type)} event metadata.`}
          rightActions={
            <Badge size="1" color={isError ? 'red' : 'green'}>
              {data.status}
            </Badge>
          }
        >
          <Datalist items={items} />
        </CollapsibleBox>

        {data.providerInvocationId && (
          <ProviderInvocationById
            providerInvocationId={data.providerInvocationId}
            hideHeader
          />
        )}
      </SectionList>
    );
  });
};
