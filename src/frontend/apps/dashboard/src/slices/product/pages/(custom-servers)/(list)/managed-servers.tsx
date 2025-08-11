import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import styled from 'styled-components';

let Wrapper = styled.div`
  background: linear-gradient(to right, #d6a4a4, #dae2f8);
  height: 600px;
`;

export let ManagedServersPage = () => {
  let instance = useCurrentInstance();

  return renderWithLoader({ instance })(({ instance }) => <Wrapper></Wrapper>);
};
