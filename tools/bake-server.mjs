import { createServer } from 'node:http'
import { readFile, writeFile } from 'node:fs/promises'
import { extname, join, normalize, resolve } from 'node:path'

const root = resolve(process.cwd())
const port = Number(process.env.PORT || 3010)
const mime = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.glb': 'model/gltf-binary',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
}

createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url?.startsWith('/save')) {
      const name = new URL(req.url, 'http://localhost').searchParams.get('name') || 'baked.json'
      const target = join(root, 'public', 'models', normalize(name).replace(/^(\.\.[/\\])+/, ''))
      const chunks = []
      for await (const chunk of req) chunks.push(chunk)
      await writeFile(target, Buffer.concat(chunks))
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ ok: true, bytes: Buffer.concat(chunks).length }))
      return
    }
    const url = new URL(req.url || '/', 'http://localhost')
    const path = resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/tools/bake.html' : url.pathname))
    if (!path.startsWith(root)) { res.writeHead(403); res.end(); return }
    const data = await readFile(path)
    res.writeHead(200, { 'content-type': mime[extname(path)] || 'application/octet-stream', 'cache-control': 'no-store' })
    res.end(data)
  } catch (err) {
    res.writeHead(404, { 'content-type': 'text/plain' })
    res.end(String(err))
  }
}).listen(port, '127.0.0.1', () => console.log(`bake server on http://127.0.0.1:${port}`))
