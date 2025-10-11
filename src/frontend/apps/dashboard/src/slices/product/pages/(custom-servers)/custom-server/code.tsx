import { renderWithLoader } from '@metorial/data-hooks';
import { getConfig, Paths } from '@metorial/frontend-config';
import {
  useCreateCustomServerVersion,
  useCurrentInstance,
  useCustomServer,
  useCustomServerCodeEditorToken
} from '@metorial/state';
import { Button, Spacer, theme } from '@metorial/ui';
import { SideBox } from '@metorial/ui-product';
import { RiArrowRightSLine, RiExpandDiagonal2Line, RiUpload2Line } from '@remixicon/react';
import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';

let Wrapper = styled.div`
  &[data-expanded='true'] {
    overflow: hidden;
    position: fixed;
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
    z-index: 99999;
  }

  &[data-expanded='false'] {
    border: 1px solid ${theme.colors.gray400};
    border-radius: 12px;
    overflow: hidden;
    position: relative;
    width: 100%;
    height: calc(95vh - 300px);
  }
`;

let Nav = styled(motion.nav)`
  position: absolute;
  top: 0;
  left: 0;
  height: 34px;
  display: flex;
  align-items: center;
  padding: 0 5px;
  gap: 6px;
`;

let Iframe = styled.iframe`
  width: 100%;
  height: 100%;
  border: none;
  border-radius: inherit;
  background: #fff;
`;

export let CustomServerCodePage = () => {
  let instance = useCurrentInstance();

  let { customServerId } = useParams();
  let customServer = useCustomServer(instance.data?.id, customServerId);

  let editorToken = useCustomServerCodeEditorToken(instance.data?.id, customServer.data?.id);

  let [isExpanded, setIsExpanded] = useState(false);

  let url = useMemo(() => {
    if (!editorToken.data) return null;
    let url = new URL(getConfig().microFrontends.codeEditorUrl!);
    url.searchParams.set('token', editorToken.data.token);
    url.searchParams.set('id', editorToken.data.id);
    return url.toString();
  }, [editorToken.data?.token]);

  let createVersion = useCreateCustomServerVersion();
  let navigate = useNavigate();

  return renderWithLoader({ customServer, editorToken })(({ customServer, editorToken }) => (
    <>
      {customServer.data.repository && (
        <>
          <SideBox
            title="Repository"
            description="Code is managed through the connected repository."
          >
            <Button
              as="span"
              size="2"
              onClick={async () => {
                window.open(customServer.data.repository!.url, '_blank');
              }}
              iconRight={<RiArrowRightSLine />}
            >
              View Repository
            </Button>
          </SideBox>
          <Spacer height={15} />
        </>
      )}

      <Wrapper data-expanded={isExpanded}>
        <Nav
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 2 }}
        >
          <Button
            size="1"
            iconLeft={<RiExpandDiagonal2Line />}
            onClick={() => setIsExpanded(v => !v)}
          >
            {isExpanded ? 'Exit Fullscreen' : 'Fullscreen'}
          </Button>

          <Button
            size="1"
            iconLeft={<RiUpload2Line />}
            onClick={async () => {
              let [version] = await createVersion.mutate({
                instanceId: instance.data!.id,
                customServerId: customServer.data!.id,
                implementation: {
                  type: 'managed',
                  managedServer: {}
                }
              });

              if (version) {
                navigate(
                  Paths.instance.customServer(
                    instance.data?.organization,
                    instance.data?.project,
                    instance.data,
                    version.customServerId,
                    'versions',
                    { version_id: version.id }
                  )
                );
              }
            }}
          >
            Publish New Version
          </Button>
        </Nav>

        <Iframe src={url!} title={customServer.data?.name ?? 'Code Editor'} />
      </Wrapper>
    </>
  ));
};
