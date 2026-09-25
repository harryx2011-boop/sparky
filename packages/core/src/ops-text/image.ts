// Labels and messages for the image ops. Every user-facing string for them lives here.
const fileName = (p: string) => p.split(/[\\/]/).pop() ?? p

/** A field's label (`title`) and help text (`description`) on the Tools page, the CLI help and the MCP schema. */
interface FieldText {
  title: string
  description: string
  /** Words for each choice of a pick-one field, keyed by the value sent. */
  labels?: Record<string, string>
}

export const IMAGE_TEXT = {
  edit: {
    label: 'Edit an image',
    done: 'Edited',
    title: (file: string, ext: string) => `Edit ${fileName(file)} → ${ext.toUpperCase()}`,
    fields: {
      files: { title: 'Pictures', description: 'The pictures to change. Each one is saved as a new file.' },
      width: { title: 'Width', description: 'New width in pixels. Leave the height empty to keep the shape.' },
      height: { title: 'Height', description: 'New height in pixels. Leave the width empty to keep the shape.' },
      percent: { title: 'Scale', description: 'Resize by a percentage instead of pixels: 50 is half size, 200 is double.' },
      fit: {
        title: 'Fit',
        description:
          'How the picture fills the width and height: inside keeps it whole within them, outside covers them, contain adds borders, cover crops the edges, fill stretches.',
        labels: { inside: 'Fit inside', outside: 'Cover the size', contain: 'Fit with borders', cover: 'Fill and crop', fill: 'Stretch' },
      },
      rotate: {
        title: 'Rotate',
        description: 'Turn the picture clockwise by 90, 180 or 270 degrees.',
        labels: { '90': 'A quarter turn right', '180': 'Upside down', '270': 'A quarter turn left' },
      },
      flip: {
        title: 'Flip',
        description: 'Mirror the picture after any turn: h left to right, v top to bottom, hv both.',
        labels: { h: 'Side to side', v: 'Upside down', hv: 'Both' },
      },
      stripMetadata: { title: 'Strip metadata', description: 'Removes camera details and location from the file.' },
      quality: { title: 'Quality', description: 'From 1 to 100. Lower makes a smaller file that looks softer.' },
      lossless: { title: 'Lossless', description: 'WEBP and AVIF only: keep every pixel exactly as it is.' },
      background: { title: 'Background', description: 'Colour laid under see-through areas, such as #ffffff. JPG and BMP use white when this is empty.' },
      output: {
        title: 'Format',
        description: 'The format to save in. The picture keeps its own format when this is empty.',
        labels: { png: 'PNG', jpg: 'JPG', webp: 'WEBP', avif: 'AVIF', tiff: 'TIFF', bmp: 'BMP', gif: 'GIF' },
      },
    } satisfies Record<string, FieldText>,
  },
  ico: {
    label: 'Make a Windows icon',
    done: 'Icon made',
    title: (file: string) => `${fileName(file)} → ICO`,
    fields: {
      files: { title: 'Pictures', description: 'The pictures to turn into icons. Each one becomes its own .ico file.' },
      sizes: { title: 'Sizes', description: 'The square sizes inside the icon, in pixels. 16, 32, 48 and 256 when this is empty.' },
    } satisfies Record<string, FieldText>,
  },
  gif: {
    label: 'Turn images into a GIF',
    done: 'GIF made',
    title: (file: string, count: number) => (count > 1 ? `${fileName(file)} and ${count - 1} more → GIF` : `${fileName(file)} → GIF`),
    fields: {
      files: { title: 'Pictures', description: 'The frames of the animation, in the order they play.' },
      delayMs: { title: 'Frame time', description: 'How long each picture shows, in milliseconds. 500 is half a second.' },
      loop: { title: 'Loop', description: 'Play the animation over and over. Turn off to play it once.' },
      width: { title: 'Width', description: 'Width in pixels; the height follows. The first picture’s width when this is empty.' },
    } satisfies Record<string, FieldText>,
  },
  gone: 'The file is gone. It may have been moved or deleted.',
  notAnImage: (name: string) => `Sparky can’t read ${name} as a picture. It works with PNG, JPG, WEBP, AVIF, TIFF and GIF.`,
  damaged: (name: string) => `${name} looks damaged, or it isn’t really a picture. Try opening it in another app to check.`,
  firstFrameOnly: (ext: string) => `This picture moves, but ${ext.toUpperCase()} holds one picture, so only the first frame was saved.`,
  icoEdge: 'The ICO format stores each size in one byte, so its largest picture is 256 pixels across.',
  sizeOrPercent:'Give a width and height, or a percentage, not both.',
  tooSmall: 'That size leaves nothing of the picture. Use a bigger size.',
} as const
