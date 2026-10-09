import { type RouteConfig, index, layout, route } from "@react-router/dev/routes"

export default [
  layout("routes/shell.tsx", [index("routes/home.tsx"), route("explore", "routes/explore.tsx")]),
] satisfies RouteConfig
