import { theme } from '@metorial/ui';
import styled from 'styled-components';

let METORIAL_URL = 'https://metorial.com';
let METORIAL_LOGO_URL =
  'https://cdn.metorial.com/2025-06-13--14-59-55/logos/metorial/primary_logo/raw.svg';

let Wrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 12px;
  color: ${theme.colors.gray650};
`;

let Link = styled.a`
  display: flex;
  align-items: center;
  gap: 3px;
  color: ${theme.colors.gray900};
  text-decoration: none;
  font-weight: 500;
`;

let Logo = styled.img`
  width: 14px;
  height: 14px;
  border-radius: 3px;
`;

export let SecuredByFooter = () => (
  <Wrapper>
    <span>Secured by</span>

    <Link href={METORIAL_URL} target="_blank" rel="noopener noreferrer">
      <Logo src={METORIAL_LOGO_URL} alt="Metorial" />
      Metorial
    </Link>
  </Wrapper>
);
