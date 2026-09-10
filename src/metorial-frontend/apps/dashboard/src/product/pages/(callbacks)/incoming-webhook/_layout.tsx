import { InitialLoadBoundary, renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  ContentPanelLayout,
  ContentPanelLayoutInner,
  ExtraHeaderLayout
} from '@metorial/layout';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useIncomingWebhook
} from '@metorial/state';
import { Button } from '@metorial/ui';
import { RiArrowLeftSLine } from '@remixicon/react';
import { Link, Outlet, useLocation, useParams } from 'react-router-dom';

export let IncomingWebhookLayout = () => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();

  let { incomingWebhookId } = useParams();
  let webhook = useIncomingWebhook(instance.data?.id, incomingWebhookId);

  let pathname = useLocation().pathname;
  let listPath = Paths.instance.incomingWebhooks(
    organization.data,
    project.data,
    instance.data
  );
  let params = [
    organization.data,
    project.data,
    instance.data,
    webhook.data?.id ?? incomingWebhookId
  ] as const;

  return (
    <ExtraHeaderLayout
      header={
        <Link to={listPath}>
          <Button size="2" variant="outline" iconLeft={<RiArrowLeftSLine />}>
            Back to all incoming webhooks
          </Button>
        </Link>
      }
    >
      <ContentPanelLayout
        title={`Incoming webhook ${incomingWebhookId?.slice(0, 12) ?? ''}`}
        breadcrumbs={[
          { label: 'Incoming Webhooks', to: listPath },
          {
            label: 'Incoming Webhook',
            to: Paths.instance.incomingWebhook(...params)
          }
        ]}
        links={{
          current: pathname,
          items: [{ label: 'Details', to: Paths.instance.incomingWebhook(...params) }]
        }}
      >
        <ContentPanelLayoutInner>
          <InitialLoadBoundary>
            {renderWithLoader({ webhook })(() => (
              <Outlet />
            ))}
          </InitialLoadBoundary>
        </ContentPanelLayoutInner>
      </ContentPanelLayout>
    </ExtraHeaderLayout>
  );
};
