import { EventEmitter } from 'node:events'
import { describe, expect, it } from 'vitest'
import { dropRepeatAnswers, unpackedPath } from '../../src/ocr/tesseract'

describe('unpackedPath', () => {
  it('points a worker script inside app.asar at app.asar.unpacked, with Windows separators', () => {
    expect(unpackedPath('C:\\Users\\a\\AppData\\Local\\Programs\\Sparky\\resources\\app.asar\\node_modules\\tesseract.js\\src\\worker-script\\node\\index.js')).toBe(
      'C:\\Users\\a\\AppData\\Local\\Programs\\Sparky\\resources\\app.asar.unpacked\\node_modules\\tesseract.js\\src\\worker-script\\node\\index.js',
    )
  })

  it('handles forward slashes and leaves paths outside an archive alone', () => {
    expect(unpackedPath('/opt/Sparky/resources/app.asar/node_modules/x.js')).toBe('/opt/Sparky/resources/app.asar.unpacked/node_modules/x.js')
    expect(unpackedPath('D:\\sparky\\node_modules\\tesseract.js\\src\\index.js')).toBe('D:\\sparky\\node_modules\\tesseract.js\\src\\index.js')
    expect(unpackedPath('C:\\x\\app.asar.unpacked\\y.js')).toBe('C:\\x\\app.asar.unpacked\\y.js')
  })
})

describe('dropRepeatAnswers', () => {
  it('passes a job’s first answer and its progress, and drops a second answer to the same job', () => {
    const thread = new EventEmitter()
    const seen: unknown[] = []
    thread.on('message', (m) => seen.push(m))
    dropRepeatAnswers(thread)
    const msg = (status: string, action = 'initialize', jobId = 'Job-1') => ({ status, action, jobId })
    thread.emit('message', msg('progress'))
    thread.emit('message', msg('reject'))
    thread.emit('message', msg('progress'))
    thread.emit('message', msg('resolve'))
    thread.emit('message', msg('reject', 'recognize', 'Job-2'))
    expect(seen).toEqual([msg('progress'), msg('reject'), msg('progress'), msg('reject', 'recognize', 'Job-2')])
    expect(thread.listenerCount('message')).toBe(1)
  })
})
