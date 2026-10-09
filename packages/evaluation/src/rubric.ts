import type { RubricCheck, TaskSpec, Verdict } from "@pactlane/core"

export interface CheckResult {
  kind: RubricCheck["kind"]
  passed: boolean
  detail: string
}

const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length

function headings(markdown: string): string[] {
  return [...markdown.matchAll(/^#{1,6}\s+(.+?)\s*$/gm)].map((m) =>
    m[1]!.toLowerCase()
  )
}

export function runCheck(check: RubricCheck, content: string): CheckResult {
  switch (check.kind) {
    case "required_sections": {
      const found = headings(content)
      const missing = check.sections.filter(
        (s) => !found.includes(s.toLowerCase())
      )
      return {
        kind: check.kind,
        passed: missing.length === 0,
        detail: missing.length
          ? `missing: ${missing.join(", ")}`
          : "all sections present",
      }
    }
    case "min_words": {
      const n = wordCount(content)
      return {
        kind: check.kind,
        passed: n >= check.value,
        detail: `${n} words (min ${check.value})`,
      }
    }
    case "max_words": {
      const n = wordCount(content)
      return {
        kind: check.kind,
        passed: n <= check.value,
        detail: `${n} words (max ${check.value})`,
      }
    }
    case "contains": {
      const lower = content.toLowerCase()
      const missing = check.terms.filter(
        (t) => !lower.includes(t.toLowerCase())
      )
      return {
        kind: check.kind,
        passed: missing.length === 0,
        detail: missing.length
          ? `missing terms: ${missing.join(", ")}`
          : "all terms present",
      }
    }
    case "format": {
      let passed: boolean
      if (check.value === "json") {
        try {
          JSON.parse(content)
          passed = true
        } catch {
          passed = false
        }
      } else if (check.value === "markdown") {
        passed = headings(content).length > 0
      } else {
        passed = content.trim().length > 0
      }
      return { kind: check.kind, passed, detail: `expected ${check.value}` }
    }
  }
}

export function evaluateContent(
  task: TaskSpec,
  content: string
): { verdict: Verdict; checks: CheckResult[] } {
  if (!content.trim()) {
    return {
      verdict: "needs_review",
      checks: [{ kind: "format", passed: false, detail: "empty deliverable" }],
    }
  }
  const checks = task.rubric.map((c) => runCheck(c, content))
  return { verdict: checks.every((c) => c.passed) ? "pass" : "fail", checks }
}
