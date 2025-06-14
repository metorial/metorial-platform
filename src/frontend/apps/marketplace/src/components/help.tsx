'use client';

import { Logo } from '@metorial/ui';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { HelpCircle, MessageCircle, Star, User, X, Zap } from 'react-feather';
import { styled } from 'styled-components';

let Wrapper = styled.div`
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 5000;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 20px;

  @media (max-width: 600px) {
    display: none;
  }
`;

let Button = styled(motion.button)`
  height: 50px;
  width: 50px;
  border-radius: 50%;
  color: white;
  background: black;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  outline: none;
  border: none;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
  position: relative;

  &:hover {
    background: #333;
  }
`;

let Content = styled(motion.div)`
  width: 320px;
  max-width: calc(100% - 40px);
  max-height: calc(80% - 100px);
  overflow: hidden;
  background: white;
  border-radius: 10px;
  box-shadow: 0 0 15px rgba(0, 0, 0, 0.15);
`;

let Main = styled(motion.main)`
  padding: 30px;
  height: 100%;
`;

let Item = styled.a`
  display: flex;
  align-items: center;
  gap: 10px;
  opacity: 1;
  transition: all 0.2s ease-in-out;
  color: #666;
  background: none;
  border: none;
  outline: none;
  cursor: pointer;
  padding: 0;

  &:hover {
    color: black;
  }
`;

let ItemTitle = styled.span`
  font-size: 14px;
  font-weight: 500;
`;

let Items = styled.div`
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 15px;
`;

let Title = styled.h1`
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 5px;
`;

let Subtitle = styled.p`
  font-size: 14px;
  font-weight: 500;
  color: #666;
`;

let initialized = false;

export let Help = ({
  type = 'landing',
  onFeedbackClick,
  onSupportClick
}: {
  type?: 'landing' | 'dashboard';
  onFeedbackClick?: () => any;
  onSupportClick?: () => any;
}) => {
  let [open, setOpen] = useState(false);
  let [render, setRender] = useState(() => initialized);

  useEffect(() => {
    if (render) return;

    let to = setTimeout(() => {
      setRender(true);
      initialized = true;
    }, 1000);

    return () => clearTimeout(to);
  }, []);

  let items = [
    {
      title: 'Metorial',
      icon: <Logo size={18} />,
      href: 'https://metorial.com'
    },

    ...(type == 'landing'
      ? [
          {
            title: 'Login',
            icon: <User size={18} />,
            href: 'https://app.metorial.com'
          },
          {
            title: 'Early Access',
            icon: <Star size={18} />,
            href: 'https://metorial.com/early-access'
          }
        ]
      : [
          {
            title: 'Account',
            icon: <User size={18} />,
            href: 'https://app.metorial.com/account'
          },
          {
            title: 'Create Workspace',
            icon: <Zap size={18} />,
            href: 'https://app.metorial.com/welcome'
          }
        ]),
    {
      title: 'Support',
      icon: <HelpCircle size={18} />,

      ...(onSupportClick
        ? {
            onClick: () => {
              onSupportClick();
              setOpen(false);
            }
          }
        : {
            href: 'https://metorial.com/support'
          })
    },

    ...(onFeedbackClick
      ? [
          {
            title: 'Feedback',
            icon: <MessageCircle size={18} />,
            onClick: () => {
              onFeedbackClick();
              setOpen(false);
            }
          }
        ]
      : [])
  ];

  return (
    <Wrapper>
      <AnimatePresence>
        {open && (
          <Content
            initial={{ opacity: 0, y: 20, width: '320px', height: 'auto' }}
            animate={{
              opacity: 1,
              y: 0,

              width: '320px',
              height: 'auto'
            }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            <AnimatePresence>
              <Main
                key={'home'}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.2,
                  ease: 'easeInOut'
                }}
              >
                <Title>Welcome to Metorial</Title>
                <Subtitle>How can we help you today?</Subtitle>

                <Items>
                  {items.map(item => (
                    <Item href={item.href} key={item.href} onClick={(item as any).onClick}>
                      {item.icon}

                      <ItemTitle>{item.title}</ItemTitle>
                    </Item>
                  ))}
                </Items>
              </Main>
            </AnimatePresence>
          </Content>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {render && (
          <Button
            onClick={() => setOpen(!open)}
            initial={{ opacity: 0, scale: 0.3 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.5 }}
                transition={{ duration: 0.2, ease: 'anticipate' }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                key={open ? 'close' : 'open'}
              >
                {open ? <X /> : <MessageCircle />}
              </motion.div>
            </AnimatePresence>
          </Button>
        )}
      </AnimatePresence>
    </Wrapper>
  );
};
