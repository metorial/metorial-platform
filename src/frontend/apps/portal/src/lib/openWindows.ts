export let openWindow = (url: string) => {
  let height = 750;
  let width = 600;

  let top = window.innerHeight / 2 - height / 2;
  let left = window.innerWidth / 2 - width / 2;

  let win = window.open(
    url,
    '_blank',
    `height=${height},width=${width},top=${top},left=${left},resizable=no,scrollbars=yes,status=no,toolbar=no,menubar=no,location=no`
  );

  return {
    close: () => win?.close(),
    focus: () => win?.focus(),
    onClose: (cb: () => void) => {
      let interval = setInterval(() => {
        if (win?.closed) {
          clearInterval(interval);
          cb();
        }
      }, 100);

      return () => clearInterval(interval);
    },
    onMessage: (cb: (e: MessageEvent) => void) => {
      let innerCb = (e: MessageEvent) => {
        // if (e.origin !== window.location.origin) return;
        cb(e);
      };

      window.addEventListener('message', innerCb);
      return () => window.removeEventListener('message', innerCb);
    }
  };
};

export let sendMessageToOpener = (message: any) => {
  window.opener.postMessage(message, window.location.origin);
};
