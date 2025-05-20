import { useIsMobile } from '@looped/hooks';
import { useUser } from '@metorial/state';
import { Tooltip } from '@metorial/ui';
import { RiCloseLine, RiTerminalBoxLine } from '@remixicon/react';
import { motion } from 'motion/react';
import { Resizable } from 're-resizable';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import styled from 'styled-components';
import { ServerListing } from '../../../../../../../state/server';
import { openCreateServerInstanceModal } from '../deploy/createForm';
import { useExplorerState } from './context';

let Placeholder = styled(motion.button)`
  background: #efefef;
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: 50px;
  border-radius: 10px 10px 0 0;
  border: 1px solid #ddd;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
  display: flex;
  padding: 0px 20px;
  color: #333;
  align-items: center;
  gap: 10px;
  z-index: 100;

  p {
    font-size: 12px;
    font-weight: 500;
  }

  svg {
    height: 20px;
    width: 20px;
  }

  @media (max-width: 700px) {
    display: none;
  }
`;

let Bar = styled(Resizable)`
  background: #efefef;
  position: fixed !important;
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: 10px 10px 0 0;
  border: 1px solid #ddd;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
  display: flex;
  color: #333;
  align-items: center;
  z-index: 105;
  max-height: min(90vh, calc(100vh - 200px));
  overflow: hidden;

  @media (max-width: 700px) {
    display: none;
  }
`;

let BarRelative = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
`;

let BarIndicator = styled.div`
  position: absolute;
  top: 2px;
  left: calc(50% - 50px);
  right: calc(50% - 50px);
  height: 5px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 50px;
`;

let CloseButton = styled.button`
  position: absolute;
  top: 10px;
  right: 10px;
  background: transparent;
  border: none;
  outline: none;
  cursor: pointer;
  color: #999;
  font-size: 20px;
  transition: all 0.2s ease-in-out;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover,
  &:focus {
    color: #444;
    background: rgba(0, 0, 0, 0.1);
  }
`;

let Iframe = styled.iframe`
  width: 100%;
  height: 100%;
  border: none;
  user-select: none;
`;

export let ExplorerRoot = ({ server }: { server: ServerListing }) => {
  let [isOpen, setIsOpen] = useExplorerState();
  let instances = useServerInstances(server);
  let isMobile = useIsMobile(700);
  let token = useEnsureToken();
  let user = useUser();

  let createDialogShowRef = useRef(0);
  useEffect(() => {
    let now = Date.now();
    if (
      !isOpen ||
      isMobile ||
      instances.data?.items.length ||
      createDialogShowRef.current > now
    )
      return;
    createDialogShowRef.current = now + 1000;

    openCreateServerInstanceModal(server);
    setTimeout(() => setIsOpen(false), 100);
  }, [isOpen, isMobile]);

  useEffect(() => {
    if (!isOpen || !isMobile) return;

    toast.error(
      'MCP Explorer is not available on mobile devices. Please use a desktop browser.'
    );
    setIsOpen(false);
  }, [isOpen, isMobile]);

  useEffect(() => {
    if (!isOpen || user.data) return;

    toast.error('You must be logged in to use the MCP Explorer. Please log in and try again.');
    setIsOpen(false);
  }, [isOpen, user]);

  if (!user.data) return null;

  if (!instances.data) return null;
  let instance = instances.data.items[0];

  if (!isOpen || !instance) {
    return (
      <Placeholder
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        transition={{ duration: 0.3, ease: 'anticipate' }}
        onClick={() => setIsOpen(true)}
      >
        <RiTerminalBoxLine />
        <p>Open {server.name} in MCP Explorer</p>
      </Placeholder>
    );
  }

  let url = new URL('http://10.10.1.1:6050'); // https://inspector.mcp.metorial.com
  url.searchParams.set('sse_url', `http://chronos:3100/mcp/${instance.identifier}/sse`);
  url.searchParams.set('transport_type', 'sse');
  if (token) url.searchParams.set('bearer_token', token);

  return (
    <Bar
      defaultSize={{
        height: 700
      }}
      onResizeStop={(e, direction, ref, d) => {
        let height = parseInt(ref.style.height);
        if (height < 200) setIsOpen(false);
        // if (height < 400) height = 400;
        ref.style.height = `${height}px`;
      }}
    >
      <BarRelative>
        <BarIndicator />

        <Tooltip content="Close">
          <CloseButton onClick={() => setIsOpen(false)}>
            <RiCloseLine />
          </CloseButton>
        </Tooltip>

        <div
          style={{
            height: '100%',
            width: '100%'
          }}
          // ref={el => {
          //   if (!token) return;

          //   let iframe = getIframeForInstance(instance, token);
          //   el?.appendChild(iframe);
          // }}
        >
          <Iframe
            src={url.toString()}
            title="MCP Explorer"
            sandbox="allow-same-origin allow-scripts allow-modals allow-forms"
            loading="lazy"
          />
        </div>
      </BarRelative>
    </Bar>
  );
};
