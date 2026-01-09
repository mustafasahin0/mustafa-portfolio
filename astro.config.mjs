import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import mdx from '@astrojs/mdx';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://mustafasahin.dpdns.org',
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [mdx(), tailwind()],
  image: {
    service: { entrypoint: 'astro/assets/services/noop' }
  },
  server: {
    host: '0.0.0.0',
    port: 4321
  },
  vite: {
    server: {
      allowedHosts: ['mustafasahin.dpdns.org']
    }
  }
});