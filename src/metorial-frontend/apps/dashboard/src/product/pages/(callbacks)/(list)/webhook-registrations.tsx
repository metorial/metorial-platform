import { PaginationSearchParamsProvider, renderWithLoader } from '@metorial/data-hooks';
import { ContentLayout, PageHeader } from '@metorial/layout';
import { useCurrentInstance } from '@metorial/state';
import { WebhookRegistrationsTable } from '../../../scenes/callbacks/webhookRegistrationsTable';

export let WebhookRegistrationsPage = () => {
  let instance = useCurrentInstance();

  return (
    <ContentLayout>
      <PageHeader
        title="Webhook Registrations"
        description="Registrations you created to receive events from providers."
      />

      <PaginationSearchParamsProvider enabled={true}>
        {renderWithLoader({ instance })(({ instance }) => (
          <WebhookRegistrationsTable instanceId={instance.data.id} />
        ))}
      </PaginationSearchParamsProvider>
    </ContentLayout>
  );
};
