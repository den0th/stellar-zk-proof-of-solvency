# CLAUDE.md — stellar-lab

> Repo-specific operating rules. Universal discipline lives in `~/.claude/CLAUDE.md` (don't duplicate it).
> To PROVE any change, use the **`verify-soroban`** skill (`.claude/skills/verify-soroban/SKILL.md`).
> Router + invariants: `SKILLS.md`.

## What this is

A Soroban (Stellar smart-contract) **monorepo lab**. Bootstrapped 2026-06-22 with `stellar contract init`
as the foundation for building a still-to-be-decided novel Stellar product ("olmayan bir şey" — TBD via a
brainstorm). Right now it holds the sample `hello-world` contract that proves the verify loop is real.

The product/scope is intentionally **not yet chosen** — do not assume a direction; it gets decided in the
brainstorm phase, then this file's "What this is" gets rewritten.

## Architecture / dir map

```
stellar-lab/
├── Cargo.toml                     # [workspace] members=["contracts/*"], soroban-sdk="26"
├── SKILLS.md                      # skill router + invariants (green-lie guard, PATH, safety)
├── CLAUDE.md                      # this file
├── .claude/skills/verify-soroban/ # the runtime verification loop (USE THIS to prove a change)
└── contracts/
    └── hello-world/               # sample contract (placeholder — replace with real product)
        ├── Cargo.toml             # soroban-sdk = { workspace = true }
        ├── Makefile               # build / test / fmt / clean
        └── src/{lib.rs,test.rs}   # #[contract] Contract::hello + a unit test
```

Future layers (not built yet — add a verify-<stack> skill when they land): TS SDK (`@stellar/stellar-sdk`),
an indexer, a web app. Mirrors the Zengen monorepo shape.

## Exact commands (verified green 2026-06-22 — never guess these)

**Always set PATH first** (repo's #1 scar — Homebrew cargo shadows rustup; see verify-soroban Blockers):
```bash
export PATH="$HOME/.cargo/bin:/opt/homebrew/bin:$PATH"
cd ~/stellar-lab
```

| Action | Command | Green signal |
|---|---|---|
| Build (wasm) | `stellar contract build` | `✅ Build Complete` + `target/wasm32v1-none/release/<crate>.wasm` |
| Test (unit) | `cargo test` | `test result: ok. N passed; 0 failed`, **N > 0** |
| Build+test (one shot) | `cd contracts/<name> && make test` | both of the above |
| Format | `cargo fmt --all` (or `make fmt`) | — |
| Clean | `cargo clean` (or `make clean`) | — |

Toolchain: stellar CLI **27.0.0**, rustup **stable 1.94.0**, target **`wasm32v1-none`** (one-time:
`rustup target add wasm32v1-none`). soroban-sdk **"26"** (resolved 26.1.x).

On-chain (testnet) is NOT configured yet. When needed: `stellar keys generate`, friendbot fund,
`stellar contract deploy --network testnet` — approval-gated, see Hard rules.

## Hard rules

- **Green-lie guard is law.** A change is done only when the real success TEXT is observed in the same run
  (build `✅ Build Complete` + wasm present; test `N passed; 0 failed`, N>0). Failed build ⇒ STOP; never run
  tests against a stale binary. A piped exit code can lie — trust the text. (Full guard: verify-soroban §0.)
- **Recipes are hypotheses — run them.** Don't assert "it builds/tests pass" without a real green run.
- **PATH:** `~/.cargo/bin` before `/opt/homebrew/bin`, always.
- **Safety / no surprises:** no mainnet deploy or invoke, no funding moves, no secret-key material echoed
  (`stellar keys`/seed phrases), default read-only — none of these without explicit per-action approval.
- **Self-improving loop:** hit a new blocker, fix it, then append blocker+fix to verify-soroban's
  `## Blockers & fixes` the same session.
- Files here are **uncommitted**; the operator commits.
