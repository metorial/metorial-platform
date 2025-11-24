import { Logo, theme } from '@metorial/ui';
import { RiArrowRightSLine, RiSearch2Line } from '@remixicon/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import styled from 'styled-components';
import { useConsumer } from '../../state/consumer/consumer';
import { usePortal } from '../../state/portal/client';
import { SearchMenu } from './search';
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
  color: #222;
  padding-left: 10px;

  svg {
    height: 30px;
    flex-shrink: 0;
  }

  h1 {
    font-size: 18px;
    margin-left: 10px;
    display: flex;
    align-items: center;
    gap: 5px;
    flex-shrink: 0;
    font-weight: 600;

    i {
      display: flex;
      align-items: center;
      justify-content: center;
      font-style: normal;
      color: #888;

      svg {
        width: 16px;
        height: 16px;
      }
    }
  }
`;

let SearchPart = styled(Part)`
  justify-content: center;
`;

let SearchButton = styled(motion.button)`
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

export let PortalNav = () => {
  let [open, setOpen] = useState(false);
  let consumer = useConsumer();
  let portal = usePortal();

  return (
    <Wrapper
      style={{
        opacity: consumer.isLoading ? 0 : 1,
        transition: 'opacity 0.2s'
      }}
    >
      <Inner
        style={{
          gridTemplateColumns: '1fr 1fr 1fr'
        }}
      >
        <LogoPart>
          <Logo size={30} color="#000000" />

          <h1>
            <span>Metorial</span>
            <i>
              <RiArrowRightSLine />
            </i>
            <span>{portal.data?.name}</span>
          </h1>
        </LogoPart>

        <SearchPart>
          <AnimatePresence>
            <SearchButton
              onClick={() => setOpen(!open)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <RiSearch2Line />
              <span>Search</span>
            </SearchButton>
          </AnimatePresence>
        </SearchPart>

        <ActionsPart>
          <UserMenu />
        </ActionsPart>

        <SearchMenu open={open} setOpen={setOpen} />
      </Inner>
    </Wrapper>
  );
};
