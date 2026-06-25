import { renderWithLoader } from '@metorial/data-hooks';
import { ContentLayout } from '@metorial/layout';
import { useCurrentInstance, useSession } from '@metorial/state';
import { RenderDate } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';
import { AttributesLayout } from '../../../scenes/attributesLayout';
import { SessionConnectionStatusBadge } from '../../../scenes/providerSessions/table';

export let ProviderSessionContent = ({ children }: { children: React.ReactNode }) => {
  let instance = useCurrentInstance();
  let { sessionId } = useParams();
  let session = useSession(instance.data?.id, sessionId);

  return (
    <ContentLayout>
      {renderWithLoader({ session })(({ session }) => (
        <>
          <AttributesLayout
            variant="large"
            items={[
              {
                label: 'Status',
                value: (
                  <SessionConnectionStatusBadge
                    connectionStatus={session.data.connectionState}
                    hasErrors={session.data.hasErrors}
                    hasWarnings={session.data.hasWarnings}
                  />
                )
              },
              {
                label: 'Health',
                value: session.data.hasErrors
                  ? 'Error'
                  : session.data.hasWarnings
                    ? 'Warning'
                    : 'Healthy'
              },
              { label: 'Session ID', value: <ID id={session.data.id} /> },
              { label: 'Created At', value: <RenderDate date={session.data.createdAt} /> },
              {
                label: 'Messages',
                value:
                  (session.data.usage?.totalProductiveClientMessageCount ?? 0) +
                  (session.data.usage?.totalProductiveProviderMessageCount ?? 0)
              }
            ]}
          >
            {children}
          </AttributesLayout>
        </>
      ))}
    </ContentLayout>
  );
};
