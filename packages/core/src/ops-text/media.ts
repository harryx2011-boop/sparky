// Labels and messages for the media ops. Every user-facing string for them lives here.
import { FORMATS } from '../formats'
import { COMPRESSION_LEVELS, PERFORMANCE_LEVELS } from '../levels'

const fileName = (p: string) => p.split(/[\\/]/).pop() ?? p

/** A form field's label and help text: the Tools page, the CLI help and the MCP tool list all read these. */
// A type, not an interface, so zod's .meta() takes it as is.
type FieldText = { title: string; description: string; labels?: Record<string, string> }

/** `labels` words each choice of a pick-one field, keyed by the value the op takes. */
const field = (title: string, description: string, labels?: Record<string, string>): FieldText => ({ title, description, ...(labels ? { labels } : {}) })

/** Video and sound formats, as the format picker words them. */
const OUTPUT_LABELS = Object.fromEntries(
  FORMATS.filter((f) => (f.category === 'video' && f.ext !== 'gif') || f.category === 'audio').map((f) => [f.ext, `${f.label} · ${f.note}`]),
)
const PERFORMANCE_LABELS = Object.fromEntries(PERFORMANCE_LEVELS.map((l) => [l.id, `${l.label} · ${l.outcome}`]))
const QUALITY_LABELS = Object.fromEntries(COMPRESSION_LEVELS.map((l) => [String(l.level), `${l.label} · ${l.hint}`]))

/** Fields more than one media op takes. */
const COMMON = {
  media: field('Files', 'The videos or sound files to work on.'),
  videos: field('Files', 'The videos to work on.'),
  trimStart: field('Start at', 'Seconds from the beginning. Everything before it is cut.'),
  trimEnd: field('End at', 'Seconds from the beginning. Everything after it is cut.'),
  performance: field('Performance', 'low keeps your PC quiet, max finishes fastest. Left out, the level from Settings.', PERFORMANCE_LABELS),
}

