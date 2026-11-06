// Registry of the three Sparky 2.0 comp moods; each id has a matching block in moods.css.

export interface Mood {
  id: 'workbench' | 'livewire' | 'frost'
  name: string
  concept: string
  folderHeading: boolean
}

export const MOODS: Mood[] = [
  { id: 'workbench', name: 'Workbench', concept: 'Calm and dense. Everything in reach, nothing shouts; lime marks only what you touched.', folderHeading: false },
  { id: 'livewire', name: 'Live Wire', concept: 'Bold lime. Current runs through the folder: whatever is selected or running is lit.', folderHeading: true },
  { id: 'frost', name: 'Frost', concept: 'Glassy and translucent. Panels float over your desktop like Windows 11 Mica.', folderHeading: false },
]
