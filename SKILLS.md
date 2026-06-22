# stellar-lab — skill router

The one place that names this repo's invariants + the green-lie guard. Route to the right skill;
don't restate rules elsewhere.

## Route

| If you are… | Use |
|---|---|
| changing a contract and need to PROVE it builds + tests pass | **`.claude/skills/verify-soroban/SKILL.md`** |
| deploying / interacting on-chain (testnet/mainnet) | not yet built — `TODO: verify-onchain` (approval-gated) |
| adding a TS SDK / indexer / web layer | not yet built — `TODO: verify-web` when that layer lands |

## Invariants (apply everywhere)

1. **Green-lie guard.** "Verified" requires the REAL success signal observed in the same run:
   build → `✅ Build Complete` + wasm file present; test → `test result: ok. N passed; 0 failed`, N>0.
   `0 passed` / failed build = STOP, never test a stale binary. The **text** is truth, not a piped exit code.
2. **Recipes are hypotheses** — run before trusting. **PATH:** `~/.cargo/bin` before `/opt/homebrew/bin`.
3. **Safety:** no mainnet deploy/invoke, no funding, no secret-key echo, default read-only — all without
   explicit per-action approval.
4. **Self-improving:** new blocker + fix → append to the relevant verify skill's `## Blockers & fixes`.

Full detail lives in the verify skill — this router only points and states invariants once.
