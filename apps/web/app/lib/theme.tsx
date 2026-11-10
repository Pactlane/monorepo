import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react"

export type Theme = "light" | "dark" | "system"

export const THEME_STORAGE_KEY = "pactlane-theme"

export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");var d=t==="dark"||((t===null||t==="system")&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`

interface ThemeState {
  theme: Theme
  resolvedTheme: "light" | "dark"
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeState>({
  theme: "system",
  resolvedTheme: "light",
  setTheme: () => {},
})

const media = () =>
  typeof window === "undefined"
    ? undefined
    : window.matchMedia("(prefers-color-scheme: dark)")

function readStored(): Theme {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY)
    return value === "light" || value === "dark" ? value : "system"
  } catch {
    return "system"
  }
}

function resolve(theme: Theme): "light" | "dark" {
  if (theme !== "system") return theme
  return media()?.matches ? "dark" : "light"
}

function apply(resolved: "light" | "dark", animate = true) {
  const root = document.documentElement
  if (root.classList.contains("dark") === (resolved === "dark")) return
  const swap = () => root.classList.toggle("dark", resolved === "dark")
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  if (!animate || reduce) return swap()
  if (typeof document.startViewTransition === "function") {
    document.startViewTransition(swap)
    return
  }
  root.classList.add("theme-transition")
  swap()
  window.setTimeout(() => root.classList.remove("theme-transition"), 500)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system")
  const [resolvedTheme, setResolved] = useState<"light" | "dark">("light")

  useEffect(() => {
    const stored = readStored()
    setThemeState(stored)
    setResolved(resolve(stored))
  }, [])

  useEffect(() => {
    if (theme !== "system") return
    const mq = media()
    if (!mq) return
    const onChange = () => {
      const next = resolve("system")
      setResolved(next)
      apply(next)
    }
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [theme])

  const setTheme = useCallback((next: Theme) => {
    try {
      if (next === "system") localStorage.removeItem(THEME_STORAGE_KEY)
      else localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {}
    const resolved = resolve(next)
    setThemeState(next)
    setResolved(resolved)
    apply(resolved)
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
