export let onFocus = (handler: () => void) => {
  let listener = () => {
    if (document.hasFocus()) handler();
  };

  window.addEventListener('focus', listener);

  return () => {
    window.removeEventListener('focus', listener);
  };
};
