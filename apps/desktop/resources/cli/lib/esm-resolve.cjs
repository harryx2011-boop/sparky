// Node's ESM resolver ignores NODE_PATH, so a bare import in sparky.js would look for
const { registerHooks } = require('node:module')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const roots = (process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean)

registerHooks({
  resolve(specifier, context, next) {
    try {
      return next(specifier, context)
    } catch (error) {
      if (error?.code !== 'ERR_MODULE_NOT_FOUND' || /^(\.|\/|[a-z]+:)/i.test(specifier)) throw error
      for (const root of roots) {
        try {
          return next(specifier, { ...context, parentURL: pathToFileURL(path.join(root, 'index.js')).href })
        } catch {}
      }
      throw error
    }
  },
})
