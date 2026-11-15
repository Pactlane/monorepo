import { Keypair, TransactionBuilder, hash } from "@stellar/stellar-sdk"
import type { Signer, SignOptions } from "./signer"

function toBase64(bytes: Uint8Array): string {
  let binary = ""
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

function fromBase64(text: string): Uint8Array {
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0))
}

export class KeypairSigner implements Signer {
  readonly #keypair: Keypair

  constructor(keypair: Keypair) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "KeypairSigner is for tests only and refuses to run in production"
      )
    }
    if (!keypair.canSign())
      throw new Error("KeypairSigner needs a keypair with a secret")
    this.#keypair = keypair
  }

  static random(): KeypairSigner {
    return new KeypairSigner(Keypair.random())
  }

  async address(): Promise<string> {
    return this.#keypair.publicKey()
  }

  #check(opts: SignOptions) {
    if (opts.address && opts.address !== this.#keypair.publicKey()) {
      throw new Error(
        `KeypairSigner holds ${this.#keypair.publicKey()}, not ${opts.address}`
      )
    }
  }

  async signTransaction(xdr: string, opts: SignOptions): Promise<string> {
    this.#check(opts)
    const tx = TransactionBuilder.fromXDR(xdr, opts.networkPassphrase)
    tx.sign(this.#keypair)
    return tx.toXDR()
  }

  async signAuthEntry(preimageXdr: string, opts: SignOptions): Promise<string> {
    this.#check(opts)
    return toBase64(this.#keypair.sign(hash(fromBase64(preimageXdr))))
  }
}
