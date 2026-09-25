// Form labels (`title`), help text (`description`) and choice words (`labels`) for the convert and download ops' input fields.
import { COMPRESSION_LEVELS, PERFORMANCE_LEVELS, RESOLUTIONS, resolutionLabel } from '../levels'

const heightLabels = Object.fromEntries(RESOLUTIONS.map((r) => [String(r), resolutionLabel(r)]))

const compression = {
  title: 'Compression',
  description: 'From 0 (keeps full quality) to 4 (smallest file). The compression setting when left empty.',
  labels: Object.fromEntries(COMPRESSION_LEVELS.map((l) => [String(l.level), l.label])),
}

const performance = {
  title: 'Speed',
  description: 'How much of the PC Sparky uses while it works. The performance setting when left empty.',
  labels: Object.fromEntries(PERFORMANCE_LEVELS.map((l) => [l.id, `${l.label}: ${l.outcome.toLowerCase()}`])),
}

const fromSettings = 'The download setting when left empty.'

export const CONVERT_TEXT = {
  fields: {
    files: { title: 'Files', description: 'The files to convert. Each one becomes its own job.' },
    output: { title: 'Convert to', description: 'The format to make, such as mp4, mp3, jpg or pdf. The file’s own format makes a smaller copy instead.' },
    compression,
    resolution: {
      title: 'Video size',
      description: 'How tall the video is. Same as the file when left empty.',
      labels: { source: 'Same as the file', ...heightLabels },
    },
    performance,
    originals: {
      title: 'Originals',
      description: 'What happens to each original once its new version is ready. Kept when left empty.',
      labels: { keep: 'Keep them', replace: 'Replace them with the new file', trash: 'Move them to the Recycle Bin' },
    },
    codec: {
      title: 'Video type',
      description: 'Standard plays everywhere. Smaller and Smallest make lighter files that older devices may not play. Sparky picks one when left empty.',
      labels: { h264: 'Standard (H.264)', hevc: 'Smaller (HEVC)', av1: 'Smallest (AV1)' },
    },
    videoKbps: { title: 'Video data rate', description: 'Kilobits per second; leave empty to use the compression level.' },
    audioKbps: { title: 'Audio data rate', description: 'Kilobits per second; leave empty to use the compression level.' },
    imageQuality: { title: 'Picture quality', description: 'From 1 to 100. Higher looks better and makes bigger files. Leave empty to use the compression level.' },
    trimStart: { title: 'Start at (seconds)', description: 'Where the new file begins, in seconds from the start. The beginning when left empty.' },
    trimEnd: { title: 'End at (seconds)', description: 'Where the new file stops, in seconds from the start. The end when left empty.' },
    width: { title: 'Width (pixels)', description: 'For pictures and GIFs. Setting only width or height keeps the shape. The original size when left empty.' },
    height: { title: 'Height (pixels)', description: 'For pictures and GIFs. Setting only width or height keeps the shape. The original size when left empty.' },
    fps: { title: 'Frames per second', description: 'For GIFs. Fewer frames make a smaller file. Set by the compression level when left empty.' },
  },
} as const

export const DOWNLOAD_TEXT = {
  fields: {
    urls: { title: 'Links', description: 'The pages to download from, such as a video or a playlist. Each link becomes its own job.' },
    title: { title: 'Queue title', description: 'The name shown in the queue. The link when left empty.' },
    mode: {
      title: 'Save as',
      description: `Video keeps the picture and sound; Audio only saves just the sound. ${fromSettings}`,
      labels: { video: 'Video', audio: 'Audio only' },
    },
    quality: {
      title: 'Video quality',
      description: 'The tallest video to fetch. The best on offer when left empty.',
      labels: { best: 'Best available', ...heightLabels },
    },
    items: { title: 'Playlist items', description: 'Positions in the playlist to download, counting from 1. Every item when left empty.' },
    count: { title: 'Number of items', description: 'How many files this download makes, used only to show overall progress.' },
    convertTo: { title: 'Then convert to', description: 'A format to turn the download into in the same job, such as mp4 or mp3. Kept as downloaded when left empty.' },
    compression,
    performance,
    thumbnail: { title: 'Cover art', description: `Saves the video’s picture inside the file. ${fromSettings}` },
    subtitles: {
      title: 'Subtitles',
      description: `A separate file next to the download, or inside the video. ${fromSettings}`,
      labels: { off: 'Off', download: 'Separate file', embed: 'Inside the video' },
    },
    subtitleLangs: { title: 'Subtitle languages', description: `Language codes such as en or es. ${fromSettings}` },
    metadata: { title: 'Titles, artist and chapters', description: `So a music app shows the right names. ${fromSettings}` },
    sponsorBlock: { title: 'Skip sponsor segments', description: `Cuts out ad reads, intros and self-promotion. ${fromSettings}` },
  },
} as const
