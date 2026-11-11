/**
 * AI-new-skin · Host half
 *
 * 只做三件事：
 *   1. 把 pic/ 下的壁纸列成清单（GET  /ai-new-skin/api/list）
 *   2. 按需把图片发给页面（GET  /ai-new-skin/img/<相对路径>）
 *   3. 接收「设为桌面壁纸」的请求，调用 Windows 的 SystemParametersInfo 换壁纸
 *      （POST /ai-new-skin/api/desktop）
 *
 * 全部走本机回环，不联网、不读工作区以外的文件。
 */
import { execFile } from 'node:child_process'
import { createReadStream } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PIC = path.join(HERE, 'pic')
const ROUTE = '/ai-new-skin'

const MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

const ORDER = ['单张', '一行两列', '两行两列']

/** 列目录：返回 [{ id, group, name, file }]，只认图片。 */
async function listWallpapers() {
  const out = []
  const groups = await readdir(PIC, { withFileTypes: true }).catch(() => [])
  for (const g of groups) {
    if (!g.isDirectory()) continue
    const dir = path.join(PIC, g.name)
    const files = await readdir(dir, { withFileTypes: true }).catch(() => [])
    for (const f of files) {
      if (!f.isFile()) continue
      const ext = path.extname(f.name).toLowerCase()
      if (!MIME[ext]) continue
      const base = f.name.slice(0, -ext.length)
      out.push({
        id: `${g.name}/${f.name}`,
        group: g.name,
        name: base,
        file: f.name,
      })
    }
  }
  out.sort((a, b) => {
    const ga = ORDER.indexOf(a.group)
    const gb = ORDER.indexOf(b.group)
    if (ga !== gb) return (ga < 0 ? 99 : ga) - (gb < 0 ? 99 : gb)
    return a.name.localeCompare(b.name, 'zh-Hans-CN', { numeric: true })
  })
  return out
}

/** 把请求里的相对路径解析成 PIC 内的真实路径；越界返回 null。 */
function resolveInside(rel) {
  const decoded = decodeURIComponent(rel)
  const abs = path.resolve(PIC, decoded)
  const prefix = PIC + path.sep
  return abs.startsWith(prefix) || abs === PIC ? abs : null
}

function isLoopback(req) {
  const a = req.socket?.remoteAddress || ''
  return a === '127.0.0.1' || a === '::1' || a === '::ffff:127.0.0.1'
}

function sendJson(res, code, body) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  res.end(JSON.stringify(body))
}

function readBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        reject(new Error('body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

/** Windows 桌面壁纸：SystemParametersInfo(SPI_SETDESKWALLPAPER)。 */
function setWindowsWallpaper(absPath) {
  const script = `
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @"
using System.Runtime.InteropServices;
public class AISkinWall {
  [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern int SystemParametersInfo(int uAction, int uParam, string lpvParam, int fuWinIni);
}
"@
$ok = [AISkinWall]::SystemParametersInfo(20, 0, $env:AISKIN_WALL, 0x01 -bor 0x02)
if ($ok -eq 0) { Write-Error ('SystemParametersInfo failed: ' + [Runtime.InteropServices.Marshal]::GetLastWin32Error()) }
`.trim()

  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { env: { ...process.env, AISKIN_WALL: absPath }, windowsHide: true, timeout: 15000 },
      (err, _stdout, stderr) => {
        if (err) reject(new Error(String(stderr || err.message).trim()))
        else resolve()
      },
    )
  })
}

async function handle(req, res) {
  if (!isLoopback(req)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('loopback only')
    return
  }

  const url = new URL(req.url || '/', 'http://127.0.0.1')
  const pathname = url.pathname

  if (pathname === `${ROUTE}/api/list`) {
    const items = await listWallpapers()
    sendJson(res, 200, { count: items.length, items })
    return
  }

  if (pathname === `${ROUTE}/api/desktop`) {
    if (req.method !== 'POST') {
      sendJson(res, 405, { ok: false, error: 'POST required' })
      return
    }
    try {
      const body = JSON.parse((await readBody(req)) || '{}')
      const rel = String(body.id || '')
      const abs = resolveInside(rel)
      if (!abs) {
        sendJson(res, 400, { ok: false, error: 'bad path' })
        return
      }
      await stat(abs)
      await setWindowsWallpaper(abs)
      sendJson(res, 200, { ok: true, id: rel })
    } catch (error) {
      sendJson(res, 500, { ok: false, error: String(error?.message || error) })
    }
    return
  }

  if (pathname.startsWith(`${ROUTE}/img/`)) {
    const rel = pathname.slice(`${ROUTE}/img/`.length)
    const abs = resolveInside(rel)
    if (!abs) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('not found')
      return
    }
    try {
      const info = await stat(abs)
      if (!info.isFile()) throw new Error('not a file')
      const etag = `"${info.size.toString(16)}-${info.mtimeMs.toString(16)}"`
      if (req.headers['if-none-match'] === etag) {
        res.writeHead(304, { ETag: etag })
        res.end()
        return
      }
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream',
        'Content-Length': info.size,
        'Cache-Control': 'public, max-age=86400',
        ETag: etag,
      })
      if (req.method === 'HEAD') {
        res.end()
        return
      }
      createReadStream(abs).on('error', () => res.end()).pipe(res)
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('not found')
    }
    return
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
  res.end('not found')
}

export const inject = ['webServer']

export function apply(ctx) {
  const webServer = ctx.webServer ?? ctx.get('webServer')
  if (!webServer) return

  ctx.effect(() =>
    webServer.register({
      kind: 'prefix',
      path: ROUTE,
      handler: (req, res) => {
        handle(req, res).catch((error) => {
          try {
            sendJson(res, 500, { ok: false, error: String(error?.message || error) })
          } catch {
            /* response already gone */
          }
        })
      },
    }),
  )
}
