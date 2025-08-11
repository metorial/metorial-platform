import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import styled, { keyframes } from 'styled-components';

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
  background-image: radial-gradient(#222 1px, transparent 0);
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
    font-weight: 600;
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
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #ccc;
    color: #ccc;
    font-size: 14px;
    font-weight: 500;
    border-radius: 40px;
    z-index: 2;
    position: relative;
  }
`;

export let ManagedServersPage = () => {
  let instance = useCurrentInstance();

  return renderWithLoader({ instance })(({ instance }) => (
    <Wrapper>
      <span>Coming Soon</span>
      <h1>Metorial Managed MCP Servers</h1>
      <p>
        Run custom MCP servers managed by Metorial, with all the features you love. Deploy them
        on your own infrastructure or use our managed hosting.
      </p>
    </Wrapper>
  ));
};
