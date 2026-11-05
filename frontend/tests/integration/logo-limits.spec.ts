import { expect, test } from '@playwright/test'
import { deflateSync } from 'node:zlib'
import { command, signIn } from './helpers'

// A valid 1x1 PNG with a CRC-checked uncompressed metadata chunk. This tests
// byte/transport limits without allocating a large image or exhausting resources.
function chunk(type: string, data: Buffer): Buffer {
  const content = Buffer.concat([Buffer.from(type), data])
  let crc = 0xffffffff
  for (const byte of content) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  const header = Buffer.alloc(4), checksum = Buffer.alloc(4)
  header.writeUInt32BE(data.length); checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0)
  return Buffer.concat([header, content, checksum])
}
function pngOfSize(size: number): Buffer {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(1, 0); header.writeUInt32BE(1, 4); header[8] = 8; header[9] = 6
  const start = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(Buffer.from([0, 255, 0, 0, 255])))])
  const end = chunk('IEND', Buffer.alloc(0))
  const text = Buffer.concat([Buffer.from('Comment\0'), Buffer.alloc(size - start.length - end.length - 12 - 8, 97)])
  return Buffer.concat([start, chunk('tEXt', text), end])
}

test('F05: exact 2 MiB logo traverses Nginx, backend limits stay authoritative and oversized JSON returns a safe 413', async ({ page }) => {
  await signIn(page)
  const maximum = 2 * 1024 * 1024
  const original = await (await page.request.get('/api/v1/boutique-profile')).json()
  const image = pngOfSize(maximum)
  expect(image.length).toBe(maximum)
  const profile = { name: 'Synthetic transport boutique', address_line: 'Synthetic test location', logo_base64: image.toString('base64') }
  expect(Buffer.byteLength(JSON.stringify(profile))).toBeGreaterThan(1024 * 1024)
  try {
    const accepted = await command(page, 'boutique-profile', profile, 'PUT')
    expect(accepted.status()).toBe(200)
    const saved = await accepted.json()
    expect(Buffer.from(saved.logo_base64, 'base64').subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    expect(saved.logo_base64.length).toBeLessThan(1000)
    const tooManyBytes = await command(page, 'boutique-profile', { ...profile, logo_base64: Buffer.concat([image, Buffer.from([0])]).toString('base64') }, 'PUT')
    expect(tooManyBytes.status()).toBe(422)
    expect((await tooManyBytes.json()).error.code).toBe('invalid_logo')
    const invalidImage = await command(page, 'boutique-profile', { ...profile, logo_base64: 'A'.repeat(1100000) }, 'PUT')
    expect(invalidImage.status()).toBe(422)
    expect((await invalidImage.json()).error.code).toBe('invalid_logo')
    const proxyLimit = await command(page, 'boutique-profile', { ...profile, logo_base64: 'A'.repeat(3 * 1024 * 1024) }, 'PUT')
    expect(proxyLimit.status()).toBe(413)
    expect(proxyLimit.headers()['content-type']).toContain('application/json')
    expect(proxyLimit.headers()['cache-control']).toBe('no-store')
    expect((await proxyLimit.json()).error).toMatchObject({ code: 'request_too_large', fields: [{ location: ['body', 'logo_base64'], type: 'file_too_large' }] })
    expect(await (await page.request.get('/api/v1/boutique-profile')).json()).toEqual(saved)
    const otherEndpoint = await command(page, 'categories', { name: 'A'.repeat(1100000) })
    expect(otherEndpoint.status()).toBe(413)
  } finally {
    if (original.ready) {
      expect((await command(page, 'boutique-profile', { name: original.name, address_line: original.address_line, phone_number: original.phone_number, logo_base64: original.logo_base64, remove_logo: !original.logo_base64 }, 'PUT')).status()).toBe(200)
    }
  }
})
