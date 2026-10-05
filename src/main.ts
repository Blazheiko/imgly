import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from '@/app/App.vue'
import { registerServiceWorker } from '@/app/pwa'
import '@/shared/styles/tokens.css'

const pinia = createPinia()
createApp(App).use(pinia).mount('#app')

if (import.meta.env.VITE_E2E_HOOKS === 'true') {
  void import('@/app/test-hooks').then(({ installTestHooks }) => installTestHooks(pinia))
}

if (import.meta.env.PROD) registerServiceWorker()
