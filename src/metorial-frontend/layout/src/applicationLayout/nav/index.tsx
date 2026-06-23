import { useUser } from '@metorial/state';
import { Spacer, theme } from '@metorial/ui';
import React from 'react';
import { useParams } from 'react-router-dom';
import styled from 'styled-components';
import { SwitcherHorizontal } from '../switcher/switcherHorizontal';
import { UserMenu } from './user';

let Wrapper = styled.header`
  padding: 5px 15px 5px 5px;
`;

let Inner = styled.nav`
  display: grid;
  gap: 15px;
  height: 50px;
`;

let Part = styled.div`
  height: 100%;
  display: flex;
  align-items: center;
`;

let LogoPart = styled(Part)`
  width: 30px;
  justify-content: flex-start;

  svg {
    height: 30px;
  }
`;

let SearchPart = styled(Part)`
  justify-content: center;
`;

let SearchButton = styled.button`
  height: 40px;
  display: flex;
  align-items: center;
  padding: 0 15px;
  border-radius: 8px;
  background: ${theme.colors.gray400};
  border: none;
  gap: 10px;
  font-size: 14px;
  max-width: 400px;
  width: 100%;

  svg {
    height: 16px;
    width: 16px;
  }
`;

let ActionsPart = styled(Part)`
  gap: 15px;
  justify-content: flex-end;
`;

export let OssApplicationLayoutNav = () => {
  let user = useUser();
  let params = useParams<{ organizationId: string; instanceId: string }>();
  if (!params.organizationId && !params.instanceId) return <Spacer height={10} />;

  return (
    <Wrapper
      style={{
        opacity: user.isLoading ? 0 : 1,
        transition: 'opacity 0.2s'
      }}
    >
      <Inner
        style={{
          gridTemplateColumns: '1fr 1fr'
        }}
      >
        <SwitcherHorizontal enabled />

        <ActionsPart>
          <UserMenu />
        </ActionsPart>
      </Inner>
    </Wrapper>
  );
};
