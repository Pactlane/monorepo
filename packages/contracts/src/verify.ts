import type { Env } from "@pactlane/config"
import type { DeploymentManifest } from "./manifest"
import { STELLAR_8004_REGISTRIES } from "./registries"

export type ManifestEnv = Pick<
  Env,
  | "STELLAR_NETWORK"
  | "STELLAR_NETWORK_PASSPHRASE"
  | "USDC_ASSET_CONTRACT_ID"
  | "STELLAR_8004_IDENTITY_REGISTRY_ID"
  | "STELLAR_8004_REPUTATION_REGISTRY_ID"
>

export class EnvManifestMismatchError extends Error {
  override readonly name = "EnvManifestMismatchError"
  readonly mismatches: string[]
  constructor(mismatches: string[]) {
    super(
      `Environment does not match the deployment manifest:\n${mismatches.map((m) => `  ${m}`).join("\n")}`
    )
    this.mismatches = mismatches
  }
}

export function assertEnvMatchesManifest(
  env: ManifestEnv,
  manifest: DeploymentManifest
): void {
  const mismatches: string[] = []
  const check = (
    field: string,
    actual: string | undefined,
    expected: string
  ) => {
    if (actual !== undefined && actual !== "" && actual !== expected) {
      mismatches.push(
        `${field}: env has ${actual}, manifest expects ${expected}`
      )
    }
  }
  check("STELLAR_NETWORK", env.STELLAR_NETWORK, manifest.network)
  check(
    "STELLAR_NETWORK_PASSPHRASE",
    env.STELLAR_NETWORK_PASSPHRASE,
    manifest.networkPassphrase
  )
  check(
    "USDC_ASSET_CONTRACT_ID",
    env.USDC_ASSET_CONTRACT_ID,
    manifest.contracts["pactlane-commerce"].constructorArgs.token
  )
  const registries = STELLAR_8004_REGISTRIES[manifest.network]
  check(
    "STELLAR_8004_IDENTITY_REGISTRY_ID",
    env.STELLAR_8004_IDENTITY_REGISTRY_ID,
    registries.identity
  )
  check(
    "STELLAR_8004_REPUTATION_REGISTRY_ID",
    env.STELLAR_8004_REPUTATION_REGISTRY_ID,
    registries.reputation
  )
  if (mismatches.length) throw new EnvManifestMismatchError(mismatches)
}
