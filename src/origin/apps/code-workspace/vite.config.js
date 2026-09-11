/** @type {import('vite').UserConfig} */
export default {
  server: {
    host: true,
    port: Number(process.env.PORT) || 3302,
    allowedHosts: ['vulcan', 'localhost']
  }
};
