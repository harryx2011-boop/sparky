// Opening and saving PDFs with pdf-lib, with failures in plain words.
import { explainFileError, PDF_TEXT } from '@sparky/core'
import fs from 'node:fs/promises'
import { PDFDocument } from 'pdf-lib'

export async function readBytes(file: string): Promise<Uint8Array> {
  try {
    return new Uint8Array(await fs.readFile(file))
  } catch (e) {
    throw new Error(explainFileError(e, 'read'))
  }
}

/** A pdf-lib parse failure as a sentence: password protected, or damaged. */
export function explainPdfError(e: unknown): Error {
  const err = e as Error
  if (err?.name === 'EncryptedPDFError' || /encrypt|password/i.test(err?.message ?? '')) return new Error(PDF_TEXT.encrypted)
  return new Error(PDF_TEXT.damaged)
}

export async function loadPdf(file: string): Promise<PDFDocument> {
  const bytes = await readBytes(file)
  try {
    return await PDFDocument.load(bytes, { updateMetadata: false })
  } catch (e) {
    throw explainPdfError(e)
  }
}

export async function savePdf(doc: PDFDocument, file: string): Promise<void> {
  try {
    await fs.writeFile(file, await doc.save())
  } catch (e) {
    throw new Error(explainFileError(e, 'save'))
  }
}
