# When a New Workflow Breaks, Treat It Like Data

My first week shipping a PR workflow at LendingTree broke on day five — two of three posts sent before a Friday reset. It was frustrating, but it was also precise feedback: the orchestration assumptions weren’t explicitly captured. Instead of sweeping fixes, I treated the break as data, added simple observability, and hardened the state transitions. The result is a more resilient process and clearer handoffs between automation and human review. What one small metric would you instrument this week to make a brittle workflow observable?
