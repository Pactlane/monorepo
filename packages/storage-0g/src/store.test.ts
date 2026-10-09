import { expect, test } from "bun:test"
import {
  ArtifactIntegrityError,
  MemoryEvidenceStore,
  getVerified,
} from "./store"

test("round-trips and verifies bytes", async () => {
  const store = new MemoryEvidenceStore()
  const ref = await store.put("result", new TextEncoder().encode("# Report"))
  expect(new TextDecoder().decode(await getVerified(store, ref))).toBe(
    "# Report"
  )
})

test("a single corrupted byte fails verification", async () => {
  const store = new MemoryEvidenceStore()
  const ref = await store.put("task", new TextEncoder().encode("spec"))
  store.corrupt(ref.uri)
  await expect(getVerified(store, ref)).rejects.toBeInstanceOf(
    ArtifactIntegrityError
  )
})
