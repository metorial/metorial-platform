/** @type {import('vite').UserConfig} */
export default {
  base: process.env.CODE_WORKSPACE_BASE ?? '/',

  server: {
    host: true,
    port: Number(process.env.PORT) || 3302,
    allowedHosts: ['vulcan', 'localhost']
  }
};
