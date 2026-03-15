import '@fontsource-variable/inter'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ReaderProvider } from './context/ReaderContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ReaderProvider>
      <App />
    </ReaderProvider>
  </StrictMode>,
)
