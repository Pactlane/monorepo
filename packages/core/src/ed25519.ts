import { createPrivateKey, createPublicKey, sign, verify, randomBytes, type KeyObject } from "node:crypto"

const PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex")
const SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex")

export interface Ed25519KeyPair {
  publicKeyHex: string
  privateKey: KeyObject
}

export function keyPairFromSeed(seed: Uint8Array): Ed25519KeyPair {
  if (seed.length !== 32) throw new Error("Ed25519 seed must be 32 bytes")
  const privateKey = createPrivateKey({
    key: Buffer.concat([PKCS8_PREFIX, Buffer.from(seed)]),
    format: "der",
    type: "pkcs8",
  })
  const spki = createPublicKey(privateKey).export({ format: "der", type: "spki" })
  return { privateKey, publicKeyHex: Buffer.from(spki.subarray(SPKI_PREFIX.length)).toString("hex") }
}

export function generateKeyPair(): Ed25519KeyPair {
  return keyPairFromSeed(randomBytes(32))
}

export function signBytes(keyPair: Ed25519KeyPair, message: Uint8Array | string): string {
  return sign(null, Buffer.from(message), keyPair.privateKey).toString("hex")
}

export function verifyBytes(publicKeyHex: string, message: Uint8Array | string, signatureHex: string): boolean {
  if (!/^[0-9a-f]{64}$/.test(publicKeyHex) || !/^[0-9a-f]{128}$/.test(signatureHex)) return false
  const key = createPublicKey({
    key: Buffer.concat([SPKI_PREFIX, Buffer.from(publicKeyHex, "hex")]),
    format: "der",
    type: "spki",
  })
  return verify(null, Buffer.from(message), key, Buffer.from(signatureHex, "hex"))
}

export function randomNonce(): string {
  return randomBytes(16).toString("hex")
}
