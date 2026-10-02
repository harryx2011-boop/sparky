import { MotionConfig } from 'motion/react'
import { Footer } from './components/Footer'
import { GridCells } from './components/GridCells'
import { ScrollProgress } from './components/motion'
import { Nav } from './components/Nav'
import { SiteStrip } from './components/SiteStrip'
import { Convert } from './sections/Convert'
import { Details } from './sections/Details'
import { DragDemo } from './sections/DragDemo'
import { Download } from './sections/Download'
import { Get } from './sections/Get'
import { Hero } from './sections/Hero'
import { Tools } from './sections/Tools'
import { DemoProvider } from './state'

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <DemoProvider>
        <a href="#watch" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground">
          Skip to content
        </a>
        <GridCells />
        <ScrollProgress />
        <Nav />
        <main>
          <Hero />
          <DragDemo />
          <Convert />
          <Download />
          <SiteStrip />
          <Details />
          <Tools />
          <Get />
        </main>
        <Footer />
      </DemoProvider>
    </MotionConfig>
  )
}
