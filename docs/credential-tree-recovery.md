# Credential tree recovery (issue #1)

## Design

The append-only depth-16 Poseidon tree stores its frontier and recent roots, not all historical leaves. RPC retention is finite, so reconstructing from RPC alone fails when older events age out.

| Option | Benefits | Costs and limits |
| --- | --- | --- |
| Persistent indexed contract leaves | Direct ordered retrieval | O(n) entries, rent/TTL and archival restoration; upgrade and authenticated backfill required. |
| External indexer | Full history and scalable lookup | Needs archival bootstrap, ongoing ingestion, hosting and monitoring; data must be root-verified. Horizon's current-admin history may be incomplete after admin rotation or pruning. |
| Versioned snapshots and recent events | Low operating cost, compatible with existing gate | Initial complete history and frequent refresh required; an aged-out gap needs another archive. |

**Decision:** Use a versioned, network/gate-bound public snapshot as the historical prefix, merge indexed retained events and fall back to Horizon history. Use the actual RPC retention floor. Reject missing/conflicting indices, noncanonical field values, wrong snapshot identity, and mismatching roots. Verify the exact count and Poseidon root against stable on-chain reads; retry boundedly on concurrent additions. No contract deployment, secrets or new dependencies.

## Snapshot operations (testnet only)

The default snapshot is served at `/credential-snapshot.json` (Next.js `app/public/credential-snapshot.json`). Override using `NEXT_PUBLIC_CREDENTIAL_SNAPSHOT_URL`. From app/ after installing pinned dependencies:

```sh
REFRESH_CREDENTIAL_SNAPSHOT=1 pnpm vitest run src/lib/credential-snapshot.live.test.ts
```

The opt-in maintenance test reuses the previous local snapshot and atomically replaces it only after root verification. It signs no transactions. Bootstrap requires complete authentic history from RPC/Horizon or another archival source. Review and commit the generated snapshot, deploy it, and refresh inside RPC retention. Never publish fixture leaves as actual history. This implementation supplies a refresh entry point, not a deployed scheduler or indexer. If authentic history cannot be recovered, fail closed.

## Verification

Tests simulate late RPC scans, verify a newly issued credential's path against the independent Rust fixture, and cover corrupted, incomplete and reordered history and concurrent appends. Required release gates are cargo test in contracts/ and pnpm vitest run in app/ before an upstream PR; also run typecheck/lint. Live snapshot refresh is separate. AI-assisted candidate; no claim that full suites have passed until logs confirm them.

References: [getEvents](https://developers.stellar.org/docs/data/apis/rpc/api-reference/methods/getEvents), [getHealth](https://developers.stellar.org/docs/data/apis/rpc/api-reference/methods/getHealth), [Horizon retention](https://developers.stellar.org/docs/data/apis/horizon/api-reference/errors/http-status-codes/horizon-specific/before-history).
