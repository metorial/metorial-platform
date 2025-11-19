import { useEnterpriseUser } from '@metorial-enterprise/federation-state';
import { SwitcherHorizontal } from '@metorial/layout/src/applicationLayout/switcher';
import { useCurrentInstance } from '@metorial/state';
import { theme } from '@metorial/ui';
import { RiSearch2Line } from '@remixicon/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import styled from 'styled-components';
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

  svg {
    height: 30px;
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

export let EnterpriseNav = () => {
  let user = useEnterpriseUser();
  let [open, setOpen] = useState(false);

  let instance = useCurrentInstance();

  return (
    <Wrapper
      style={{
        opacity: user.isLoading ? 0 : 1,
        transition: 'opacity 0.2s'
      }}
    >
      <Inner
        style={{
          gridTemplateColumns: '1fr 1fr 1fr'
        }}
      >
        <SwitcherHorizontal enabled />

        <SearchPart>
          <AnimatePresence>
            {instance.data && (
              <SearchButton
                onClick={() => setOpen(!open)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
              >
                <RiSearch2Line />
                <span>Search</span>
              </SearchButton>
            )}
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
