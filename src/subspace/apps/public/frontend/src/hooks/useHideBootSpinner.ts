import { useEffect } from 'react';

let hideBootSpinner = () => {
  let bootEl = document.querySelector('.mte_boot');
  if (bootEl instanceof HTMLElement) {
    setTimeout(() => {
      bootEl.style.transition = 'opacity 0.25s ease-in-out';
      bootEl.style.opacity = '0';

      setTimeout(() => {
        bootEl.remove();
      }, 300);
    }, 100);
  }

  document.body.classList.remove('loading');
};

export let useHideBootSpinner = (ready: boolean) => {
  useEffect(() => {
    if (!ready) return;
    hideBootSpinner();
  }, [ready]);
};
