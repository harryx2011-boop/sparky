// Labels and messages for the ocr ops. Every user-facing string for them lives here.
const fileName = (p: string) => p.split(/[\\/]/).pop() ?? p

export const OCR_TEXT = {
  ocr: {
    label: 'Read the text in an image or PDF',
    done: 'Text read',
    title: (file: string, output: 'txt' | 'pdf' | 'both') => `Read text in ${fileName(file)} → ${output === 'both' ? 'TXT and PDF' : output.toUpperCase()}`,
    /** A field's label (`title`) and help text (`description`) on the Tools page, the CLI help and the MCP schema. */
    fields: {
      files: { title: 'Pictures or PDFs', description: 'The pictures or PDFs to read. Each one gets its own text file or PDF; a PDF is read page by page.' },
      output: {
        title: 'Save as',
        description:
          'txt saves the words as plain text, pdf saves the picture as a PDF you can search and copy from, both saves the two. In the text of a PDF, each page after the first starts with a form feed character, as Tesseract writes it.',
        labels: { txt: 'Text file', pdf: 'Searchable PDF', both: 'Both' },
      },
      dpi: {
        title: 'PDF resolution (DPI)',
        description: 'Dots per inch each PDF page is drawn at before it is read. Higher reads small print better and takes longer. 300 when left empty. Pictures are read as they are.',
      },
      language: {
        title: 'Language',
        description: 'The language of the text, as a code such as eng, fra, deu or chi_sim. Join several with +, such as eng+fra. English is built in; others download once.',
      },
    },
    /** Added to a PDF's name when the searchable copy is saved, so it never looks like the original. */
    searchableSuffix: ' (searchable)',
  },
  gone: 'The file is gone. It may have been moved or deleted.',
  notAnImage: (name: string) => `Sparky can’t read text from ${name}. It works with pictures (PNG, JPG, WEBP, AVIF, TIFF, GIF and BMP) and PDFs.`,
  language: (code: string) =>
    `Sparky couldn’t get the “${code}” language for reading text. Check the code (eng, fra, deu, chi_sim, …) and that this PC is online the first time a language is used.`,
  noText: 'No text was found in this picture.',
  noTextPdf: 'No text was found in this PDF.',
  failed: 'Sparky couldn’t read the text in this picture.',
  failedPdf: 'Sparky couldn’t read the text in this PDF.',
} as const
