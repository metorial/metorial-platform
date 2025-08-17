import { Button } from '@metorial/ui';
import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { useFormContext } from './context';

let Wrapper = styled.form`
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 100%;
`;

let Inner = styled.main`
  display: flex;
  flex-direction: column;
  gap: 15px;
  width: 100%;
  max-width: 100%;
`;

let Footer = styled.footer`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
`;

let Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
`;

let Errors = styled.div``;

export let FormWrapper = ({
  children,
  actionsWrapper,
  ...props
}: React.HTMLAttributes<HTMLFormElement> & {
  actionsWrapper?: ({ children }: { children: React.ReactNode }) => React.ReactNode;
  gap?: number;
}) => {
  let { form, mutators, submitName } = useFormContext();

  let errorMutator = mutators.find(m => m.error);
  let [submittedRecently, setSubmittedRecently] = useState(false);

  let isLoading = mutators.some(m => m.isLoading);
  let isSuccess = mutators.every(m => m.isSuccess);

  useEffect(() => {
    if (!isSuccess) setSubmittedRecently(false);
  }, [isSuccess]);

  let footer = (
    <Footer>
      <div>
        {errorMutator && (
          <Errors>
            <errorMutator.RenderError />
          </Errors>
        )}
      </div>

      <Actions>
        <Button
          type="submit"
          size="2"
          disabled={isLoading && !submittedRecently}
          loading={isLoading && !submittedRecently}
          success={isSuccess && submittedRecently}
        >
          {submitName ?? 'Save'}
        </Button>
      </Actions>
    </Footer>
  );

  if (actionsWrapper) {
    let W = actionsWrapper;
    footer = <W>{footer}</W>;
  }

  return (
    <Wrapper
      {...props}
      onSubmit={e => {
        setSubmittedRecently(true);
        setTimeout(() => setSubmittedRecently(false), 5000);
        return form.handleSubmit(e);
      }}
      style={{ gap: props.gap ?? 10 }}
    >
      <Inner>{children}</Inner>

      {footer}
    </Wrapper>
  );
};
