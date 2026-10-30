import { expect, test } from "bun:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { MemoryRouter } from "react-router"
import { agentId } from "../../../packages/test-utils/src/fixtures"
import AgentPage, { loader } from "../app/routes/agent"

test("Research Scout renders a similar-agent link using existing fixture data", async () => {
  const loaderData = await loader({ params: { agentId: agentId(2) } })
  expect(loaderData.agent.profile.displayName).toBe("Research Scout")
  expect(
    loaderData.similar.map(({ profile }) => profile.displayName)
  ).toContain("Scribe")
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <AgentPage loaderData={loaderData} />
    </MemoryRouter>
  )
  expect(html).toContain("Similar agents")
  expect(html).toContain("Scribe")
})
