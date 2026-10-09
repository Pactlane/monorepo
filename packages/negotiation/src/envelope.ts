import {
  canonicalize,
  commit,
  signBytes,
  verifyBytes,
  type Domain,
  type Ed25519KeyPair,
  type Sha256Ref,
} from "@pactlane/core"

export interface SignedEnvelope<T = unknown> {
  domain: Domain
  sender: string
  publicKey: string
  payload: T
  payloadHash: Sha256Ref
  signature: string
}

function signingMessage(
  domain: Domain,
  sender: string,
  payloadHash: Sha256Ref
): string {
  return canonicalize({ domain, sender, payloadHash })
}

export function signEnvelope<T>(
  domain: Domain,
  sender: string,
  keyPair: Ed25519KeyPair,
  payload: T
): SignedEnvelope<T> {
  const payloadHash = commit(domain, payload)
  return {
    domain,
    sender,
    publicKey: keyPair.publicKeyHex,
    payload,
    payloadHash,
    signature: signBytes(keyPair, signingMessage(domain, sender, payloadHash)),
  }
}

export type EnvelopeCheck = { ok: true } | { ok: false; reason: string }

export function verifyEnvelope(
  envelope: SignedEnvelope,
  expectedPublicKey?: string
): EnvelopeCheck {
  if (expectedPublicKey && envelope.publicKey !== expectedPublicKey) {
    return {
      ok: false,
      reason: "signer is not the registered communication key",
    }
  }
  if (commit(envelope.domain, envelope.payload) !== envelope.payloadHash) {
    return { ok: false, reason: "payload hash mismatch" }
  }
  const message = signingMessage(
    envelope.domain,
    envelope.sender,
    envelope.payloadHash
  )
  if (!verifyBytes(envelope.publicKey, message, envelope.signature)) {
    return { ok: false, reason: "invalid signature" }
  }
  return { ok: true }
}
