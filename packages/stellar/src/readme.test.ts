import { describe, expect, test } from "bun:test"
import * as root from "./index"
import * as testing from "./signer.test-only"

const TYPE_ONLY = new Set(["Signer", "SignOptions"])

describe("README", () => {
  test("every name imported in a snippet is really exported", async () => {
    const readme = await Bun.file(
      new URL("../README.md", import.meta.url)
    ).text()
    const blocks = [...readme.matchAll(/```ts\n([\s\S]*?)```/g)].map(
      (m) => m[1]!
    )
    expect(blocks.length).toBeGreaterThan(5)
    const sources: Record<string, object> = {
      "@pactlane/stellar": root,
      "@pactlane/stellar/testing": testing,
    }
    let checked = 0
    for (const block of blocks) {
      for (const m of block.matchAll(
        /import \{([^}]+)\} from "(@pactlane\/stellar[^"]*)"/g
      )) {
        const mod = sources[m[2]!]
        expect(mod, m[2]).toBeDefined()
        for (const raw of m[1]!.split(",")) {
          const name = raw.trim().replace(/^type\s+/, "")
          if (!name) continue
          checked++
          if (TYPE_ONLY.has(name)) continue
          expect(Object.keys(mod!), `${name} from ${m[2]}`).toContain(name)
        }
      }
    }
    expect(checked).toBeGreaterThan(20)
  })

  test("starts with the testnet-only warning", async () => {
    const readme = await Bun.file(
      new URL("../README.md", import.meta.url)
    ).text()
    expect(readme.split("\n").slice(0, 4).join("\n")).toContain("Testnet only")
  })
})
