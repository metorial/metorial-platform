'use client';

import { AnimateHeight, Error, Spinner } from '@metorial/ui';
import styled from 'styled-components';
import { useUser } from '../../../../../../../state/client/auth';
import { useServerInstances } from '../../../../../../../state/client/serverInstance';
import { FullServer } from '../../../../../../../state/server';
import { CreateServerInstanceForm } from './createForm';
import { ServerInstanceUsage } from './instanceUsage';

let Wrapper = styled.div`
  padding: 30px;
  border: solid 1px #ddd;
  border-radius: 8px;
  /* min-height: 500px; */
  position: sticky;
  top: 150px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
  background: #fff;
`;

let Title = styled.h2`
  font-size: 1rem;
  color: #333;
  margin-bottom: 10px;

  span {
    font-weight: 600;
  }
`;

export let DeployBox = ({ server }: { server: FullServer }) => {
  let instances = useServerInstances(server);
  let user = useUser();

  return (
    <Wrapper>
      <AnimateHeight>
        <Title>
          Use <span>{server.name}</span>
        </Title>

        {user.isError ? (
          <CreateServerInstanceForm server={server} isUnauthenticated />
        ) : (
          <>
            {instances.isLoading && <Spinner />}
            {instances.isError && <Error>{instances.error.message}</Error>}
            {instances.data && (
              <>
                {!instances.data.items.length && <CreateServerInstanceForm server={server} />}

                {!!instances.data.items.length && (
                  <>
                    <ServerInstanceUsage instance={instances.data.items[0]} />
                  </>
                )}
              </>
            )}
          </>
        )}
      </AnimateHeight>
    </Wrapper>
  );
};
