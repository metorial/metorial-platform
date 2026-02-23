import { Paths } from '@metorial/frontend-config';
import {
  useApiKeys,
  useCurrentInstance,
  useRevealedApiKey,
  useSession
} from '@metorial/state';
import { Button, CenteredSpinner, Error, theme } from '@metorial/ui';
import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { BreathingIndicator } from './breathing';

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

let Center = styled.div`
  height: 100%;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  flex-direction: column;
  padding-top: 40px;
  overflow-y: auto;
`;

let ConnectionNav = styled.nav`
  display: flex;
  gap: 10px;
  justify-content: space-between;
  border-bottom: solid ${theme.colors.gray400} 1px;
`;

let ConnectionNavSection = styled.nav`
  padding: 7px 12px;
  display: flex;
  gap: 10px;
  align-items: center;
`;

let Status = styled(motion.div)`
  display: flex;
  gap: 6px;
  align-items: center;
  color: ${theme.colors.green900};
  font-size: 14px;
  font-weight: 500;
`;

type ExplorerRuntimeWindow = Window & {
  METORIAL_EXPLORER_URL?: string;
  METORIAL_MCP_API_URL?: string;
};

export let InspectorFrame = ({ sessionId }: { sessionId: string }) => {
  let instance = useCurrentInstance();
  let session = useSession(instance.data?.id, sessionId);

  let apiKeys = useApiKeys(
    instance.data ? { type: 'instance_access_token', instanceId: instance.data.id } : null
  );

  let firstActiveKeyId = apiKeys.data?.find(
    k => k.status === 'active' && k.type === 'instance_access_token_secret'
  )?.id;

  let revealedKey = useRevealedApiKey({ apiKeyId: firstActiveKeyId });

  let [isLoading, setIsLoading] = useState(true);

  let url = useMemo(() => {
    if (!session.data || !instance.data) return undefined;

    let runtimeWindow = window as ExplorerRuntimeWindow;
    let explorerBase =
      runtimeWindow.METORIAL_EXPLORER_URL ?? import.meta.env.VITE_EXPLORER_URL!;
    let url = new URL(explorerBase);

    let mcpApiUrl = runtimeWindow.METORIAL_MCP_API_URL ?? import.meta.env.VITE_MCP_API_URL;

    let connectionUrl = session.data.connectionUrl ?? `${mcpApiUrl}/mcp/${session.data.id}`;
    if (!connectionUrl) return undefined;

    url.searchParams.set('sse_url', connectionUrl);
    url.searchParams.set('transport_type', 'streamable-http');
    url.searchParams.set('direction', 'vertical');

    if (revealedKey.value) {
      url.searchParams.set('bearer_token', revealedKey.value);
    }

    url.hash = 'tools';

    return url.toString();
  }, [session.data, instance.data, revealedKey.value]);

  let firstDeploymentId = session.data?.providers?.[0]?.deployment?.id;

  return (
    <>
      <ConnectionNav>
        <ConnectionNavSection>
          <Status
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 1 }}
          >
            <BreathingIndicator />
            <span>
              Connected via <i>mcp.metorial.com</i>
            </span>
          </Status>
        </ConnectionNavSection>

        <ConnectionNavSection>
          {firstDeploymentId && (
            <Link
              to={Paths.instance.providerDeployment(
                instance.data?.organization,
                instance.data?.project,
                instance.data,
                firstDeploymentId
              )}
            >
              <Button as="span" size="2" variant="outline">
                Open Provider Deployment
              </Button>
            </Link>
          )}

          <Link
            to={Paths.instance.providerSession(
              instance.data?.organization,
              instance.data?.project,
              instance.data,
              sessionId
            )}
          >
            <Button as="span" size="2" variant="outline">
              Open Session
            </Button>
          </Link>
        </ConnectionNavSection>
      </ConnectionNav>

      <Wrapper>
        {session.error ? (
          <Center>
            <Error>{session.error?.message ?? 'Unable to load session'}</Error>
          </Center>
        ) : session.isLoading || !url ? (
          <>
            <AnimatePresence>
              <Overlay>
                <CenteredSpinner />
              </Overlay>
            </AnimatePresence>
          </>
        ) : (
          <>
            <Iframe src={url} onLoad={() => setIsLoading(false)} key={url} />

            <AnimatePresence>
              {isLoading && (
                <Overlay>
                  <CenteredSpinner />
                </Overlay>
              )}
            </AnimatePresence>
          </>
        )}
      </Wrapper>
    </>
  );
};
