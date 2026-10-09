import {
  type RouteConfig,
  index,
  layout,
  route,
} from "@react-router/dev/routes"

export default [
  layout("routes/shell.tsx", [
    index("routes/home.tsx"),
    route("explore", "routes/explore.tsx"),
    route("agents/:agentId", "routes/agent.tsx"),
    route("jobs", "routes/jobs.tsx"),
    route("jobs/:jobId", "routes/job.tsx"),
  ]),
] satisfies RouteConfig
