// Node's ESM resolver ignores NODE_PATH, so a bare import in sparky.js would look for
// node_modules beside resources\cli and miss the app's own. On a miss, retry the
// import as if it came from each NODE_PATH folder (app.asar.unpacked, then app.asar).
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
