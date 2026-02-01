import { Toaster } from '@/shared/components/ui/sonner'
import './App.css'
import { Header } from './components/Header'
import { Content } from './components/Content'
import { Footer } from './components/Footer'


function App() {
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
