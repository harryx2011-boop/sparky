// Entry for the Sparky 2.0 comps page: http://localhost:4601/prototypes/file-manager/ under npm run dev:ui.
import { createRoot } from 'react-dom/client'
import '../../src/index.css'
import './moods.css'
import { CompsApp } from './CompsApp'

createRoot(document.getElementById('root')!).render(<CompsApp />)
