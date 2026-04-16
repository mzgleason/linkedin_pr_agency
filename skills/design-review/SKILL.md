---
name: design-review
description: "Visual UI/UX design review using screenshots (and optional recordings). Use when the user asks for design feedback, wants screenshot-driven QA, or wants you to capture Playwright screenshots from the running app and return prioritized findings."
---

# design-review

Provide a visual design review using screenshots (and optionally screen recordings) to evaluate how an app actually looks against intended outcomes (mock, spec, acceptance criteria).

## When to use
- The user asks for UI/UX/design feedback and provides screenshots, or asks you to look at the running app.
- The user wants feedback relative to an intended result (Figma, mockup, written requirements, competitor reference).

## Inputs to request (only if missing)
1) Intended outcome: link/attachment (Figma/mock) or a short bullet list of goals.
2) Target surfaces: which pages/flows/states matter (happy path + edge cases).
3) Screenshot set: device + viewport(s) + states.
   - Recommended: desktop 1440×900, tablet 768×1024, mobile 390×844.
4) If you need to run it locally: startup command + URL + credentials (test account) + seed steps.

If the user can't provide mocks, infer intent from text and say so explicitly before reviewing.

## What to do (workflow)
1) Inventory the screenshots
   - List pages/states you can see (e.g., Home empty state, Form error state, Loading, Success).
   - Note device/viewport if visible (otherwise assume desktop and caveat).

2) Evaluate against intended results
   - Compare layout hierarchy, spacing rhythm, typography scale, color usage, component consistency, and interaction affordances.
   - Call out mismatches to spec (or missing states) with concrete references to the screenshot(s).

3) Prioritize findings
   - P0: blocks task completion / severe confusion
   - P1: major UX friction / visual bugs / accessibility issues
   - P2: polish / consistency improvements

4) Make recommendations actionable
   - Provide a specific change and where it should happen (component/page).
   - If code changes are requested/appropriate, point to files and propose a minimal patch plan.

5) Accessibility + quality pass
   - Contrast, focus states, tap targets, keyboard navigation assumptions, error messaging, form labels.
   - Responsive behavior: overflow, wrapping, truncation, alignment, safe-area on mobile.

## Output format (default)
Return:
- Summary: 2–4 sentences on overall alignment with intended results.
- Top issues (P0/P1 first): 5–10 bullets max, each with: What / Why / Fix.
- Polish wins: 3–8 quick improvements.
- Missing screenshots (if relevant): what states you need to fully verify.

## Screenshot guidance (tell the user)
Ask for:
- At least one "above the fold" and one "scrolled" capture per page.
- Error + empty + loading + success states for key flows.
- If animation/interaction matters: a short screen recording (5–15s).

## Take screenshots yourself (required for this skill)
This skill can capture its own screenshots using Playwright.

### One-time setup (repo)
- Install Playwright: `npm i -D playwright`
- Install browsers: `npx playwright install`

### Capture command
Run from the repo root:
- PowerShell: `powershell -ExecutionPolicy Bypass -File skills/design-review/scripts/capture.ps1 -BaseUrl http://localhost:3000 -Config skills/design-review/templates/routes.example.json`

Outputs to: `artifacts/design-review/` (PNG files + a `manifest.json` you can reference during review).

### Notes
- The app must already be running (default assumes `http://localhost:3000`).
- For authenticated pages, capture after you log in by providing a `storageState` path in the config (Playwright state JSON).
  - Create it once by logging in via Playwright (see `skills/design-review/scripts/capture.mjs` help output).

## Boundaries
- Don't invent requirements. If intent is unclear, ask 1–2 clarifying questions.
- Don't rewrite the whole UI. Prefer small, high-leverage fixes.
- Don't request sensitive credentials; use test accounts and redaction.

