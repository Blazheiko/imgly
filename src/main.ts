import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from '@/app/App.vue'
import { registerServiceWorker } from '@/app/pwa'
import '@/shared/styles/tokens.css'

const pinia = createPinia()
const app = createApp(App).use(pinia)

if (import.meta.env.VITE_E2E_HOOKS === 'true') {
  // Hooks go in before mount, so a hook that shapes start-up (a refused open) is in place first.
  void import('@/app/test-hooks').then(({ installTestHooks }) => {
    installTestHooks(pinia)
    app.mount('#app')
  })
} else {
  app.mount('#app')
}

if (import.meta.env.PROD) registerServiceWorker()
