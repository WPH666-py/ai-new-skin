// 临时自测：不经过 DSH，直接把 Host 半边的路由跑一遍。
import { apply } from './index.js'

let route = null
const ctx = {
  webServer: {
    register(r) {
      route = r
      return () => {}
    },
  },
  effect(fn) {
    return fn()
  },
}

apply(ctx)
if (!route) throw new Error('route not registered')

function call(url, method = 'GET', body = null) {
  return new Promise((resolve) => {
    const listeners = {}
    const req = {
      url,
      method,
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
      on(ev, fn) {
        listeners[ev] = fn
        return req
      },
      destroy() {},
    }
    const chunks = []
    const res = {
      statusCode: 0,
      headers: null,
      writeHead(code, headers) {
        res.statusCode = code
        res.headers = headers
      },
      write(chunk) {
        if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)))
        return true
      },
      on() {},
      once() {},
      emit() {},
      end(chunk) {
        if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)))
        resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) })
      },
    }
    route.handler(req, res)
    if (body !== null) {
      listeners.data?.(Buffer.from(JSON.stringify(body)))
      listeners.end?.()
    }
  })
}

const list = await call('/ai-new-skin/api/list')
console.log('list status', list.status, 'bytes', list.body.length)
const data = JSON.parse(list.body.toString('utf8'))
console.log('count', data.count, 'first', data.items[0], 'last', data.items[data.items.length - 1])

const first = data.items[0].id
const img = await call('/ai-new-skin/img/' + first.split('/').map(encodeURIComponent).join('/'))
console.log('img status', img.status, 'content-type', img.headers['Content-Type'], 'bytes', img.body.length)

const bad = await call('/ai-new-skin/img/' + encodeURIComponent('../../package.json'))
console.log('traversal status', bad.status)

const missing = await call('/ai-new-skin/api/desktop', 'GET')
console.log('desktop GET status', missing.status, missing.body.toString())

const groupCount = {}
for (const it of data.items) groupCount[it.group] = (groupCount[it.group] || 0) + 1
console.log('groups', groupCount)
