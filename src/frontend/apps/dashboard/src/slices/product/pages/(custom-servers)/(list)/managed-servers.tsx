import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useDashboardFlags } from '@metorial/state';
import styled, { keyframes } from 'styled-components';
import { CustomServersTable } from '../../../scenes/customServer/table';

let moveDots = keyframes`
  0% {
    background-position: 0 0;
  }
  100% {
    background-position: 18px 18px;
  }
`;

let Wrapper = styled.div`
  position: relative;
  background: #000;
  background-image: radial-gradient(#444 1px, transparent 0);
  background-size: 18px 18px;
  background-position: -10px -10px;
  animation: ${moveDots} 2s linear infinite;

  height: 600px;
  border-radius: 15px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);

  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px;
  text-align: center;

  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: radial-gradient(circle, transparent calc(100% - 300px), rgba(0, 0, 0, 1) 100%);
    pointer-events: none;
    z-index: 1;
  }

  h1 {
    color: #fff;
    font-size: 32px;
    font-weight: 700;
    margin-bottom: 30px;
    margin-top: 20px;
    z-index: 2;
    position: relative;
  }

  p {
    color: #ccc;
    font-size: 18px;
    font-weight: 500;
    max-width: 620px;
    z-index: 2;
    position: relative;
  }

  span {
    height: 26px;
    padding: 0 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #ccc;
    color: #ccc;
    font-size: 14px;
    font-weight: 500;
    border-radius: 40px;
    z-index: 2;
    position: relative;
    background: linear-gradient(90deg, rgba(50, 50, 50, 0.7), rgba(100, 100, 100, 0.7));
  }
`;

export let ManagedServersPage = () => {
  let instance = useCurrentInstance();
  let flags = useDashboardFlags();

  return renderWithLoader({ instance })(({ instance }) => (
    <>
      {flags.data?.flags['managed-servers-enabled'] ? (
        <CustomServersTable type="managed" />
      ) : (
        <Wrapper>
          <span>Coming Soon</span>
          <h1>Metorial Managed MCP Servers</h1>
          <p>
            Run custom MCP servers managed by Metorial, with all the features you love. Deploy
            them on your own infrastructure or use our managed hosting.
          </p>
        </Wrapper>
      )}
    </>
  ));
};
