import { createHash } from "node:crypto"
import { Keypair, StrKey } from "@stellar/stellar-base"
import { keyPairFromSeed, type Ed25519KeyPair } from "@pactlane/core"

function seed(label: string): Buffer {
  return createHash("sha256").update(`pactlane-fixture:${label}`).digest()
}

export interface FixtureIdentity {
  label: string
  stellar: Keypair
  address: string
  comm: Ed25519KeyPair
}

export function fixtureIdentity(label: string): FixtureIdentity {
  const stellar = Keypair.fromRawEd25519Seed(seed(`stellar:${label}`))
  return {
    label,
    stellar,
    address: stellar.publicKey(),
    comm: keyPairFromSeed(seed(`comm:${label}`)),
  }
}

export function fixtureContractId(label: string): string {
  return StrKey.encodeContract(seed(`contract:${label}`))
}
