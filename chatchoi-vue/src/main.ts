import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import { initializeAppearance } from './theme/appearanceRuntime'
import { initializeLocalization } from './i18n/localizationRuntime'
import { i18n } from './i18n'

initializeAppearance()
initializeLocalization()

const app = createApp(App)
app.use(createPinia())
app.use(i18n)
app.mount('#app')
