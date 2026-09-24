import { Footer } from './components/Footer'
import { ScrollProgress } from './components/motion'
import { Nav } from './components/Nav'
import { Convert } from './sections/Convert'
import { Details } from './sections/Details'
import { DragDemo } from './sections/DragDemo'
import { Download } from './sections/Download'
import { Get } from './sections/Get'
import { Hero } from './sections/Hero'
import { Performance } from './sections/Performance'
import { Queue } from './sections/Queue'
import { DemoProvider } from './state'

export function App() {
  return (
    <DemoProvider>
      <a href="#watch" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground">
        Skip to content
      </a>
      <ScrollProgress />
      <Nav />
      <main>
        <Hero />
        <DragDemo />
        <Convert />
        <Download />
        <Performance />
        <Queue />
        <Details />
        <Get />
      </main>
      <Footer />
    </DemoProvider>
  )
}
