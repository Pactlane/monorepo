import { Address, StrKey, nativeToScVal, xdr } from "@stellar/stellar-sdk"
import { isSha256Ref } from "@pactlane/core"

const I128_MAX = (1n << 127n) - 1n

export function hashToScVal(ref: string): xdr.ScVal {
  if (!isSha256Ref(ref)) throw new Error(`Invalid sha256 reference: ${ref}`)
  const hex = ref.slice("sha256:".length)
  const bytes = new Uint8Array(32)
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return xdr.ScVal.scvBytes(bytes)
}

export function amountToScVal(amount: bigint): xdr.ScVal {
  if (typeof amount !== "bigint") {
    throw new TypeError("Amounts must be bigint atomic units")
  }
  if (amount < 0n || amount > I128_MAX) {
    throw new RangeError(
      `Amount ${amount} is outside the i128 range used for USDC`
    )
  }
  return nativeToScVal(amount, { type: "i128" })
}

export function addressToScVal(address: string): xdr.ScVal {
  if (
    !StrKey.isValidEd25519PublicKey(address) &&
    !StrKey.isValidContract(address)
  ) {
    throw new Error(
      `Expected a G... account or C... contract address: ${address}`
    )
  }
  return Address.fromString(address).toScVal()
}
