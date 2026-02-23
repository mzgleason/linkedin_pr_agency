# A tiny checklist to make an agent dependable

If you want an agent to actually save time, try this short checklist I used this week:
- Define the single smallest task it should do (no scope creep).
- Write an acceptance test that’s easy to run (pass/fail).
- List the top 5 edge cases and how the agent should respond.
- Add simple observability: logs, alerts, and a manual override.
- Timebox iterations: ship a working v1, then spend focused sprints on the last 20%.

Agents will push your backlog forward whether you’re watching or not. Make sure the parts you care about have clear tests and fallbacks.

What’s the one test you’d add to this list for your team?

Warmly,
Mark Gleason, MBA
Senior Product Manager, LendingTree
