// Labels and messages for the pdf ops. Every user-facing string for them lives here.
import { COMPRESSION_LEVELS } from '../levels'

const pad = (n: number, total: number) => String(n).padStart(String(total).length, '0')

export const PDF_TEXT = {
  ops: {
    'pdf.from_images': { label: 'Images to PDF', done: 'Made a PDF' },
    'pdf.to_images': { label: 'PDF to images', done: 'Saved the pages as images' },
    'pdf.merge': { label: 'Merge PDFs', done: 'Merged' },
    'pdf.split': { label: 'Split a PDF', done: 'Split' },
    'pdf.rotate': { label: 'Rotate PDF pages', done: 'Rotated' },
    'pdf.remove_pages': { label: 'Remove PDF pages', done: 'Removed the pages' },
    'pdf.extract_pages': { label: 'Extract PDF pages', done: 'Extracted the pages' },
    'pdf.extract_images': { label: 'Save the images in a PDF', done: 'Saved the images' },
    'pdf.compress': { label: 'Shrink a PDF', done: 'Shrunk' },
    'pdf.protect': { label: 'Add a password to a PDF', done: 'Protected' },
    'pdf.unlock': { label: 'Remove a PDF password', done: 'Unlocked' },
    'pdf.flatten': { label: 'Flatten a PDF', done: 'Flattened' },
  },

  /** Form labels (`title`) and help text (`description`) for each input field, keyed by field meaning. */
  fields: {
    pdfs: { title: 'PDF files', description: 'The PDFs to work on. Each one is handled on its own.' },
    mergeFiles: { title: 'PDF files', description: 'The PDFs to join, in the order they should appear.' },
    pictures: { title: 'Pictures', description: 'PNG, JPG, WEBP, AVIF, TIFF or GIF files, in page order.' },
    pageSize: { title: 'Page size', description: 'Fit makes each page the size of its picture. A4, A3, Letter and Legal centre the picture on paper of that size.', labels: { fit: 'Fit to picture', a4: 'A4', a3: 'A3', letter: 'Letter', legal: 'Legal' } },
    orientation: { title: 'Orientation', description: 'Auto turns the paper sideways for wide pictures. Has no effect with Fit.', labels: { auto: 'Automatic', portrait: 'Portrait', landscape: 'Landscape' } },
    marginMm: { title: 'Margin (mm)', description: 'Blank space around the picture on every side, in millimetres. None when left empty.' },
    fit: { title: 'Picture fit', description: 'Contain shows the whole picture. Cover fills the page and trims what overflows.', labels: { contain: 'Show the whole picture', cover: 'Fill the page' } },
    merge: { title: 'One PDF for all', description: 'On: every picture becomes a page of one PDF. Off: each picture becomes its own PDF.' },
    format: { title: 'Picture format', description: 'PNG keeps every detail. JPG and WEBP make smaller files.', labels: { png: 'PNG', jpg: 'JPG', webp: 'WEBP' } },
    dpi: { title: 'Resolution (DPI)', description: 'Dots per inch. 150 suits the screen, 300 suits printing. 150 when left empty.' },
    imagePages: { title: 'Pages', description: 'Which pages to save, such as 1-3, 5, 8- or odd. Every page when left empty.' },
    quality: { title: 'Quality', description: 'From 1 to 100 for JPG and WEBP. Higher looks better and makes bigger files.' },
    splitMode: { title: 'Split by', description: 'Ranges: one file per range you list. Every: a fixed number of pages per file. Pages: one file per page. Odd and even: two files.', labels: { ranges: 'Page ranges', every: 'Every few pages', pages: 'One file per page', odd_even: 'Odd and even' } },
    ranges: { title: 'Ranges', description: 'One range per file, separated by commas, such as 1-3, 4-6, 7-.' },
    every: { title: 'Pages per file', description: 'How many pages go in each file when splitting by Every. 1 when left empty.' },
    angle: { title: 'Turn by', description: 'Degrees clockwise, added to how each page is turned now. 90 when left empty.', labels: { '90': 'A quarter turn right', '180': 'Upside down', '270': 'A quarter turn left' } },
    rotatePages: { title: 'Pages', description: 'Which pages to turn, such as 1-3, 5, odd or even. Every page when left empty.' },
    removePages: { title: 'Pages to remove', description: 'Such as 2, 5-7 or even.' },
    extractPages: { title: 'Pages to keep', description: 'In the order they should appear, such as 3, 1-2. Writing 3,1,2 also reorders them.' },
    compression: { title: 'Compression', description: 'From 0 (keeps full quality) to 4 (smallest file). The compression setting when left empty.', labels: Object.fromEntries(COMPRESSION_LEVELS.map((l) => [String(l.level), l.label])) },
    userPassword: { title: 'Password to open', description: 'Asked for whenever the PDF is opened.' },
    ownerPassword: { title: 'Password to change', description: 'Lifts the printing and copying choices below. Sparky sets a random one when left empty.' },
    allowPrint: { title: 'Allow printing', description: 'On when left empty.' },
    allowCopy: { title: 'Allow copying text and pictures', description: 'On when left empty.' },
    password: { title: 'Password', description: 'The password that opens the PDF. Leave it empty for a PDF that opens without one but limits printing or copying.' },
  },

  /** Added to the source name before the extension. */
  suffix: {
    images: ' (pages)',
    merged: ' (merged)',
    rotated: ' (rotated)',
    removed: ' (pages removed)',
    extracted: ' (extracted pages)',
    smaller: ' (smaller)',
    protected: ' (protected)',
    unlocked: ' (unlocked)',
    flattened: ' (flattened)',
  },

  /** Queue title, e.g. "Merge PDFs: a.pdf and 2 more". */
  title: (label: string, name: string, count: number) => (count > 1 ? `${label}: ${name} and ${count - 1} more` : `${label}: ${name}`),

  /** " (page 03)": one page of a PDF saved on its own. */
  pageSuffix: (page: number, total: number) => ` (page ${pad(page, total)})`,
  /** " (image 2)": one picture pulled out of a PDF. */
  imageSuffix: (n: number, total: number) => ` (image ${pad(n, total)})`,
  /** One part of a split PDF: " (pages 1-3)", " (page 4)", else " (part 2)". */
  partSuffix: (pages: readonly number[], part: number, parts: number) => {
    const first = pages[0]
    const last = pages[pages.length - 1]
    if (first === undefined || last === undefined) return ` (part ${pad(part, parts)})`
    if (pages.length === 1) return ` (page ${first})`
    const runs = pages.every((p, i) => p === first + i)
    return runs ? ` (pages ${first}-${last})` : ` (part ${pad(part, parts)})`
  },
  oddSuffix: ' (odd pages)',
  evenSuffix: ' (even pages)',

  badPages: (part: string) => `“${part}” isn’t a list of pages Sparky understands. Use page numbers and ranges such as 1-3, 5, 8- or the words odd, even and all.`,
  pageOutOfRange: (page: number, total: number) => `This PDF has ${total} ${total === 1 ? 'page' : 'pages'}, so there is no page ${page}.`,
  noPagesMatch: (spec: string) => `No pages of this PDF match “${spec}”.`,
  removeAll: 'That would remove every page. Keep at least one.',
  rangesMissing: 'Say which pages go in each file, for example 1-3, 4-6.',
  encrypted: 'This PDF is password protected. Remove the password with “Remove a PDF password” first.',
  damaged: 'This PDF looks damaged, or it isn’t really a PDF. Try opening it in another app to check.',
  notAnImage: (name: string) => `Sparky can’t read ${name} as a picture. It works with PNG, JPG, WEBP, AVIF, TIFF and GIF.`,
  marginTooBig: 'The margin leaves no room on the page for the picture. Use a smaller margin.',
  noImages: 'This PDF has no pictures Sparky can save.',
  unreadableImages: 'This PDF has pictures, but they are stored in a way Sparky can’t read.',
  skippedImages: (n: number) => (n === 1 ? 'One picture was skipped because it is stored in a way Sparky can’t read.' : `${n} pictures were skipped because they are stored in a way Sparky can’t read.`),
  alreadySmall: 'Already as small as it gets, so the original was kept.',
  protectNeedsPassword: 'Give a password for opening the PDF, a password for changing it, or both.',
  wrongPassword: 'That password doesn’t open this PDF. Check it and try again.',
  passwordLetters: 'PDF passwords can only use Western European letters, digits and symbols, so readers everywhere accept them. Choose a password without other letters.',
  passwordUnusable: 'Sparky can’t hand this password to Ghostscript safely: it has a line break, or spaces together with a backslash at the end. Choose a different password.',
  needsPassword: 'This PDF needs its password before Sparky can remove it.',
  noForm: 'This PDF has no form fields to flatten, so the copy looks the same as the original.',
  ghostscriptFailed: 'Ghostscript stopped without saying why.',
} as const

export type PdfOpId = keyof typeof PDF_TEXT.ops
