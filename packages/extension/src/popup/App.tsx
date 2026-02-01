import { Toaster } from '@/shared/components/ui/sonner'
import './App.css'
import { Header } from './components/Header'
import { Content } from './components/Content'
import { Footer } from './components/Footer'
import { useEffect } from 'react'
import { loadBackgroundState } from './lib/state'


function App() {
  useEffect(()=>{
    loadBackgroundState()
  },[])
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
