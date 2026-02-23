# Building AI agents in public: start tiny, test ruthlessly, expect the last 20%

This week I spent most of my spare cycles connecting a Telegram-based personal assistant to my laptop so it can do small, concrete things for me — like create a ticket I forgot while on a walk. I also pushed a LinkedIn PR automation closer to production: every Friday at lunch it sends me a short interview script, then turns my answers into a storyboard and draft posts for the next week. I started a separate side project: a directory for dance studios, which still needs more work around data collection and scraping.

What moved forward: the Telegram assistant is becoming reliable (it likely needs a few more iterations), the PR automation is nearly there, and the directory remains a scraping/data-quality problem to solve. Two lessons keep surfacing: agents make it trivially easy to advance many projects at once — which is both powerful and distracting; and the last 20% always takes the longest because that’s where edge cases, tests, and integration headaches live.

Practical takeaway: start with a sharply bounded task and a clear acceptance test. If your automation can’t fail fast and loudly when something breaks, the convenience becomes a liability. For product teams that means defining the smallest useful surface area for an agent, automating checks, and making observability non‑negotiable.

A reminder from prior product work: integrating automation and data thoughtfully wins at scale — past initiatives I led increased customer engagement by 40%, delivered $500K+ of incremental value from data+forms integration, and drove ~$50K/month value from a new approval score model. Those outcomes came from tight scope, rigorous measurement, and relentless iteration — the same playbook I’m applying to these personal agents.

How are you deciding which automation to trust with real work versus which to keep manual for now?

Warmly,
Mark Gleason, MBA
Senior Product Manager, LendingTree
