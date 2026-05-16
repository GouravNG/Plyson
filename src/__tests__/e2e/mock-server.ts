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
      const parsedBody = body
        ? req.headers['content-type']?.includes('json')
          ? JSON.parse(body)
          : body
        : null
      lastRequest = {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: parsedBody,
      }

      // Route handling
      if (req.url === '/users' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            data: [
              { id: 1, name: 'John Doe', status: 'active' },
              { id: 2, name: 'Jane Smith', status: 'disabled' },
            ],
          })
        )
      } else if (req.url === '/auth' && req.method === 'POST') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ access_token: 'mock-token' }))
      } else if (req.url === '/profile' && req.method === 'GET') {
        if (req.headers.authorization === 'Bearer mock-token') {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(
            JSON.stringify({ id: 1, name: 'John Doe', role: 'admin', settings: { theme: 'dark' } })
          )
        } else {
          res.writeHead(401)
          res.end()
        }
      } else if (req.url?.startsWith('/users/') && req.method === 'PATCH') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ...parsedBody, id: req.url.split('/').pop() }))
      } else if (req.url === '/echo' && req.method === 'POST') {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'X-Custom-Header': 'play-son-rocks',
        })
        res.end(JSON.stringify(parsedBody))
      } else if (req.url === '/public' && req.method === 'GET') {
        // Special route to test skip_auth flag
        // If Authorization header is present, we return 403 (simulating a strict public endpoint that rejects tokens)
        if (req.headers.authorization || req.headers.Authorization) {
          res.writeHead(403)
          res.end(JSON.stringify({ error: 'Auth header should NOT be present' }))
        } else {
          res.writeHead(200)
          res.end(JSON.stringify({ message: 'Public success' }))
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
