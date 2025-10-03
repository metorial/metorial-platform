import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance } from '@metorial/state';
import { Button, CenteredSpinner, Error, Spacer, theme } from '@metorial/ui';
import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { BreathingIndicator } from './breathing';
import { useSessionForDeployment } from './state';

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
  justify-content: center;
  flex-direction: column;
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

export let InspectorFrame = ({ serverDeployment }: { serverDeployment: { id: string } }) => {
  let instance = useCurrentInstance();
  let session = useSessionForDeployment(instance.data?.id, serverDeployment.id);

  let [isLoading, setIsLoading] = useState(true);

  let url = useMemo(() => {
    if (!session.data) return undefined;

    let url = new URL(import.meta.env.VITE_EXPLORER_URL!); // https://inspector.mcp.metorial.com
    url.searchParams.set(
      'sse_url',
      new URL(
        `/mcp/${session.data.id}/${serverDeployment.id}/sse`,
        import.meta.env.VITE_MCP_API_URL
      ).toString()
    );
    url.searchParams.set('transport_type', 'sse');
    url.searchParams.set('direction', 'vertical');
    if (session.data.clientSecret.secret)
      url.searchParams.set('bearer_token', session.data.clientSecret.secret);

    return url.toString();
  }, [session.data]);

  return (
    <>
      <ConnectionNav>
        <ConnectionNavSection>
          <Status
            initial={{
              y: -10,
              opacity: 0
            }}
            animate={{
              y: 0,
              opacity: 1
            }}
            transition={{
              delay: 1
            }}
          >
            <BreathingIndicator />
            <span>
              Connected via <i>mcp.metorial.com</i>
            </span>
          </Status>
        </ConnectionNavSection>

        <ConnectionNavSection>
          <Link
            to={Paths.instance.serverDeployment(
              instance.data?.organization,
              instance.data?.project,
              instance.data,
              serverDeployment.id
            )}
          >
            <Button as="span" size="2" variant="outline">
              Open Server Deployment
            </Button>
          </Link>

          <Link
            to={Paths.instance.session(
              instance.data?.organization,
              instance.data?.project,
              instance.data,
              session.data?.id
            )}
          >
            <Button as="span" size="2" variant="outline">
              Open Server Session
            </Button>
          </Link>
        </ConnectionNavSection>
      </ConnectionNav>

      <Wrapper>
        {session.error || session.state == 'error' ? (
          <Center>
            <Error>{session.error?.message ?? 'Unable to create session'}</Error>
          </Center>
        ) : session.state == 'ready' ||
          session.state == 'loading' ||
          session.state == 'oauth_pending' ? (
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
        ) : session.state == 'oauth_error' ? (
          <Center>
            <Error>Please authenticate with the provider to continue.</Error>

            <Spacer size={16} />

            <Button onClick={() => location.reload()}>Retry OAuth Flow</Button>
          </Center>
        ) : null}
      </Wrapper>
    </>
  );
};