export const MEDIA_TEXT = {
  edit: {
    label: 'Edit a video or audio file',
    done: 'Edited',
    suffix: ' (edited)',
    title: (file: string) => `Edit ${fileName(file)}`,
    fields: {
      files: COMMON.media,
      output: field('Save as', 'The format of the result. Left out, it keeps the original’s format.', OUTPUT_LABELS),
      trimStart: COMMON.trimStart,
      trimEnd: COMMON.trimEnd,
      cropX: field('Crop from the left', 'Pixels from the left edge of the original. Leave this and the top out to centre the crop.'),
      cropY: field('Crop from the top', 'Pixels from the top edge of the original.'),
      cropWidth: field('Crop width', 'How wide the kept area is, in pixels of the original.'),
      cropHeight: field('Crop height', 'How tall the kept area is, in pixels of the original.'),
      rotate: field('Turn', 'Degrees clockwise.', { 90: 'A quarter to the right', 180: 'Upside down', 270: 'A quarter to the left' }),
      flip: field('Flip', 'h mirrors left to right, v turns it upside down, hv does both.', { h: 'Side to side', v: 'Upside down', hv: 'Both' }),
      width: field('Width', 'Finished width in pixels. Give only the width or only the height to keep the shape.'),
      height: field('Height', 'Finished height in pixels. Give only the width or only the height to keep the shape.'),
      fps: field('Frames per second', 'Fewer makes a smaller, less smooth video.'),
      stripAudio: field('Remove sound', 'Keep only the picture.'),
      volume: field('Volume', 'Percent of the original loudness: 100 leaves it as it is, 200 is twice as loud, 0 is silent.'),
      fadeIn: field('Fade in', 'Seconds to fade in from black and silence.'),
      fadeOut: field('Fade out', 'Seconds to fade out to black and silence at the end.'),
      reverse: field('Play backwards', 'Reverse the picture and the sound.'),
      speed: field('Speed', '2 plays twice as fast, 0.5 half as fast.'),
      compression: field('Quality', '0 keeps the most detail, 4 makes the smallest file. Left out, the level from Settings.', QUALITY_LABELS),
      performance: COMMON.performance,
    },
  },
  compress: {
    label: 'Make a video or audio file smaller',
    done: 'Made smaller',
    suffix: ' (smaller)',
    title: (file: string) => `Shrink ${fileName(file)}`,
    fields: {
      files: COMMON.media,
      target: field('Aim for', 'email and discord aim for sizes those services accept; web makes a small file that still looks good, archive keeps more detail. Left out, web.', {
        email: 'Email attachment',
        discord: 'Discord upload',
        web: 'Small, still looks good',
        archive: 'Keep more detail',
      }),
      targetMb: field('Size in MB', 'A size to aim for. Takes the place of Aim for.'),
      output: field('Save as', 'The format of the result. Left out, videos become MP4 and sound becomes MP3.', OUTPUT_LABELS),
      performance: COMMON.performance,
    },
  },
  thumbs: {
    label: 'Make thumbnails from a video',
    done: 'Thumbnails made',
    suffix: { poster: ' (poster)', sprite: ' (sheet)', preview: ' (preview)' },
    title: (file: string) => `Thumbnails of ${fileName(file)}`,
    fields: {
      files: COMMON.videos,
      mode: field('Kind', 'poster is one frame, sprite is a grid of frames from across the video, preview is a short looping clip. Left out, poster.', {
        poster: 'One frame',
        sprite: 'Grid of frames',
        preview: 'Short looping clip',
      }),
      at: field('Take from', 'Seconds from the beginning, for a poster or a preview. Left out, a tenth of the way in.'),
      count: field('Frames', 'How many frames the grid holds. Left out, 25.'),
      columns: field('Frames per row', 'Left out, 5.'),
      width: field('Width', 'In pixels: the poster (the video’s own width when left out), each frame of the grid (160) or the preview (480).'),
      durationSec: field('Preview length', 'Seconds. Left out, 3.'),
      fps: field('Frames per second', 'How smooth the preview is. Left out, 10.'),
      performance: COMMON.performance,
    },
  },
  gif: {
    label: 'Turn a video into a GIF',
    done: 'GIF made',
    title: (file: string) => `${fileName(file)} → GIF`,
    fields: {
      files: COMMON.videos,
      fps: field('Frames per second', 'Fewer makes a smaller, less smooth GIF. Left out, 12.'),
      width: field('Width', 'In pixels. Left out, 480, or the video’s own width when it is narrower.'),
      loop: field('Loop', 'Play over and over. Off plays it once.'),
      dither: field('Colour blending', 'How in-between colours are drawn: sierra2_4a is smooth, floyd_steinberg is grainier, bayer is a fine pattern, none leaves flat bands. Left out, sierra2_4a.', {
        sierra2_4a: 'Smooth',
        floyd_steinberg: 'Grainy',
        bayer: 'Fine pattern',
        none: 'Flat bands',
      }),
      trimStart: COMMON.trimStart,
      trimEnd: COMMON.trimEnd,
      performance: COMMON.performance,
    },
  },
  gone: 'The file is gone. It may have been moved or deleted.',
  trimBackwards: 'The trim end has to come after the trim start.',
  trimPastEnd: 'The trim start is after the end of the file.',
  audioToVideo: 'A sound file has no picture, so it can’t become a video. Pick a sound format instead.',
  noPicture: 'This file has no picture to work with.',
  noSound: 'This video has no sound, so there’s nothing to save as audio.',
  nothingLeft: 'Removing the sound from a sound file would leave nothing. Pick a video format, or leave the sound in.',
  videoOnlySkipped: 'The result has no picture, so the picture changes were skipped.',
  cropOutside: (w: number, h: number) => `The crop reaches past the edge of the picture, which is ${w} × ${h}.`,
  fadeNeedsLength: 'Sparky couldn’t tell how long this file is, so the fade out was skipped.',
  sizeNeedsLength: 'Sparky couldn’t tell how long this file is, so it can’t aim for a size. Pick Web or Archive instead.',
  sizeTooSmall: (mb: string) => `${mb} MB is too small for a file this long to stay watchable. Pick a bigger size.`,
  alreadySmall: 'Already as small as it gets, so the original was kept.',
  alreadyUnder: (mb: string) => `Already under ${mb} MB, so the original was kept.`,
  gpuFallback: 'The graphics card couldn’t handle this one, so Sparky finished it with the processor instead.',
} as const
