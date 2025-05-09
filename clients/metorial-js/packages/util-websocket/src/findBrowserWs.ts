export let findBrowserWs = (): typeof WebSocket | null => {
  if (typeof WebSocket !== 'undefined') return WebSocket;

  // @ts-ignore
  if (typeof MozWebSocket !== 'undefined') return MozWebSocket;

  // @ts-ignore
  if (typeof global !== 'undefined') return global.WebSocket || global.MozWebSocket;

  // @ts-ignore
  if (typeof window !== 'undefined') return window.WebSocket || window.MozWebSocket;

  // @ts-ignore
  if (typeof self !== 'undefined') return self.WebSocket || self.MozWebSocket;

  return null;
};
