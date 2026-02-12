import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useSession } from '@metorial/state';
import { Attributes, RenderDate, Spacer } from '@metorial/ui';
import { ID, SideBox } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';

export let ProviderSessionOverviewPage = () => {
  let instance = useCurrentInstance();

  let { sessionId } = useParams();
  let session = useSession(instance.data?.instanceId, sessionId);

  return renderWithLoader({ session })(({ session }) => (
    <>
      <Attributes
        itemWidth="250px"
        attributes={[
          {
            label: 'Name',
            content: session.data.name ?? 'Unnamed Session'
          },
          {
            label: 'ID',
            content: <ID id={session.data.id} />
          },
          {
            label: 'Status',
            content: session.data.status
          },
          {
            label: 'Created At',
            content: <RenderDate date={session.data.createdAt!} />
          }
        ]}
      />

      <Spacer height={15} />

      {session.data.connectionUrls && (
        <SideBox
          title="Connection URLs"
          description="Use these URLs to connect to this session."
        >
          {session.data.connectionUrls.sse && (
            <div>
              <strong>SSE:</strong>{' '}
              <code style={{ fontSize: '12px', wordBreak: 'break-all' }}>
                {session.data.connectionUrls.sse}
              </code>
            </div>
          )}
          <Spacer size={5} />
          {session.data.connectionUrls.streamableHttp && (
            <div>
              <strong>Streamable HTTP:</strong>{' '}
              <code style={{ fontSize: '12px', wordBreak: 'break-all' }}>
                {session.data.connectionUrls.streamableHttp}
              </code>
            </div>
          )}
        </SideBox>
      )}
    </>
  ));
};
