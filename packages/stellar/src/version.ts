import { existsSync, readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"

const SDK_NAME = "@stellar/stellar-sdk"

function readSdkVersion(): string {
  const require = createRequire(import.meta.url)
  let dir = dirname(require.resolve(SDK_NAME))
  for (;;) {
    const file = join(dir, "package.json")
    if (existsSync(file)) {
      const pkg = JSON.parse(readFileSync(file, "utf8")) as {
        name?: string
        version?: string
      }
      if (pkg.name === SDK_NAME && pkg.version) return pkg.version
    }
    const parent = dirname(dir)
    if (parent === dir)
      throw new Error(`Cannot locate ${SDK_NAME} package.json`)
    dir = parent
  }
}

export const STELLAR_SDK_VERSION: string = readSdkVersion()
