import { defineNuxtConfig } from 'nuxt/config';

export default defineNuxtConfig({
  ssr: true,
  css: ['~/assets/css/theme.css'],
  modules: ['@nuxtjs/color-mode'],
  colorMode: {
    preference: 'system',
    fallback: 'light',
    classSuffix: ''
  },
  nitro: {
    preset: 'node'
  },
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || '/api'
    }
  }
});
