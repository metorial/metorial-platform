import { useIsSSR } from '@looped/hooks';
import { redirectToLogout, useUser } from '@metorial/state';
import { Avatar, Button, Spacer, theme } from '@metorial/ui';
import * as Popover from '@radix-ui/react-popover';
import { keyframes, styled } from 'styled-components';

export let fadeInDown = keyframes`
  from {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

export let fadeOutUp = keyframes`
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
  }
`;

let Trigger = styled(Popover.Trigger)`
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: none;
  padding: 0;
  background: none;
`;

let Content = styled(Popover.Content)`
  background: rgba(245, 245, 245, 0.7);
  backdrop-filter: blur(10px);
  border-radius: 15px;
  border: solid 1px ${theme.colors.gray400};
  padding: 0px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
  font-size: 14px;
  color: #333;
  width: 350px;
  overflow: hidden;
  z-index: 1;
  display: flex;
  flex-direction: column;
  z-index: 999;

  &[data-state='open'] {
    animation: ${fadeInDown} 0.2s cubic-bezier(0.22, 1, 0.36, 1);
  }

  &[data-state='closed'] {
    animation: ${fadeOutUp} 0.2s cubic-bezier(0.22, 1, 0.36, 1);
  }
`;

let Header = styled.header`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 15px;
  border-bottom: solid 1px ${theme.colors.gray400};
  padding-top: 50px;
  padding-bottom: 35px;
  text-align: center;
`;

let Name = styled.h1`
  font-size: 18px;
  font-weight: 600;
  color: #333;
`;

let Email = styled.p`
  font-size: 14px;
  font-weight: 500;
  color: #666;
`;

let Actions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 15px;
`;

export let UserMenu = () => {
  let user = useUser();
  let isServer = useIsSSR();

  if (isServer) return null;

  let accountFrontend = process.env.ACCOUNT_FRONTEND_URL;

  return (
    <Popover.Root>
      <Trigger aria-label="Open user menu">
        <Avatar entity={user.data} size={30} />
      </Trigger>
      <Popover.Portal>
        <Content sideOffset={5} align="center" side="bottom">
          <Header>
            <Avatar entity={user.data} size={100} />

            <div>
              <Name>{user.data?.name}</Name>
              <Spacer size={5} />
              <Email>{user.data?.email}</Email>
            </div>
          </Header>

          <Actions>
            {accountFrontend && (
              <a href={accountFrontend}>
                <Button size="2" fullWidth variant="solid">
                  Account
                </Button>
              </a>
            )}

            <Button size="2" fullWidth variant="outline" onClick={redirectToLogout}>
              Logout
            </Button>
          </Actions>
        </Content>
      </Popover.Portal>
    </Popover.Root>
  );
};
