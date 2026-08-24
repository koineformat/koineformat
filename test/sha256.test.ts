/**
 * The hash, against vectors nobody in this project chose.
 *
 * `sha256Hex` is the one place this package leaves the format and touches a
 * primitive, and it is load-bearing twice over: every `contentHash` in an
 * identity map and every link of a Merkle chain is its output. A wrong digest
 * here would not fail loudly — it would produce trees that verify against
 * themselves and against nothing else. So the vectors below are the published
 * ones (FIPS 180-2 / RFC 6234), not values recorded from this implementation.
 */
import { describe, expect, it } from 'bun:test'
import { sha256Bytes, sha256Hex } from '../src/sha256.js'

describe('sha256Hex', () => {
  it('reproduces the published vectors', async () => {
    expect(await sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    expect(await sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'))
      .toBe('248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1')
  })

  it('reads a string as UTF-8 — the same answer as its own bytes', async () => {
    const utf8 = new TextEncoder().encode('a knowledge repo — ordinary files')
    expect(await sha256Hex(utf8)).toBe(await sha256Hex('a knowledge repo — ordinary files'))
  })

  it('hashes a view\'s own extent, not the buffer behind it', async () => {
    const backing = new TextEncoder().encode('xxabcxx')
    expect(await sha256Hex(backing.subarray(2, 5)))
      .toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('gives back 32 raw bytes, lowercase hex only', async () => {
    expect((await sha256Bytes('abc')).length).toBe(32)
    expect(await sha256Hex('abc')).toMatch(/^[0-9a-f]{64}$/)
  })
})
