# Study-First Recovery execution checkpoint

Date: 2026-11-11. Owner approved the three-release / 24-task repair plan and requested implementation. This branch starts R00 and R01 only; it does not claim the whole recovery is complete.

## Source and release boundary

- Baseline: `f697846aa2edbbd3aaa70eee1f063ab2392b78f3`.
- Work branch: `feature/study-recovery-a-20261111`, draft PR #93.
- Candidate cohort: `2026.11.11.1`.
- Main and production remain unchanged. No clinical lecture, catalog, source image, grade identity or exam scoring changes.
- R02 topic linkage, R03 durable resume, compact reader, unified question experience and exam setup improvements are NOT implemented here.

## Implemented scope

### R00 - preservation baseline (in progress until the real browser gate passes)

`tests/fixtures/study-baseline.json` freezes all 12 materialized lecture payload hashes, question identity / 138 MCQ answer-key digest and original media digest from the baseline build. `tests/study-preservation.spec.js` compares source and dist, delegates offline parity to the existing validator, deliberately rejects a tampered disposable fixture, and tests real saved grades plus an unfinished exam through navigation/reload. Tests use an isolated browser profile; no personal progress is uploaded.

### R01 - canonical entry and explicit context (implemented; exact-head CI/review required)

- Root, former Home and unknown workspace routes resolve to Library, not the old stacked study screen.
- The body starts with the Library surface to avoid flashing the old screen while metadata loads.
- `src/study-context.js` owns route resolution. `MEQStudyContext.get()` returns an immutable schema-v1 scope; `parse()`, `navigate()` and `subscribe()` share this boundary. `MEQWorkspace.openLecture()` remains compatible.
- Bare lecture links infer the actual course and specialty from the catalog. Explicit mismatched scopes recover to Library with a visible notice. Valid explicit links beat remembered UI selectors.
- Canonical URLs include course/specialty so Back/Forward can restore the intended view. Old `#lecture-ID` links still reach the same lecture.
- Sequence checks and course-aware loader completion prevent an earlier request from repainting a later reader.
- Library uses catalog metadata rather than eagerly fetching the whole clinical corpus. Reader loading requests the selected lecture.
- Actual reader mode updates the context even for legacy lectures whose first mode is Cases, not Explanation.
- Invalid-location notices clear after successful navigation; skip navigation remains within the active workspace.
- Online, standalone and service-worker asset cohorts include the same new controller; all three version sources are bumped together.

## Deliberate compatibility boundary

The unadvertised `#legacy` anchor temporarily preserves old controls while later recovery tasks migrate them. Historical tests for those controls retain their assertions and explicitly navigate to that compatibility surface. This is NOT proof that their actions are available in the new default UI. New root/deep-link/Back-Forward/standalone/responsive tests exercise the real user entry without the alias. WebKit now includes the new navigation and preservation tests as well as its original smoke suite.

## Evidence available before final branch CI

- Local `npm run quality:static`: passed (build, content/media/offline parity, syntax, repository and performance budgets).
- Two local R00 non-browser tests: passed, including intentional fixture corruption rejection.
- Isolated DOM probes: root becomes Library, direct cross-course lecture selection works, bad scope recovers, reader mode follows tabs, and tested widths do not overflow.
- Local Chromium HTTP/file navigation is blocked by execution-environment policy. Isolated `set_content` evidence is NOT proof of network loading, IndexedDB, browser persistence, service-worker behavior or production UX.
- Test-only real GitHub run `43014498877` failed Chromium before implementation; static and old WebKit passed. The implementation must pass a new exact-head run; old green results do not qualify it.
- No independent reviewer/subagent was run. Inline source review is not an independent approval.

## Temporary tooling cleanup

Read-only baseline export and a pinned branch-only source synchronization were used because the local environment could not reach GitHub/npm. All temporary workflows, transfer files and synchronization scripts were removed from the final branch tree. No production credentials, Access changes, release guard changes or forced updates were used. Only the normal read-only validation workflow should remain relevant to final eligibility.

## Remaining gate and next task

1. Inspect exact-head static, Chromium, WebKit and Workers Build; reproduce/fix failures without weakening required assertions.
2. Review source diff for protected content, storage/scoring and migration regressions.
3. Keep PR draft until evidence and review support completion. Do not merge or promote as a side effect of a status update.
4. Next implementation slice: R02, one source-reviewed topic/section index that keeps all original sections reachable. Then R03 durable reading/question checkpoints.
