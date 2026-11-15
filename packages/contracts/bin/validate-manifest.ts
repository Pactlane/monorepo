import { resolve } from "node:path"
import { loadManifest, ManifestError } from "../src/index"

const USAGE =
  "Usage: validate-manifest <path-or-https-url> [--sha256 <hex>] [--reviewed]"

async function main(argv: string[]): Promise<number> {
  let ref: string | undefined
  let expectedSha256: string | undefined
  let reviewed = false
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    if (arg === "--reviewed") reviewed = true
    else if (arg === "--sha256") expectedSha256 = argv[++i]
    else if (arg === "-h" || arg === "--help") {
      console.log(USAGE)
      return 0
    } else if (!ref) ref = arg
    else {
      console.error(`Unexpected argument: ${arg}\n${USAGE}`)
      return 1
    }
  }
  if (!ref) {
    console.error(USAGE)
    return 1
  }
  const isUrl = /^[a-z][a-z0-9+.-]*:/i.test(ref)
  const target = isUrl
    ? ref
    : resolve(process.env.INIT_CWD ?? process.cwd(), ref)
  try {
    const m = await loadManifest(target, { expectedSha256, reviewed })
    console.log(`OK  ${ref}`)
    console.log(`network     ${m.network} (${m.networkPassphrase})`)
    for (const [name, c] of Object.entries(m.contracts)) {
      if (!c) continue
      console.log(`${name}`)
      console.log(`  contract  ${c.contractId}`)
      console.log(`  wasm      ${c.wasmSha256}`)
      console.log(`  commit    ${c.gitCommit}`)
      console.log(
        `  deployed  ${c.deployedAt}${c.upgradedAt ? `, upgraded ${c.upgradedAt}` : ""}`
      )
    }
    return 0
  } catch (error) {
    console.error(`INVALID  ${ref}`)
    if (error instanceof ManifestError)
      for (const issue of error.issues) console.error(`  - ${issue}`)
    else
      console.error(
        `  - ${error instanceof Error ? error.message : String(error)}`
      )
    return 1
  }
}

process.exit(await main(process.argv.slice(2)))
