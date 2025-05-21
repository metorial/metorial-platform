import { ServersDeploymentsGetOutput } from '@metorial/core';
import { useCurrentInstance, useSessionForDeployment } from '@metorial/state';
import { CenteredSpinner } from '@metorial/ui';
import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import styled from 'styled-components';

let Wrapper = styled.div`
  position: relative;
  height: 100%;
  width: 100%;
`;

let Overlay = styled(motion.div)`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
`;

let Iframe = styled.iframe`
  height: 100%;
  width: 100%;
  border: none;
`;

export let InspectorFrame = ({
  serverDeployment
}: {
  serverDeployment: ServersDeploymentsGetOutput;
}) => {
  let instance = useCurrentInstance();
  let session = useSessionForDeployment(instance.data?.id, serverDeployment.id);

  let [isLoading, setIsLoading] = useState(true);

  let url = useMemo(() => {
    if (!session.data) return undefined;

    let url = new URL(import.meta.env.VITE_EXPLORER_URL); // https://inspector.mcp.metorial.com
    url.searchParams.set(
      'sse_url',
      new URL(
        `/mcp/${session.data.id}/${serverDeployment.id}/sse`,
        import.meta.env.VITE_MCP_API_URL
      ).toString()
    );
    url.searchParams.set('transport_type', 'sse');
    if (session.data.clientSecret.secret)
      url.searchParams.set('bearer_token', session.data.clientSecret.secret);

    return url.toString();
  }, [session.data]);

  return (
    <Wrapper>
      <Iframe src={url} onLoad={() => setIsLoading(false)} />

      <AnimatePresence>
        {isLoading && (
          <Overlay>
            <CenteredSpinner />
          </Overlay>
        )}
      </AnimatePresence>
    </Wrapper>
  );
};
