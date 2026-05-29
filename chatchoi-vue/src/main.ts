import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import { initializeAppearance } from './theme/appearanceRuntime'

initializeAppearance()
const app = createApp(App)
app.use(createPinia())
app.mount('#app')
