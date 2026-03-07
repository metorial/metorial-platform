import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useSession } from '@metorial/state';
import { Button, CenteredSpinner, Error, Menu, theme } from '@metorial/ui';
import { RiArrowDownSLine } from '@remixicon/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  METORIAL_EXPLORER_V2_URL?: string;
  METORIAL_MCP_API_URL?: string;
};

type ExplorerConfigMessage = {
  type: 'metorial.explorer.config';
  payload: {
    transport_type: 'sse' | 'streamable-http';
    sse_url: string;
    bearer_token?: string;
    name?: string;
    description?: string;
  };
};

export let InspectorFrame = ({ sessionId }: { sessionId: string }) => {
  let instance = useCurrentInstance();
  let session = useSession(instance.data?.id, sessionId);
  let iframeRef = useRef<HTMLIFrameElement | null>(null);
  let runtimeWindow = window as ExplorerRuntimeWindow;

  let [explorerVersion, setExplorerVersion] = useState<'v1' | 'v2'>('v2');

  let [isLoading, setIsLoading] = useState(true);

  let name = session.data?.providers
    .map(p => p.deployment.name)
    .filter(Boolean)
    .sort()
    .join(', ');

  let explorerConfig = useMemo(() => {
    if (!session.data || !instance.data) return undefined;

    let mcpApiUrl = runtimeWindow.METORIAL_MCP_API_URL ?? import.meta.env.VITE_MCP_API_URL;
    let connectionUrl = session.data.connectionUrl ?? `${mcpApiUrl}/mcp/${session.data.id}`;
    if (!connectionUrl) return undefined;

    return {
      transport_type: 'streamable-http' as const,
      sse_url: connectionUrl,
      name,
      description: session.data.description ?? undefined,
      bearer_token:
        ((session.data as any).clientSecret ?? (session.data as any).client_secret) ||
        undefined
    };
  }, [session.data, instance.data, name]);

  let url = useMemo(() => {
    let explorerBase =
      explorerVersion === 'v2'
        ? (runtimeWindow.METORIAL_EXPLORER_V2_URL ?? import.meta.env.VITE_EXPLORER_V2_URL!)
        : (runtimeWindow.METORIAL_EXPLORER_URL ?? import.meta.env.VITE_EXPLORER_URL!);

    let url = new URL(explorerBase);

    if (explorerVersion === 'v2') {
      url.searchParams.set('transport', 'streamable-http');
      url.searchParams.set('endpoint', explorerConfig?.sse_url ?? '');

      if (name) {
        url.searchParams.set('name', name);
      }

      if (session.data?.description) {
        url.searchParams.set('description', session.data.description);
      }
    } else {
      url.searchParams.set('transport_type', 'streamable-http');
      url.searchParams.set('direction', 'vertical');
      url.hash = 'tools';
    }

    return url.toString();
  }, [
    explorerConfig?.sse_url,
    explorerVersion,
    name,
    runtimeWindow,
    session.data?.description
  ]);

  useEffect(() => {
    setIsLoading(true);
  }, [url]);

  useEffect(() => {
    if (!iframeRef.current?.contentWindow || !explorerConfig) return;

    let targetOrigin = new URL(url).origin;
    let message: ExplorerConfigMessage = {
      type: 'metorial.explorer.config',
      payload: explorerConfig
    };

    let tries = 0;
    let timer = window.setInterval(() => {
      if (!iframeRef.current?.contentWindow) return;
      iframeRef.current.contentWindow.postMessage(message, targetOrigin);
      tries++;
      if (tries >= 10) window.clearInterval(timer);
    }, 250);

    return () => window.clearInterval(timer);
  }, [explorerConfig, url]);

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
              Connected via <i>connect.metorial.com</i>
            </span>
          </Status>
        </ConnectionNavSection>

        <ConnectionNavSection>
          <Menu
            items={[
              { id: 'v2', label: 'Metorial Explorer' },
              { id: 'v1', label: 'MCP Inspector' }
            ]}
            onItemClick={v => setExplorerVersion(v as 'v1' | 'v2')}
          >
            <Button size="2" variant="outline" iconRight={<RiArrowDownSLine />}>
              {
                {
                  v1: 'MCP Inspector',
                  v2: 'Metorial Explorer'
                }[explorerVersion]
              }
            </Button>
          </Menu>

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
        ) : session.isLoading || !url || !explorerConfig ? (
          <>
            <AnimatePresence>
              <Overlay>
                <CenteredSpinner />
              </Overlay>
            </AnimatePresence>
          </>
        ) : (
          <>
            <Iframe
              ref={iframeRef}
              src={url}
              onLoad={() => setIsLoading(false)}
              key={`${explorerVersion}:${url}`}
            />

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
