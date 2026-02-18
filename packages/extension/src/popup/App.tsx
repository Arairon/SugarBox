import { Toaster } from '@/shared/components/ui/sonner'
import './App.css'
import { Header } from './components/Header'
import { Content } from './components/Content'
import { Footer } from './components/Footer'
import { useEffect } from 'react'
import { loadBackgroundState, updateCurrentTabInBackground } from './lib/state'
import { refreshUser, requestSync } from './lib/user'


function App() {
  useEffect(() => {
    updateCurrentTabInBackground().then(() => {
      loadBackgroundState()
    })
    refreshUser()
    requestSync()
  }, [])
  return (
    <>
      <Toaster closeButton={true} />
      <Header />
      <Content />
      <Footer />
    </>
  )
}

export default App
