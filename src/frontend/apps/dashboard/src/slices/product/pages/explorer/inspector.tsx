import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useSession } from '@metorial/state';
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

export let InspectorFrame = ({ sessionId }: { sessionId: string }) => {
  let instance = useCurrentInstance();
  let session = useSession(instance.data?.id, sessionId);

  let [isLoading, setIsLoading] = useState(true);

  let url = useMemo(() => {
    if (!session.data) return undefined;

    let url = new URL(
      (window as any).METORIAL_EXPLORER_URL ?? import.meta.env.VITE_EXPLORER_URL!
    );

    let connectionUrl = session.data.connectionUrl;
    if (!connectionUrl) return undefined;

    url.searchParams.set('sse_url', connectionUrl);
    url.searchParams.set('transport_type', 'sse');
    url.searchParams.set('direction', 'vertical');

    if (session.data.connectionKey)
      url.searchParams.set('bearer_token', session.data.connectionKey);

    return url.toString();
  }, [session.data]);

  let firstDeploymentId = session.data?.providerDeployments?.[0]?.providerDeploymentId;

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
