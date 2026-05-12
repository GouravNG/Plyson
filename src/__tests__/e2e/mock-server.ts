import http from 'node:http'

export interface MockServer {
  url: string
  close: () => Promise<void>
  lastRequest: any
}

export async function createMockServer(port: number = 0): Promise<MockServer> {
  let lastRequest: any = null

  const server = http.createServer((req, res) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
    })
    req.on('end', () => {
      lastRequest = {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: body ? JSON.parse(body) : null,
      }

      if (req.url === '/users' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ data: [{ id: 1, name: 'John Doe' }] }))
      } else if (req.url === '/auth' && req.method === 'POST') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ access_token: 'mock-token' }))
      } else if (req.url === '/profile' && req.method === 'GET') {
        if (req.headers.authorization === 'Bearer mock-token') {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ id: 1, name: 'John Doe', role: 'admin' }))
        } else {
          res.writeHead(401)
          res.end()
        }
      } else {
        res.writeHead(404)
        res.end()
      }
    })
  })

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      const addr = server.address() as any
      resolve({
        url: `http://127.0.0.1:${addr.port}`,
        close: () => new Promise((res) => server.close(() => res())),
        get lastRequest() {
          return lastRequest
        },
      })
    })
  })
}
