import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import { initializeThemePreference } from './theme/themeRuntime'

initializeThemePreference()
const app = createApp(App)
app.use(createPinia())
app.mount('#app')
