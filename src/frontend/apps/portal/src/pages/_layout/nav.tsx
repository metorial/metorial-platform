import { Logo, theme } from '@metorial/ui';
import { RiArrowRightSLine } from '@remixicon/react';
import styled from 'styled-components';
import { useConsumer } from '../../state/consumer/consumer';
import { usePortal } from '../../state/portal/client';
import { UserMenu } from './user';

let Wrapper = styled.header`
  padding: 10px 16px 8px 8px;
`;

let Inner = styled.nav`
  display: grid;
  gap: 12px;
  height: 54px;
  align-items: center;
  grid-template-columns: minmax(0, 1fr) auto;
`;

let LogoPart = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding-left: 10px;

  svg {
    flex-shrink: 0;
  }
`;

let Breadcrumb = styled.div`
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;

  span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  i {
    display: flex;
    color: ${theme.colors.gray900};
  }
`;

let ActionsPart = styled.div`
  display: flex;
  justify-content: flex-end;
`;

export let PortalNav = () => {
  let consumer = useConsumer();
  let portal = usePortal();

  return (
    <Wrapper
      style={{
        opacity: consumer.isLoading ? 0 : 1,
        transition: 'opacity 0.2s ease'
      }}
    >
      <Inner>
        <LogoPart>
          <Logo size={30} color="#000000" />

          <Breadcrumb>
            <span>Metorial</span>
            <i>
              <RiArrowRightSLine />
            </i>
            <span>{portal.data?.name || 'Portal'}</span>
          </Breadcrumb>
        </LogoPart>

        <ActionsPart>
          <UserMenu />
        </ActionsPart>
      </Inner>
    </Wrapper>
  );
};
