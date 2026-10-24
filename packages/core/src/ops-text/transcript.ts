// Labels and messages for the transcript op. Every user-facing string for it lives here.
export const TRANSCRIPT_TEXT = {
  label: 'Get the transcript of a video',
  done: 'Transcript saved',
  title: (url: string) => `Transcript of ${url}`,
  fields: {
    urls: { title: 'Links', description: 'The video pages to read the words of. Each link becomes its own transcript file. Nothing is downloaded but the captions.' },
    langs: { title: 'Caption languages', description: 'Language codes such as en or es, best first. English when left empty.' },
    timestamps: { title: 'Time marks', description: 'true puts the start time, like [01:23], in front of each line. false (default) writes plain text.' },
  },
  tooBig: 'The caption file is too large to read (over 20 MB).',
  noCaptions: 'This video has no captions in the chosen languages. To get its words, download the audio and read it with a speech-to-text tool.',
} as const
