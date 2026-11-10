import { StrKey } from "@stellar/stellar-sdk/base"

export type AccountAddress = `G${string}`
export type ContractAddress = `C${string}`

export function isAccountAddress(value: unknown): value is AccountAddress {
  return typeof value === "string" && StrKey.isValidEd25519PublicKey(value)
}

export function isContractAddress(value: unknown): value is ContractAddress {
  return typeof value === "string" && StrKey.isValidContract(value)
}

export function isStellarAddress(
  value: unknown
): value is AccountAddress | ContractAddress {
  return isAccountAddress(value) || isContractAddress(value)
}
