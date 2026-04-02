import { useUser } from '@metorial/state';
import { Avatar, Button, Spacer, theme } from '@metorial/ui';
import * as Popover from '@radix-ui/react-popover';
import { styled } from 'styled-components';
import { useConsumer } from '../../state/consumer/consumer';

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
  let consumer = useConsumer();
  let user = useUser();
  let logoutMutator = consumer.useLogout();

  if (!consumer.data) return null;

  let avatarEntity = {
    name: user.data?.name || consumer.data.name || consumer.data.email,
    email: user.data?.email || consumer.data.email,
    imageUrl: user.data?.imageUrl || consumer.data.imageUrl
  };

  return (
    <Popover.Root>
      <Trigger aria-label="Open user menu">
        <Avatar entity={avatarEntity} size={30} />
      </Trigger>
      <Popover.Portal>
        <Content sideOffset={5} align="center" side="bottom">
          <Header>
            <Avatar entity={avatarEntity} size={100} />

            <div>
              <Name>{avatarEntity.name}</Name>
              <Spacer size={5} />
              <Email>{avatarEntity.email}</Email>
            </div>
          </Header>

          <Actions>
            <Button
              size="2"
              fullWidth
              variant="outline"
              onClick={() => {
                logoutMutator.mutate({});
              }}
            >
              Logout
            </Button>
          </Actions>
        </Content>
      </Popover.Portal>
    </Popover.Root>
  );
};
