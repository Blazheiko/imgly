import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from '@/app/App.vue'
import { registerServiceWorker } from '@/app/pwa'
import '@/shared/styles/tokens.css'

createApp(App).use(createPinia()).mount('#app')

if (import.meta.env.PROD) registerServiceWorker()
