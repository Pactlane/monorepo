import { describe, expect, test } from "bun:test"
import { fileURLToPath, pathToFileURL } from "node:url"
import { sha256Hex } from "@pactlane/core"
import { loadManifest } from "./load"

const fixtureUrl = new URL("../fixtures/testnet.example.json", import.meta.url)
const fixturePath = fileURLToPath(fixtureUrl)
const bytes = new Uint8Array(await Bun.file(fixturePath).arrayBuffer())
const pin = sha256Hex(bytes)

function fakeFetch(body: Uint8Array | string, status = 200) {
  const calls: string[] = []
  const fn = (async (url: URL | string) => {
    calls.push(String(url))
    return new Response(body, { status })
  }) as unknown as typeof fetch
  return { fn, calls }
}

describe("loadManifest", () => {
  test("loads an absolute path, a relative path and a file: URL", async () => {
    expect((await loadManifest(fixturePath)).network).toBe("testnet")
    const relative = await loadManifest("fixtures/testnet.example.json", {
      baseDir: fileURLToPath(new URL("..", import.meta.url)),
    })
    expect(relative.network).toBe("testnet")
    expect((await loadManifest(pathToFileURL(fixturePath).href)).network).toBe(
      "testnet"
    )
  })

  test("loads https with a matching pin", async () => {
    const f = fakeFetch(bytes)
    const m = await loadManifest("https://example.org/testnet.json", {
      fetch: f.fn,
      expectedSha256: `sha256:${pin}`,
    })
    expect(m.contracts["pactlane-commerce"].contractId).toStartWith("CB3DJM")
    expect(f.calls).toEqual(["https://example.org/testnet.json"])
  })

  test("rejects http: and other schemes before any request", async () => {
    const f = fakeFetch(bytes)
    await expect(
      loadManifest("http://example.org/testnet.json", { fetch: f.fn })
    ).rejects.toThrow("Refusing manifest over http:")
    await expect(
      loadManifest("ftp://example.org/m.json", { fetch: f.fn })
    ).rejects.toThrow("Refusing manifest over ftp:")
    expect(f.calls).toHaveLength(0)
  })

  test("pin mismatch throws, even for a valid manifest", async () => {
    const tampered = new TextEncoder().encode(
      new TextDecoder().decode(bytes) + "\n"
    )
    await expect(
      loadManifest("https://example.org/testnet.json", {
        fetch: fakeFetch(tampered).fn,
        expectedSha256: pin,
      })
    ).rejects.toThrow("Manifest pin mismatch")
    await expect(
      loadManifest(fixturePath, { expectedSha256: "0".repeat(64) })
    ).rejects.toThrow("pin mismatch")
  })

  test("reports download failures, bad JSON and invalid manifests", async () => {
    await expect(
      loadManifest("https://e.org/m.json", { fetch: fakeFetch("", 404).fn })
    ).rejects.toThrow("HTTP 404")
    await expect(
      loadManifest("https://e.org/m.json", { fetch: fakeFetch("{nope").fn })
    ).rejects.toThrow("not valid JSON")
    await expect(
      loadManifest("https://e.org/m.json", { fetch: fakeFetch("{}").fn })
    ).rejects.toThrow("Invalid deployment manifest")
    await expect(loadManifest("  ")).rejects.toThrow("No deployment manifest")
  })
})
