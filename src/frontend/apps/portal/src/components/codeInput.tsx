import { OTPInput, SlotProps } from 'input-otp';
import { styled } from 'styled-components';

let Wrapper = styled('div')`
  display: flex;
  gap: 10px;
  align-items: center;
`;

let SlotWrapper = styled('div')`
  height: 55px;
  width: 40px;
  border: 1px solid #ddd;
  position: relative;

  font-size: 20px;
  font-weight: 500;
  color: #555;

  display: flex;
  justify-content: center;
  align-items: center;

  &:first-child {
    border-top-left-radius: 10px;
    border-bottom-left-radius: 10px;
  }

  &:last-child {
    border-top-right-radius: 10px;
    border-bottom-right-radius: 10px;
  }

  &:not(:last-child) {
    border-right: none;
  }
`;

let Slot = (props: SlotProps) => {
  return (
    <SlotWrapper>
      {props.char !== null && <div>{props.char}</div>}
      {props.hasFakeCaret && <FakeCaret />}
    </SlotWrapper>
  );
};

let FakeCaret = () => {
  return (
    <div
      style={{
        position: 'absolute',
        pointerEvents: 'none',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}
    >
      <div
        style={{
          width: 1,
          height: 30,
          backgroundColor: '#000'
        }}
      />
    </div>
  );
};

let FakeDash = () => {
  return (
    <div
      style={{
        width: 40,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}
    >
      <div
        style={{
          width: 12,
          height: 2,
          backgroundColor: '#ccc'
        }}
      />
    </div>
  );
};

export let CodeInput = ({
  onComplete,
  disabled
}: {
  onComplete: (code: string) => void;
  disabled?: boolean;
}) => {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center'
      }}
    >
      <OTPInput
        maxLength={6}
        style={{ display: 'flex' }}
        onChange={code => {
          if (code.length == 6) onComplete(code);
        }}
        inputMode="numeric"
        disabled={disabled}
        pasteTransformer={pasted => pasted.replace(/[^0-9]/g, '')}
        render={({ slots }) => (
          <Wrapper>
            <div style={{ display: 'flex' }}>
              {slots.slice(0, 3).map((slot, idx) => (
                <Slot key={idx} {...slot} />
              ))}
            </div>

            <FakeDash />

            <div style={{ display: 'flex' }}>
              {slots.slice(3).map((slot, idx) => (
                <Slot key={idx} {...slot} />
              ))}
            </div>
          </Wrapper>
        )}
      />
    </div>
  );
};
