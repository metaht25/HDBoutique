// Match the authorized loopback HTTP origin while serving the real Nginx image.
import { createServer, connect } from 'node:net'

const server = createServer(client => {
  const upstream = connect(8080, 'web')
  client.on('error', () => upstream.destroy())
  upstream.on('error', () => client.destroy())
  client.pipe(upstream).pipe(client)
})
server.listen(4173, '127.0.0.1')
