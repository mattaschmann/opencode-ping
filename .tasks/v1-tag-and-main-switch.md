# Tag V1 baseline and switch `main` to V2

The V2 port lives on `v2` (`aae4bb6`). `main` (`6d7c158`) was the V1
implementation. The V2 plugin API has settled on OpenCode 2.0.x, so `main` is
being switched to V2 and the V1 baseline is preserved by tag.

## Decisions

- **Tag `main`'s tip as the last V1-compatible commit.** *Why:* once `main`
  fast-forwards to `v2`, the V1 implementation is only addressable by raw SHA.
  The annotated tag `v1` keeps it recoverable. (Done: `git tag -a v1 6d7c158`.)
- **Switch `main` to V2 now.** *Why:* the plugin loads and verifies against the
  running OpenCode 2.0.22 service. The `@opencode/plugin` pin was bumped from
  `2.0.6` to `2.0.22` to match. Rollback remains `git checkout v1`.
- **Fix family-aware idle before promoting.** *Why:* V2 fired `idle` whenever
  any session went quiet, so a finishing subagent pinged while the root was
  still working. The router now tracks session families and only pings idle
  once the root and all descendants have stopped.

## Implementation Plan

- [x] Tag `main` @ `6d7c158` as `v1`; push with `git push origin v1`.
- [x] Fix family-aware notifications on `v2` (`src/session/router.ts` + tests).
- [x] Bump `@opencode/plugin` to `2.0.22`; typecheck + 67 tests pass; plugin
      verified in `opencode plugin list`.
- [x] Note the family-idle behavior in `README.md`.
- [ ] Switch: `git checkout main && git merge --ff-only v2 && git push origin
      main`, then delete `v2` local + remote.
- [ ] Rebase/recreate the 5 Dependabot PRs against the new `main`.
