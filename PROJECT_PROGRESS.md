# Medical MEQ Bank — Project Progress & Scalability Program

### 2026-10-21 — Collision-safe lecture draft authoring

- 🧪 The lecture skeleton generator now includes **course + specialty + title** in its default globally unique lecture ID, rather than specialty/title alone. This avoids a confusing registration collision when the same specialty or lecture name appears in different medical courses.
- ✅ Preserved explicit `--id` overrides, all already-published lecture IDs, their clinical content and the `--write --reviewed` publication gate. No existing lecture was renamed.
- 🧪 Updated the stdlib authoring regression and added a two-course same-specialty fixture to verify unique drafts are created, without mutating the protected baseline/catalog. Updated CONTENT_AUTHORING.md example.
- ⏳ Exact-head static/Chromium/WebKit quality gates required before protected merge. This is an authoring quality-of-life fix, **not** a claim that PDFs can be automatically published without source review.


### 2026-10-21 — V3 dark-mode design-token cleanup (2026.10.21.5 candidate)

- ✅ Merged real-deployment smoke [PR #33](https://github.com/Hafezalhoot/medical-meq-bank/pull/33) after exact-head validate, Chromium, WebKit and Cloudflare preview checks passed; protected-main CI [#39667472916](https://github.com/Hafezalhoot/medical-meq-bank/actions/runs/39667472916) is green. The independent live Worker smoke is tracked separately in [#39667473228](https://github.com/Hafezalhoot/medical-meq-bank/actions/runs/39667473228); do not infer production success merely from merge.
- 🔎 Inspected the layered V1/V2/V3 CSS cascade and found legacy blue/navy literal backgrounds still overriding V3 dark theme on shared toolbars, controls, question surfaces and course-library cards, despite V3 teal semantic variables already existing. Also found an obsolete initial blue `:root` palette shadowed by the later V3 palette.
- 🧪 On the isolated dark-token branch, replaced obsolete hard-coded dark backgrounds/active colors with existing `--card`, `--surface-soft`, `--surface-subtle`, `--brand-soft`, `--brand`, `--line`, and `--text`; retained semantic success/warning colors and all functionality.
- 🧪 Removed only unused early root palette declarations that the final V3 root completely overrides, retaining the original status tokens. No layout grid, content, medical image/answer, app progress or offline storage logic changed.
- 🧪 Added Playwright CSSOM assertions at 390px and 1440px for dark V3 surface tokens, all three Course Library entries and zero overflow. Candidate release version `2026.10.21.5` synchronized in `version.json`, Service Worker, and PWA client.
- ⏳ Gate: full static/Chromium/WebKit and Cloudflare preview must pass on the exact PR head; only then consider a protected-main merge and check live deployment. Do not claim visual signoff for the new dark styling without screenshots/owner review.


### 2026-10-21 — Confirmed Cloudflare Access blocker and safe service-authenticated QA

- ✅ The updated post-main [live run #39669065228](https://github.com/Hafezalhoot/medical-meq-bank/actions/runs/39669065228) proved the **exact** cause: `/version.json` redirects with HTTP 302 to `hafztamr.cloudflareaccess.com/cdn-cgi/access/login/`. This is Cloudflare Access authentication, **not proof of missing JSON in dist**. Previous smoke failure is now source-classified and reported in [issue #35](https://github.com/Hafezalhoot/medical-meq-bank/issues/35).
- 🧪 Added optional `MEQ_CF_ACCESS_CLIENT_ID` and `MEQ_CF_ACCESS_CLIENT_SECRET` GitHub Actions secrets for the automated production smoke. The script refuses half-configured credentials and a production origin other than the pinned approved Worker. Service headers are attached to HTTP health probe and browser requests **only when origin matches**, never to redirected Access/login/third-party requests.
- 🧪 Added Chromium-run Node regressions for incomplete token configuration and cross-origin credential refusal, plus deployment instructions for a dedicated Cloudflare **Service Auth** policy. No account secrets were created, exposed, committed, or requested in chat.
- ⏳ The owner must create/authorize the Service Token in Cloudflare Zero Trust and save both values as GitHub repository Actions secrets. Do **not** disable Cloudflare Access to make a red smoke test green. Until configured and the test runs successfully, public Worker version/UI cannot be confirmed by automated CI.
- ⏳ V3 dark UI token cleanup remains isolated in [PR #34](https://github.com/Hafezalhoot/medical-meq-bank/pull/34); do not combine authentication and visual changes into one unverified release.


### 2026-10-21 — Live Worker health check exposed an unresolved HTML response

- ✅ The independent post-merge live Cloudflare smoke [run #39667473228](https://github.com/Hafezalhoot/medical-meq-bank/actions/runs/39667473228) executed from GitHub's network and **failed**: `/version.json` returned HTML rather than JSON on 18 consecutive attempts. Meanwhile [main CI #39667472916](https://github.com/Hafezalhoot/medical-meq-bank/actions/runs/39667472916) passed validate, Chromium, and WebKit. Thus source correctness and public release reachability are distinct.
- ⚠️ The first smoke script did not capture whether the HTML was a Cloudflare Access login page, app-index fallback or other route; do not assert the exact root cause yet.
- 🧪 Added a fail-fast HTML/redirect diagnostic that captures safe Content-Type/status/title/redirect path only (never full HTML content or credentials), while retaining deployment-propagation polling for genuine JSON version mismatch.
- 🧪 Expanded DEPLOYMENT.md with an operator checklist distinguishing Access login from static asset fallback and an explicit prohibition on bypassing access policy just to pass CI.
- ⏳ The hardened smoke must pass protected PR tests, merge and execute to classify the real response; Cloudflare Access and Worker version promotion are operational settings outside this GitHub repository. Do not call the production UI repaired until independent live verification succeeds.


### 2026-10-21 — Production verification guard (PR pending)

- ✅ Confirmed protected `main` commit `95725f3ca40a56db838320980cc161df23da163b` passed all three existing validation jobs in [Actions #39661802301](https://github.com/Hafezalhoot/medical-meq-bank/actions/runs/39661802301). PRs #30–#32 are merged.
- ✅ Added `scripts/production_smoke.mjs` to directly verify Cloudflare `/version.json` against the current checked-out version, rendered 390/768/1440px live UI, one CSS/JS release cohort, measured hero/icon sizing and zero overflow, stale-service-worker CSS isolation, dark mode, and 14 original hosted Dermatology photographs with SHA-256 verification + 30 MCQs.
- ✅ Added an independently named GitHub Actions workflow to run the real production smoke on `main` pushes, each morning, and manually; it uploads screenshots and structured result evidence even on failure. It does not replace or weaken the existing static/Chromium/WebKit quality gates.
- ✅ Included the new Node smoke script in the existing static syntax gate.
- ⏳ Source-only review at this stage; live Worker could not be inspected from the current assistant environment. The newly added smoke workflow must be validated on the PR, merged only after existing checks pass, and its real production run verified before claiming the public release fixed.
- ⚠️ Cloudflare deployment/Access governance and licensed redistribution of printed book photographs remain separate owner checks. No exam facts, answer keys, progress DB data or source medical images changed.


### 2026-10-21 — Tablet/desktop original course text and study-path layout (2026.10.21.4)

- ✅ After the 320/390 mobile fixes, checked the *exact* `2026.10.21.3` main build at 320,390,768,1440 in local Chromium. Every size had no horizontal document overflow, 18px icons, 14 original hosted Dermatology images and 30 MCQs. Main Actions [#39660277049](https://github.com/Hafezalhoot/medical-meq-bank/actions/runs/39660277049) passed all three CI jobs.
- 🔎 Found another related omission: `Internal Medicine II` needed about 132px of select text space on tablet/desktop but had only 92px at 768px and 119px at 1440px. Fixing mobile alone did not address this. This was found by *measuring rendered control font widths*, not inferring from CSS.
- ✅ At typical desktop widths (>=981px), allocated the course dropdown a slightly wider share of the Study Path two-column panel. At 701–980px tablet widths, use one orderly column for long course/specialty labels and the Start Studying button, reducing grid gaps to preserve initial lecture access.
- ✅ Added Chromium/WebKit behavioral assertions at 768,1024,1280,1440px for both full native select labels and correct tablet control order. Source facts, media assets, answers, PWA offline data, progress keys and existing course IDs remain unchanged.
- ⏳ Version `2026.10.21.4` is proposed for CI and Cloudflare auto-deploy after protected-main merge. Live Worker appearance is **not confirmed** without an external production screenshot/version check.

### 2026-10-21 — Mobile course labels and filter action visibility (2026.10.21.3)

- ✅ Re-verified the built V3 release candidate locally in Chromium at **320, 390, 768, 1280 and 1440px**: all widths showed **0px horizontal overflow**, **18px navigation SVG icons**, coherent teal hero, and no JavaScript page errors. The locally rendered, self-contained HTML is not proof that Cloudflare promoted this release.
- ✅ Tested Dermatology reader in the same actual build: **14 original JPEG images, 30 MCQs**, selecting an answer and toggling dark mode without page errors.
- ✅ Found a reproducible second-order mobile issue: on 390px, `Internal Medicine II` required ~127px of native select text width but had only 120px, cutting the course name; on 320px, both course and specialty need balanced width. Adjusted the native selector grid and typography by viewport without replacing the accessible controls.
- ✅ Found that the initial lecture filter chip pushed `Clear all` partly outside the mobile scroll strip. Capped chip text width at narrow sizes while keeping horizontal scrolling available for multiple simultaneous filters.
- ✅ Added browser checks for legible current course/specialty options and reachable Clear all at 320px and 390px, plus retained previous regression gates. App version and PWA cache cohort bumped to **2026.10.21.3**.
- ⏳ Confirm latest PR and post-merge CI, plus physical Cloudflare live screenshot; do not claim the public site is visually fixed without that check.

### 2026-10-21 — P0 production CSS/JS mismatch: V3 hotfix and regression protection

- 🚨 User screenshot of live `2026.10.21.1` showed blue old hero, oversized SVG controls, overlapping theme/selection buttons, exposed skip link and large empty gaps, despite all previous PR CI passing.
- ✅ Root cause traced to old active Service Worker combining **network-first new HTML** with **global cache-first old CSS/JS**. Existing screenshot tests disabled Service Workers and did not catch this mismatch.
- ✅ Implemented `?v=2026.10.21.2` for every runtime CSS/JS in generated online HTML and version-matched SW precache; asset fetch reads only release-specific cache. The content/standalone offline HTML remains preserved.
- ✅ Downloaded original lectures/images are migrated to a stable user-lesson cache before old app cache retirement; IndexedDB progress isn't rewritten. Added 18px intrinsic SVG safeguards and mobile/tablet discovery compaction.
- ✅ Added SW-enabled Playwright CSS-cache-poisoning, offline-lesson-migration and 320/390/768/1280/1440 responsive tests. Updated static HTML validators rather than bypassing existing checks.
- ✅ Documented confirmed defects and deferred improvement backlog in [PRODUCTION_UI_AUDIT_2026-10-21.md](PRODUCTION_UI_AUDIT_2026-10-21.md).
- ⚠️ Exact last-commit CI and Cloudflare live visual proof are release conditions. Do not claim browser production repair just from successful GitHub Actions.

### 2026-10-21 — Original Dermatology images hosted directly by learner request

- ✅ Learner explicitly requested the 14 authentic printed-source Dermatology photographs to render automatically for all visitors, like the existing Surgery lecture images. The 14 reviewed JPEG crops were added as **separate same-origin static assets** under `assets/lectures/dermatology-introduction/`, preserving exact original SHA-256 and source page attribution.
- ✅ Each existing Dermatology Image Spot now references its own JPEG URL and original byte count without changing answer keys, question IDs, course location or saved progress. The original PDF and handwritten annotations are still omitted.
- ✅ Embedded AVIF and local source-JPEG verification remain strict and independent. Source images are not generated or downloaded from third parties.
- 🧪 Pending at this stage: make original image atlas render hosted photos, update offline standalone embedding and Playwright browser tests, rerun all three CI jobs before merging/prod deployment.
- ⚠️ The site/repository are public. The uploader should confirm they have any necessary permission to redistribute textbook photographs. Revert source-image asset publication if a verified rights issue arises.

### 2026-10-20 — V3 release candidate hardening: original-source media authoring and memory

- ✅ Closed the lecture-intake validation gap: `tools/add_lecture.py` now checks the source-image SHA-256, page, caption/prompt and optional byte count **before writing reviewed lecture records**. Invalid images fail a dry run; existing Surgery lecture sources and progress IDs remain untouched.
- ✅ Added `tools/check_original_figure_pack.py` to check an entire **private** original-photo ZIP against reviewed lecture JSON: expected IDs/count, manifest, printed page, JPEG header, byte count and exact SHA-256. It reads ZIP entries without extracting images, uploading or redistributing scans. Tests cover falsified fingerprints, missing files, unsafe paths and wrong pages. The quality gate runs all `test_*.py` Python tests.
- ✅ Integrated private ZIP checking into the staged `prepare_original_figure_pack.py` workflow so package integrity is checked **before** touching canonical metadata. Original book scans are never committed publicly.
- ✅ Verified Dermatology's 14 original JPEG crops against all 14 source-question SHA-256 fingerprints using the user's private source pack in the working environment.
- ✅ The source-image atlas no longer depends on the optional studyGuide: a new course containing only source-photo Image Spots renders its gallery and source-only wording immediately.
- ✅ Imported picture Blobs and object URLs are reclaimed from runtime memory when leaving a lecture, while original photos remain device-private in IndexedDB for later offline review. Browser test covers switching to Surgery and returning to Dermatology with the same verified source image.
- 🧪 Version `2026.10.20.2` in app metadata, service worker and PWA client; latest-head validate/Chromium/Safari-WebKit still required after release-version bump.
- ⚠️ PR #28 remains a **Draft**, with the current Cloudflare production version unchanged. The learner must approve public publication rights before the source-book JPEGs could be placed on publicly accessible infrastructure; this branch intentionally uses local-only imports.

### 2026-10-20 — Clinical reader layout review and latest full CI green

- ✅ Audited real Chromium desktop/tablet/390px/320px screenshots of the revised reader. Found original-photo onboarding occupying excessive pre-lecture space and interrupting the start of explanation. Replaced it with a compact accessible `<details>` control showing the saved-photo count even when collapsed; import guidance and selection stay available when expanded.
- ✅ Added keyboard Enter open/close and 390px no-overflow regression tests; captured collapsed and expanded image-import states and a **1280x800 laptop layout**, complementing 320/390/768/1440 coverage.
- ✅ Cached successful SHA-256 checks for immutable imported Blob objects to reduce duplicate hashing on subsequent renders, without accepting an unverified image; guarded asynchronous image-count text from cross-course stale updates.
- ✅ Advanced coherent `version.json`, service-worker and PWA client version to **2026.10.20.1** so the tested redesign has a separate cache namespace.
- ✅ [Actions #39417994882](https://github.com/Hafezalhoot/medical-meq-bank/actions/runs/39417994882) passed static `validate`, Chromium and Safari/iPhone WebKit on the latest changes including the 1280px screenshot test.
- ✅ Prepared refreshed *private* original-source 14-JPEG Dermatology HTML preview in the conversation; this private file is not committed to a public repository and it is not the Cloudflare site.
- ⚠️ Remaining: learner's final visual sign-off and explicit image reuse authorization **only if** the original book photos should be hosted publicly; Cloudflare manual deployment and live-version check cannot be replaced by successful GitHub CI.

### 2026-10-20 — Continue V3: generic source-only media pipeline and P0 CI repair

- ✅ Source-photo SHA-256 fingerprints moved into each Dermatology image-question record (existing `imageSha256` field) with unchanged question IDs, printed page mappings, teaching answers and course placement. Both lecture gallery and spot cards detect source photos from metadata, not a Dermatology-only hardcoded condition.
- ✅ Replaced fixed-ID/fixed-course original-photo importer with one using each selected, loaded lecture's **image-question IDs, SHA-256 and page metadata**. IndexedDB keys remain per-lecture, preserving existing Dermatology saved images after upgrade.
- ✅ Original-only media is still private: no source JPEG from the textbook is committed or sent to a server; renamed substitutes fail the hash verification.
- ✅ Found an actual build P0 when existing `scripts/validate_lecture_images.py` misinterpreted source-only JPEG hash metadata as embedded AVIF. Updated validation to enforce the embedded AVIF byte-count contract **and** independently validate nonembedded, page-attributed, source-photo SHA-256 (without permitting a fake image URL).
- ✅ New private `tools/prepare_original_figure_pack.py` supports review-controlled crop maps and original JPEG background extraction from the user's source PDF. It packs verified-page crop JPEGs privately and may update lecture source hashes only through explicit review flags. No medical answers are generated or modified.
- 🧪 CI workflow compiles the authoring tool on every build, and source-image tests include an arbitrary image ID with a safe **test-only, nonclinical** JPEG fixture to verify that future lectures don't need dedicated frontend code.
- ⚠️ This code change is pending final latest-head validation and browser evidence; don't merge or promote to Cloudflare if any gate fails. Original book redistribution rights remain unverified, so production would require private local image import.

### 2026-10-17 — V3 image-source integrity, verified ZIP import, original-photo atlas

- ✅ Implemented **SHA-256 pinned original medical figure imports**: the 14 exact source crops, mapped to `derm-image-001` through `derm-image-014`, are accepted only if their file contents match the lecture-provenance hashes. Renaming arbitrary or generated images cannot make them appear as authentic medical source material.
- ✅ Added **single ZIP selection** of the private `MEQ_Dermatology_Original_Photos_Pack.zip` as well as multi-select JPEG fallback. Browser-local ZIP decompression reads only matching filenames, enforces entry/size limits, verifies each decoded JPEG, and does **not transmit source content to any server**. On browsers without supported archive decompression, learners can extract the package and import JPEGs.
- ✅ Added a responsive **Original lecture photographs atlas** to the third study-guide panel, with all 14 printed-source page references; imported originals appear in both atlas and Image/Spot cards. Missing and rejected images display an honest source-not-available state. Source content and review answers are unchanged.
- ✅ Added test cases for 14 atlas slots, no synthetic infographic, mobile layout, counterfeit renamed image rejection, fake ZIP image rejection and no false persisted original-image labeling.
- ✅ [Actions run #39042336478](https://github.com/Hafezalhoot/medical-meq-bank/actions/runs/39042336478) passed **all three** quality gates (validate, Chromium, desktop/iPhone WebKit) on `01e15130040fc6afc040dc00c5fc5b2a04934f2c`. No test was force-clicked, skipped, or weakened to claim source fidelity.
- ✅ Independently ran the **actual built app's ZIP-unpacking routine** in Node 22 against the private 14-JPEG package: **14/14 decoded correctly and matched SHA-256**. Verified the manifest itself maps all files to the proper printed PDF pages; the skin-structure photo intentionally appears in both slots 001/002.
- ✅ Prepared a **self-contained personal-use offline HTML preview** of V3 version `2026.10.17.3` with exactly those original 14 JPEGs embedded, and an associated private review ZIP/README. Confirmed private HTML structural integrity, embedded source SHA-256 and zero external CSS/script dependencies. **This preview has not been tested interactively in a local browser**, due to environment browser restrictions; use it to review presentation privately.
- ⚠️ Existing Surgery lecture payloads contain source-attributed base64 figures. Their complete publication-provenance records cannot be established from code alone; **preserve them** until their originals are checked, and apply original-only policy to all *new* intake.
- ⚠️ No permissions to publicly redistribute the Dermatology book's clinical photos were supplied. Only the **private user's downloaded copy** contains those files. PR #28 remains Draft and production/main remains unchanged pending the learner's visual approval, original-image licensing clarification, and final merge/deployment authorization.

### 2026-10-17 — V3 redesign / original-only lecture figures (DRAFT PR #28)

- ✅ The learner requested a **substantial visual and information-architecture redesign**, not a superficial style pass, while preserving all previously implemented study capabilities and stored answers/progress.
- ✅ Applied Impeccable critique/audit and UI/UX Pro Max principles to choose a **reader-first clinical editorial** experience: compact working header, paired Course Library / My Review, restrained teal/ink surfaces, typography with generous medical reading rhythm, mobile/dark treatment, and reduced card/chrome noise.
- ✅ Kept the existing registered courses/subjects, lecture IDs, progress key format, surgery payloads, MEQ cases, core/detailed questions, source-linked explanation, 4-choice MCQ, image spots, rapid recall, offline, search, print, and backup. A renamed or rewritten medical answer requires a new medical review and is outside this design iteration.
- ✅ Confirmed all 14 Dermatology image questions formerly pointed to three **assistant-authored schematic SVGs**. Removed **all 14** figure URLs and the V2 synthetic SVG infographic reference from the Dermatology payload; retained 14 item IDs and answer content, and restored authentic printed-PDF page-linked figure prompts. No outside photographs or generated diagrams are supplied.
- ✅ The original **10-page scanned PDF** contains embedded printed-page background JPEGs distinct from personal handwritten overlay annotations. Cropped **14 figures from the actual printed textbook background images** (skin layers, macule, patch, papule, plaque, vesicle, bulla, pustule, wheal, open comedo, burrow, crust, scale); created a separately delivered personal original-photo ZIP with per-figure source page/coordinates/SHA-256. The ZIP is **not committed to the public repository**.
- 🧪 Added a local-only, IndexedDB-backed original-figure import for `derm-image-001.jpg` through `derm-image-014.jpg`, a missing-photo message, page provenance and full-size view. Original medical images remain private to the student's browser until the owner proves redistribution rights and explicitly requests public hosting. The underlying lecture JSON and progress records are separate.
- 🧪 Release-candidate version `2026.10.17.2`; draft [PR #28](https://github.com/Hafezalhoot/medical-meq-bank/pull/28) is isolated from protected production. **No production merge/deploy** until latest-head static/Chromium/WebKit CI, visual browser QA, offline import regression and owner sign-off.
- ⚠️ Ongoing: stabilize any test failures from replacing schematic media, perform real 320/390/768/1440 screenshot review (light/dark/RTL), and ensure source-only-media policy is test-enforced. Do not confuse a bundled personal ZIP with a licensed/publicly redistributable scan.

### 2026-10-17 — Release candidate CI cache-version test repair

- ✅ [run 39031460721](https://github.com/Hafezalhoot/medical-meq-bank/actions/runs/39031460721): `validate` and iPhone/Safari `webkit-quality` passed after fixing the obstructed accordion tap. Chromium completed 72/73 tests; the remaining failure was in a test still opening a hardcoded **old app-version cache** (`2026.10.16.3`) after the intentional PWA bump to `2026.10.17.1`.
- 🧪 Replaced both hardcoded versioned-cache references in the test with a read of the built `/version.json`; the source/PWA cache behavior is unchanged. Await latest-head clean validate, Chromium and WebKit before merge.
- ⚠️ Production promotion stays independent from GitHub merge because Cloudflare currently uploads Worker versions without automatically promoting them.

### 2026-10-17 — Requested release: fix iPhone sticky header and verify before merge

- ✅ User requested publication of the V2 workspace and Dermatology lecture. No source PDF or copyrighted clinical photos are included.
- ✅ Inspected full WebKit trace for failed run [38971747357](https://github.com/Hafezalhoot/medical-meq-bank/actions/runs/38971747357): the sticky mobile search field repeatedly intercepted clicks on the MCQ disclosure summary after automatic scrolling; this was a real hit-target issue, not a wrong exam answer.
- 🧪 Added mobile scroll padding and summary scroll margin, plus a WebKit test checking the normal summary's hit point is unobstructed before clicking, including infographic. No test disabled or force-clicked.
- 🧪 Version bumped from 2026.10.16.3 to **2026.10.17.1** in version.json, service worker and PWA client. Await full three-job CI matrix on this commit before merging protected main.
- ⚠️ Cloudflare Worker release currently uses version-upload-only, requiring manual promotion and live-version verification. Production is not confirmed merely by GitHub merge. Preserve rollback and progress data.

### 2026-10-16 — Exam source scope explicitly confirmed by learner

- ✅ Learner confirmed that **printed teaching text only** in the reattached 10-page `Dermatology Department book 2022.pdf` is examinable; handwritten marginal notes and embedded chat screenshot were personal understanding annotations and **must not be treated as exam facts**.
- ✅ Applied this source rule to the Dermatology review checklist, the lecture's own source metadata and the PR #27 handoff. Small explanations are permitted only as clearly labeled non-exam understanding aids.
- 🧪 Stabilized intermittent iPhone/Safari MCQ smoke flow to verify the details panel is open and choose a visible **label** (normal user touch interaction), then assert that the associated radio input is checked. Previous docs-only run [38963924179](https://github.com/Hafezalhoot/medical-meq-bank/actions/runs/38963924179) passed static/Chromium but intermittently failed the mobile WebKit MCQ check; test coverage remains mandatory rather than suppressed.
- ⚠️ **Remaining gates:** latest commit validate/Chromium/WebKit run, manual individual image-spot legibility review, final bilingual editorial approval, source/publication rights and controlled Cloudflare promotion. PR #27 remains Draft; no merge or deployment has been approved.

### 2026-10-16 — Phone infographic reading improvement (PR #27)

- 🧪 Desktop screenshots showed a clear original SVG infographic, but the legacy `max-width:100%` image scaling would shrink its detailed labels to unreadable sizes on narrow phones.
- 🧪 Added an accessible keyboard-focusable horizontal image scroller on screens <=700px, an explanatory swipe hint and a same-origin **Open full-size infographic** link that works with cached offline assets.
- 🧪 Extended real-lecture Playwright coverage to assert scrollable image width, no document-wide overflow and functional full-size link; attached a targeted 390px evidence screenshot.
- 🧪 First updated run [38962874110](https://github.com/Hafezalhoot/medical-meq-bank/actions/runs/38962874110): `validate` and `webkit-quality` passed; Chromium's 72 other tests passed, but the new 390px test tried to select the **intentionally hidden mobile lecture filter** without first opening the mobile filter drawer. Corrected the test helper to open/close the actual mobile drawer. Re-run required; no product-code regression was established by this test setup failure.
- ✅ **Validated release-candidate code:** [run 38963528101](https://github.com/Hafezalhoot/medical-meq-bank/actions/runs/38963528101) passed all three quality jobs (`validate`, `chromium-quality`, `webkit-quality`) on `d5683a1cd2c3044e68f41063f18462b4b49df324` after correcting the mobile drawer test setup.
- ✅ Manually inspected actual Playwright browser screenshots: 1440px desktop infographic remains readable; 390px mobile infographic renders at larger readable scale with a visible sideways-swipe hint and full-size image link. The dedicated mobile test checks inner horizontal scroll and no page-wide overflow.
- ⚠️ Per-image-spot card legibility on physical mobile devices and final learner/lecturer editorial and rights sign-off are still pending. Handwritten annotations are explicitly excluded from exam content by learner decision. No protected-main merge or Cloudflare promotion is authorized.

### 2026-10-16 — Continuation: original Dermatology scan reattached and draft source rechecked

- ✅ The learner reattached `Dermatology Department book 2022.pdf` (10 image-only pages); a fresh page-by-page visual review compared printed claims with the drafted **Internal Medicine II → Dermatology → Introduction to Dermatology** lecture.
- ✅ Cross-checked 11 source-page Explanation sections, 30 four-choice MCQ answers/rationales, 16 morphology vignettes, 70 Core Shorts, 17 Detailed Shorts, 14 original-schematic image prompts and 41 Rapid cards against the supplied printed text. No clear printed-content contradiction was found in this pass.
- ✅ Preserved the lecture's figures and wording: 1/7 body weight; 1.75 m²; its <1 cm versus >1 cm classifications (no invented exactly-1-cm boundary); original skin-layer and skin-function lists and disease examples; erosion/ulcer scarring contrast.
- ✅ Existing course/subject/lecture metadata registration, unique question IDs, local diagram links, stable Surgery content IDs and optional study-guide schema were checked; no exam updates/guidelines were introduced.
- ✅ Wrote the source re-review notes and limitations into `lectures/reviews/dermatology-introduction-coverage.md`; the scan and clinical photographs remain outside the public repository.
- 🧪 The latest revision is documentation-only; required GitHub Actions must still confirm this branch head before release. Previous green validate/Chromium/WebKit runs are retained as evidence of the underlying unchanged code.
- ⚠️ Pending: learner/lecturer confirmation of handwritten annotations and exam-facing content, manual visual legibility sign-off for infographic and spot SVGs, publication rights and explicit Cloudflare deployment approval. **PR #27 stays Draft; do not merge the incompatible PR #26.**

### 2026-10-16 — Dermatology pilot PWA, Safari and source-review hardening

- ✅ PR [#27](https://github.com/Hafezalhoot/medical-meq-bank/pull/27) contains the complete **Internal Medicine II → Dermatology → Introduction to Dermatology** draft, isolated from protected production.
- ✅ Added dedicated Safari Desktop and iPhone coverage of the actual lecture, interactive MCQ, locally hosted SVG infographic and mobile layout.
- ✅ Fixed the shared **Save lecture offline** path to cache a lecture's local visual assets alongside its JSON; the saved-state indicator now detects a missing SVG and permits a repeat save.
- ✅ The Chromium offline regression deletes an infographic SVG from the device cache, verifies incomplete status, restores it, simulates no network and fetches all three schematics plus the lecture successfully.
- ✅ **Final functional code run:** [38951640866](https://github.com/Hafezalhoot/medical-meq-bank/actions/runs/38951640866) — `validate`, `chromium-quality`, `webkit-quality` all passed on commit `3df879cd32d6e88ccfbdfcc9b64483b33d8d2d22`. Candidate version `2026.10.16.3`.
- ✅ Inspected ID uniqueness, valid topic references and source-page labels within the new structured lesson. This is **structural validation**, not independent medical factual verification.
- ⚠️ [PR #26](https://github.com/Hafezalhoot/medical-meq-bank/pull/26) is an **alternative** unmerged draft for the same lecture with a different payload and a failing CI. Never merge both pilots.
- ⏳ Medical sign-off against the original 10-page source PDF, original diagram readability/rights review and learner visual acceptance remain open. The prior scan could not be re-accessed in this chat session for an independent source comparison.
- ⛔ No changes to protected `main` or the currently deployed Worker; this documentation update does not promote the course.




### 2026-10-16 — Screenshot-driven reader redesign

- ✅ Reviewed owner's 3 production screenshots as visual evidence: oversized hero, dense toolbar/metrics, crowded dual sidebars, repeated elevated case cards.
- ✅ Implemented compact, content-first header, progressive study metrics, narrower reader navigation and quieter question card chrome.
- ✅ Implemented persistent `Focus on questions` / `Exit focus mode`, and direct Image quick view, preserving pre-existing progress keys and other study actions.
- ✅ Added runnable regressions for focus restoration, status summary disclosure and Image quick view; full GitHub matrix successful in run `38909175547`.
- ⚠️ Impeccable's installed tool is unavailable here; public critique/polish principles were consulted, with no fabricated detector output or numeric visual score.
- ⏳ Manual branch-preview screenshots and cross-device visual sign-off are outstanding; no merge or production promotion yet.


### 2026-10-16 — V2 final browser screenshot iteration

- ✅ Ran real Chromium screenshots of candidate UI at 1440px desktop and 390px mobile, including Course Library, expanded progress, Focus Mode, and light/dark surfaces.
- ✅ Based on the **rendered** phone evidence, replaced three stacked action rows with four compact nav actions and collapsed PWA/backup utilities into accessible Study tools.
- ✅ Placed course and specialty selection side-by-side on phone and desktop, reducing hero height and using the available viewport for actual lecture content.
- ✅ Captured final screenshot artifact `playwright-report-chromium` in run `38912689508`; `validate`, `chromium-quality` and `webkit-quality` all green.
- ⚠️ PR #23 remains Draft; 360px screenshots and real-device visual approval are pending. Site production and reviewed content remain unchanged.
- ⏳ Next product milestone: Study Home / continue learning / review queue built on existing course, lecture and progress data.

## V2 browser visual evidence — 2026-10-16

- ✅ Final current-head app/navigation layout and course selector browser run [38912689508](https://github.com/Hafezalhoot/medical-meq-bank/actions/runs/38912689508) passed all **validate / chromium-quality / webkit-quality** jobs on `8b141de972b3048d78ec19cf3af5240a79381be6`.
- ✅ Inspected genuine Chromium Playwright screenshot artifacts at desktop 1440×900, phone 390×844, expanded Course Library, expanded Stats and desktop Focus Mode.
- ✅ After screenshot-driven iteration: mobile utilities folded into Study tools; two-column Course/Specialty picker on mobile and desktop; one-row mobile Lectures/Topics/Focus/Print actions; concise header and calm reading surfaces; focus mode remains reversible.
- ✅ Exported human-review screenshots from the CI build (not synthetic mockups); attached to conversation for product design review.
- ⚠️ Impeccable skill is **not installed** in this environment. Applied available public critique/distill/polish concepts and UI/UX Pro Max patterns, not an Impeccable tool audit.
- ⏳ Retain PR #23 as Draft until stakeholder visual acceptance and any remaining cross-course Study Home / My Review improvements are scoped into following increments. Production main and Worker remain untouched.

### 2026-10-16 — Connection recovery and installed Impeccable pass

- ✅ Confirmed `skills://impeccable` is now installed, read its Operate/Read, critique, distill, polish, harden and verification rules.
- ✅ Reconciled 13 intervening commits on PR #23 rather than overwriting completed resume-study, selector, theme and keyboard improvements.
- ✅ Improved Study tools keyboard exit using `Escape` and focus restoration, with browser regression.
- ⏳ Validate final source SHA via CI and inspect visual evidence. PR #23 remains Draft; production is unchanged.

### 2026-10-16 — Full multi-course UX and lecture-intake audit

- ✅ Comprehensive source-backed audit completed: [PROJECT_COMPREHENSIVE_AUDIT_2026-10-16.md](./PROJECT_COMPREHENSIVE_AUDIT_2026-10-16.md), including 12 severity-ranked findings and feature-preservation inventory.
- ✅ Confirmed nine published lecture catalog entries across two course packs; old progress keys/data, the five established study types and offline/PWA/print capabilities are protected design constraints.
- 🟦 Separate [PR #24](https://github.com/Hafezalhoot/medical-meq-bank/pull/24) implements reviewed lecture draft scaffolding, safer registration and tests on an independent branch; it cannot be reported as released until review/merge.
- 🟦 Workstream R2: plan optional lecture-first Explanation/MCQ/Infographic data companions without changing existing five-mode lecture payloads or learner ratings.
- ⏳ Next V2 milestones: course-wide Study Home/My Review, design-system CSS consolidation, 320px/200%-zoom/RTL checks and final visual sign-off.
- ⛔ No PR has been merged or production Cloudflare changed in this audit pass.

### 2026-10-16 — Saved My Review and medical companion delivery

- ✅ Implemented new **My Review** progressive-disclosure panel, grouped across registered course/specialty metadata and existing `weak`/`review` ratings, without eager content fetching.
- ✅ Clicking a group uses current course and lecture navigation, existing review filtering and matching-item keyboard focus.
- ✅ Completed no-content and progress-change states, manual error recovery, 320px mobile/dark mode styling and Focus/Print exclusion.
- ✅ Optional Explanation/MCQ/Infographic reader is authored as plain-text DOM with source notes and labeled Understanding Aid content; new media sections stay absent in old lectures.
- ✅ [V2 CI run 38935394450](https://github.com/Hafezalhoot/medical-meq-bank/actions/runs/38935394450) successful across validate, Chromium and WebKit. [320px CI run 38935897409](https://github.com/Hafezalhoot/medical-meq-bank/actions/runs/38935897409) shows all three jobs passed.
- ✅ [Lecture intake PR #24 CI 38935589777](https://github.com/Hafezalhoot/medical-meq-bank/actions/runs/38935589777) separately passed all three jobs after safe course/lecture authoring and schema tests.
- ⏳ Remaining gates: integrate both branches, source-verified real PDF pilot, actual candidate screenshot sign-off, final locked merge and explicit Worker release approval.
- ⛔ No actual lecture source contents, original progress store implementation, or deployed production site changed.

## October 16, 2026 — Lecture intake development (PR #24)

**Branch:** `feature/safe-lecture-intake-20261016` → `main`, Draft PR [#24](https://github.com/Hafezalhoot/medical-meq-bank/pull/24). Production has **not** been changed.

- ✅ Added `tools/new_lecture.py`: safe, source-traceable blank lecture drafts; never invents medical facts or overwrites an existing draft.
- ✅ Added `tools/add_course.py`: metadata-only dry-run and reviewed write for new medical courses and specialties, reusing the shared engine.
- ✅ Hardened `tools/add_lecture.py`: explicit `--reviewed` acknowledgment, course/subject matching, stable IDs, safe images, complete preflight and staged writes with I/O rollback.
- ✅ Kept the historical Surgery regression baseline frozen; new Surgery lectures are additive.
- ✅ Added optional plain-text `studyGuide` schema and validation for source-page Explanation, four-choice MCQ, Infographic. Embedded images are checked and standalone HTML receives self-contained media.
- ✅ Added Python unit tests for dry-run, review gate, missing/unsafe images, course registration, source-page validation, rollback and offline infographic packaging.
- ✅ [GitHub Actions run 38934118197](https://github.com/Hafezalhoot/medical-meq-bank/actions/runs/38934118197) — `validate`, `chromium-quality`, `webkit-quality` **all passed** on code commit `056042df09b5d38335a3969532405a93ea4e7f32`.
- ⏳ Merge/release gates: code review, branch integration with V2 renderer from PR #23, source-reviewed real PDF pilot, combined regression and explicit Cloudflare deployment approval.
- ⚠️ The `studyGuide` field is **optional and not live on production**. No scientific lecture claims were inserted in this workstream.

## 2026-10-16 — Integrated full quality gate

- ✅ Combined clinical Study V2 and reviewed lecture intake on Draft [PR #25](https://github.com/Hafezalhoot/medical-meq-bank/pull/25), targeting `main` for the complete required CI matrix.
- ✅ [Integrated Actions run 38936963089](https://github.com/Hafezalhoot/medical-meq-bank/actions/runs/38936963089) completed successfully: `validate`, `chromium-quality`, `webkit-quality`.
- ✅ Verified combined PR diff does not edit any `lectures/data/*.json`, `lectures/catalog.json` or `src/progress-resilience.js`; existing exam materials and saved progress implementation are preserved.
- ✅ Optional Explanation / MCQ / Infographic rendering is paired with the intake schema and media checks in the integration branch; older lectures remain unchanged.
- ⏳ Still required: review real uploaded PDF contents and image permissions against original lecture; human visual sign-off (including RTL and zoom), then protected merge and controlled Cloudflare release.
- ⛔ This green CI confirms code-level integration only. No actual new lecture has been medically approved or published, and neither `main` nor production was modified.

## Medical Study Workspace V2 (2026-10-16)

**Delivery branch:** `design/medical-study-workspace-v2-20261016` (isolated from production).  
**Candidate:** `2026.10.16.1`.  
**Plan and acceptance checks:** [`UI_V2_ROADMAP.md`](./UI_V2_ROADMAP.md).

- ✅ Reviewed the shipped course registry, loader, study UI, progress, PWA/print boundaries and existing tests; keep the current vanilla/offline-first architecture.
- ✅ Applied the UI/UX Pro Max education dashboard/course-grid guidance to a low-noise expandable catalog-sourced Course Library, with consistent existing blue/teal tokens.
- ✅ V2-1 first UI increment implemented: responsive course gallery, course switching, empty-course recovery, dark mode and browser regression. The full `validate`, Chromium/axe and WebKit/iPhone matrix passed on run `38905559158`; subjective visual QA remains before merge.
- ⏳ V2-2 through V2-7: Study Home, specialty/lecture reader organization, optional verified medical content modes, better review/progress navigation, cross-device polish and controlled release.
- ⛔ No automatic promotion. Surgery/MEQ content and user progress IDs remain unchanged.


> **Single source of truth for the modernization program.**
>
> Update this file in the same branch/PR whenever a task is completed, blocked, re-scoped, or newly discovered. Do not mark an item complete until its acceptance criteria are satisfied and the relevant automated checks pass.

## Program snapshot

- **Repository:** `Hafezalhoot/medical-meq-bank`
- **Working branch:** `hardening/scalability-overhaul-20261003`
- **Baseline commit:** `ae7d0b47b89236a9b152a3083c422779946a41b1`
- **Started:** 2026-10-03
- **Release candidate:** `2026.10.04.2`
- **Delivery PR:** `#19` (`hardening/scalability-overhaul-20261003` → `main`)
- **Primary goal:** preserve the current reliable PWA and study UX while removing the architectural ceilings that would prevent safe growth to many courses, subjects, lectures, study items, images, and users.
- **Non-goal:** framework churn. React/Next.js/Supabase are not introduced unless a measured requirement cannot be met by the existing platform and data model.

## Status legend

| Status | Meaning |
| --- | --- |
| ✅ Done | Implemented and verified |
| 🟦 In progress | Actively being changed in the current branch |
| ⏳ Planned | Accepted work, not started yet |
| ⚠️ Blocked | Needs external configuration, permission, or a decision |
| 🧪 Verify | Code is present but still requires full CI/browser confirmation |

## Release candidate status

| Gate | Status | Evidence / note |
| --- | --- | --- |
| Source architecture refactor | ✅ Pass | Lecture-level loading, bounded rendering, selective offline caching, per-item progress, scoped search and generic authoring pipeline are implemented on PR #19 |
| Repository hygiene | ✅ Pass | Recursive Git tree contains no tracked `dist/`, `tmp/`, test results, Playwright reports, Python caches, or bytecode |
| JavaScript source syntax | ✅ Pass | All shipped runtime JavaScript files parse successfully in an independent V8 syntax pass |
| Version consistency | ✅ Pass | `version.json`, service worker, and PWA client all declare `2026.10.04.2` |
| Content/catalog invariants | ✅ Pass | 9 unique lecture IDs; course/subject order is unique; every catalog entry has course + payload version metadata |
| Surgery compatibility baseline | ✅ Pass | All 9 current Surgery lectures are protected by the common baseline, including Renal Tumors |
| Dependency lock consistency | ✅ Pass | `package.json` and `package-lock.json` agree on Playwright 1.62.1 and axe-playwright 4.13.0 |
| Full clean build | ✅ Pass | GitHub Actions run `37232212679` on `2026.10.04.2` completed successfully; `validate` built from clean sources and passed the canonical static quality gate |
| Chromium + axe + performance + print + offline | ✅ Pass | `chromium-quality` passed in run `37232212679`, including accessibility, performance, print/PDF, offline, progress and regression coverage |
| WebKit / iPhone | ✅ Pass | `webkit-quality` passed in run `37232212679` for Safari desktop and iPhone WebKit smoke coverage |
| Main branch protection | ✅ Active / final merge checks pending | GitHub ruleset #25237566 active, `main.protected=true`, PR-only/three required strict quality jobs/no bypass; negative test and protected merge remain pending in issue #21 |
| Cloudflare production URL / Access / branch control | ⚠️ External verification | Issue #22 tracks source connection after transfer, branch/deploy controls, hostname, Access policy and rollback; no Cloudflare connector is available |
| Production merge/promotion | ⛔ Hold | Quality matrix and protection are verified; PR #19 remains draft pending Cloudflare release controls (issue #22) and protected-merge integration verification |

Resolved runner recovery tracker: https://github.com/Hafezalhoot/medical-meq-bank/issues/20

## Current production baseline

### Strengths already present

- Offline-first PWA shell and standalone offline build.
- Reviewable JSON lecture sources with catalog count validation.
- Course → subject → lecture configuration layer.
- Strong CSP/security headers for a static application.
- Chromium, WebKit/iPhone, accessibility, layout, offline, print, progress-recovery, and performance regression tests.
- Progress backup/import validation and IndexedDB corruption recovery.
- Cloudflare production build integration.

### Risk register

| ID | Status | Severity | Area | Current state |
| --- | --- | --- | --- | --- |
| R-001 | ✅ Resolved in RC | Critical | Offline/PWA | Mandatory install cache no longer contains the full lecture bank; lecture/subject offline storage is selective. |
| R-002 | ✅ Resolved in RC | Critical | Data loading | Subject navigation is metadata-first and the selected lecture payload is loaded on demand. |
| R-003 | ✅ Resolved in RC | Critical | Rendering | The DOM is bounded to the active lecture; All Lectures uses lightweight overview cards. |
| R-004 | ✅ Controlled | Critical | Offline export | Full-bank standalone HTML remains only as a backward-compatible export with an 8 MB hard ceiling. |
| R-005 | ✅ Resolved in RC | High | Progress | Progress is stored as per-item IndexedDB records with legacy migration and transactional backup/restore. |
| R-006 | ⚠️ Final release validation | High | Release safety | GitHub Actions and active `main` ruleset are verified; protected-merge negative test plus Cloudflare production controls remain before promotion. |
| R-007 | ✅ Resolved in RC | High | Identity model | Course/subject/lecture/item scoped identity and v2 progress keys prevent practical cross-course collisions. |
| R-008 | ✅ Resolved | High | Content pipeline | Generic materialization/publishing and one-command authoring replace lecture-specific code. Verified legacy source transport inputs remain as reproducible data inputs, not lecture-specific build logic. |
| R-009 | ✅ Resolved | High | Repository hygiene | Generated `dist/`, browser reports, caches and bytecode are not tracked and are rejected by hygiene checks. |
| R-010 | ✅ Resolved in RC | Medium | Search | Search uses build-time course+subject shards and can find unloaded content without rendering the corpus. |
| R-011 | ✅ Controlled | Medium | Schema | Payload v1 and catalog metadata versions are explicit/fail-closed; speculative rich-block schema migration is intentionally deferred. |
| R-012 | ✅ Resolved | Medium | Documentation | README, deployment, release, content-authoring, UI design-system and progress documents reflect the current architecture. |
| R-013 | ✅ Resolved | Medium | Regression baseline | All 9 current Surgery lectures use the same compatibility baseline. |
| R-014 | ✅ Resolved | Medium | PR hygiene | Superseded PR/dependency noise was cleared; PR #19 is the sole modernization delivery track. |
| R-015 | ✅ Resolved in RC | Low | UI consistency | Structural control glyphs use a shared inline-SVG language and the Clinical Study Workspace design system. |
| R-016 | ⚠️ External verification | High | Cloudflare | Exact public hostname, Access policy and branch-control/promotion settings require Cloudflare dashboard verification. |
| R-017 | ⏳ Deferred by trigger | Medium | Multi-device users | Accounts/backend sync are not required for content scalability; introduce only when cross-device sync/admin roles become product requirements. |

## Target architecture

```text
Course catalog
  -> Subject catalog metadata
      -> Lecture metadata
          -> Fetch one selected lecture on demand
              -> Render selected lecture only
                  -> Cache lecture after use / explicit offline pack
                      -> Store per-item progress in IndexedDB
```

### Design principles

1. **Metadata first, payload second.** Navigation must not require downloading full lecture payloads.
2. **Render only what the learner is using.** Hidden content should not remain as thousands of DOM nodes.
3. **Offline is selective, not mandatory full-bank download.** App shell is always offline-ready; lecture/subject packs are cached on demand.
4. **Stable canonical IDs.** IDs survive reordering, content growth, and course expansion.
5. **One content ingestion contract.** Lecture 500 must be added the same way as lecture 5.
6. **CI before production.** A failed quality gate must never produce a promoted production release.
7. **Preserve current user data.** Every storage/schema change requires a backward-compatible migration or fallback.
8. **No unnecessary framework migration.** Keep the smallest architecture that meets measured requirements.

## Delivery phases

### Phase 0 — Baseline, tracking, and release safety

**Goal:** establish a clean controlled modernization branch and stop unverified production changes.

- ✅ P0-01 Create modernization branch.
- ✅ P0-02 Add this persistent progress log.
- ✅ P0-03 Reproduce and diagnose the failing `main` validation path.
- ✅ P0-04 Keep deployment/readme references aligned with the current personal repository owner and Cloudflare Workers setup.
- ✅ P0-05 Tighten repository hygiene checks to reject all Playwright report variants; generated `dist/` cleanup remains in Phase 8.
- ✅ P0-06 Remove tracked generated artifacts from source control — `dist/`, temporary outputs, and Playwright reports are no longer tracked; hygiene rejects their return.
- ⚠️ P0-07 CI quality gates are restored and the complete matrix is green in run `37190596970`; enforcing those checks as non-bypassable `main` branch protection and confirming Cloudflare branch control remain external configuration tasks.
- ✅ P0-08 Clean superseded open PRs and dependency noise — only modernization PR #19 remains open; locked Playwright/axe tooling was updated on the branch.
- ⚠️ P0-09 Record and verify the canonical production URL/access policy — Worker identity is confirmed, exact public hostname and Cloudflare Access policy still require Cloudflare dashboard verification.

**Acceptance criteria**
- Current branch builds from clean sources.
- Validation, Chromium, and WebKit jobs pass.
- Production deployment cannot be promoted from a failing commit.
- Operational docs match the real repository/deployment model.

### Phase 1 — Lecture-level loading and bounded rendering

**Goal:** make application cost depend on the selected lecture rather than total subject size.

- ✅ P1-01 Split catalog metadata/navigation from lecture payload loading — implemented; verified by the green browser matrix in run `37190596970`.
- ✅ P1-02 Add `loadLecture(lectureId)` with deduplicated in-flight requests — implemented; verified by the green browser matrix in run `37190596970`.
- ✅ P1-03 Keep `loadSubject` metadata-first and compatibility-safe — implemented; it loads metadata plus only the active lecture payload.
- ✅ P1-04 Render the selected lecture only — implemented and protected by new DOM-budget tests.
- ✅ P1-05 Change “All lectures” into a lightweight overview rather than full-card rendering — implemented with accessible overview buttons.
- ✅ P1-06 Preserve navigation, random item, filtering, metadata-based progress counts, scoped printing, and accessibility behavior — code adapted; the full browser matrix passed in run `37190596970`.
- ✅ P1-07 Add regression tests proving inactive lectures are not fetched/rendered — implemented in performance/course-pack/hardening tests.
- ✅ P1-08 Scale behavior is enforced by bounded one-lecture DOM/request budgets and metadata-only navigation tests; a synthetic massive fixture is deferred unless measured regressions justify the maintenance cost.

**Acceptance criteria**
- Initial active-course load fetches catalog + at most the selected lecture payload.
- Switching lectures fetches only the newly selected lecture.
- DOM node count is bounded by the active lecture rather than subject size.
- Existing study interactions continue to pass Chromium/WebKit/a11y tests.

### Phase 2 — PWA/offline caching v2

**Goal:** remove full-corpus pre-cache while keeping excellent offline behavior.

- ✅ P2-01 Pre-cache app shell/catalog/runtime/icons without lecture payloads or the monolithic offline export — implemented.
- ✅ P2-02 Runtime-cache successful lecture JSON/assets after use — implemented through the existing cache-first asset handler.
- ✅ P2-03 Add explicit offline download/remove APIs and UI for a lecture — implemented.
- ✅ P2-04 Add optional subject-pack offline download using catalog metadata — implemented.
- ✅ P2-05 Keep versioned caches and stale-cache cleanup — retained and now used by selective caching.
- ✅ P2-06 Add selective cache/install regression coverage; browser verification passed in run `37190596970`.
- ✅ P2-07 Keep the monolithic standalone file only as a bounded legacy export — an 8 MB hard ceiling now prevents it becoming the scalable delivery path; selective PWA lecture/subject downloads are the supported growth path.
- ✅ P2-08 Offline cache failures (including storage/network failures) are caught and surfaced through the existing toast/control feedback; verified by the green browser matrix in run `37190596970`.

**Acceptance criteria**
- Service-worker install succeeds without downloading every lecture.
- Previously opened/downloaded lectures work offline.
- A single unavailable lecture does not break PWA installation.
- Corpus growth does not increase mandatory first-install bytes linearly.

### Phase 3 — Progress storage v2

**Goal:** make progress writes scale per changed item and preserve existing users.

- ✅ P3-01 Define the v2 per-item progress record schema — implemented in IndexedDB `progress-items`; canonical content namespacing continues in Phase 4.
- ✅ P3-02 Promote IndexedDB to primary per-item progress storage — implemented.
- ✅ P3-03 Migrate legacy `medicalBankStatusV2` safely on first run — implemented; legacy blob is removed only after successful IndexedDB hydration.
- ✅ P3-04 Keep localStorage only for small UI preferences — implemented for progress writes.
- ✅ P3-05 Add backup schema v2 with pre-read size limits, transactional import/rollback, and v1 compatibility — implemented.
- ✅ P3-06 Preserve explicit reset semantics and legacy corruption recovery — implemented around the v2 store.
- ✅ P3-07 Add migration, reset, per-item write, v1 rejection, v2 import and rollback-oriented regression tests — implemented; the regression suite passed in run `37190596970`.

**Acceptance criteria**
- Rating one item writes one progress record, not the full bank state.
- Legacy progress appears unchanged after migration.
- Import/export and corruption recovery remain transactional.

### Phase 4 — Canonical content identity and schema v2

**Goal:** support multiple courses/curricula/editions without collisions or inconsistent payloads.

- ✅ P4-01 Define canonical scoped identity rules: course / subject / lecture / item — implemented through `subjectScope`, `lectureScope`, `itemScope`, and v2 progress keys.
- ✅ P4-02 Add schema versioning to catalogs and lecture payloads — every catalog entry now declares `schemaVersion: 1`; unsupported versions are rejected by runtime/build validators.
- ✅ P4-03 Typed-block rewrite deliberately deferred — current case/core/image/extra/rapid v1 structures remain the stable contract until a real rich-content requirement justifies migration.
- ✅ P4-04 Image/media integrity metadata remains enforced for materialized AVIF content; broader asset-reference migration is deliberately deferred until embedded-media size is a measured bottleneck.
- ✅ P4-05 No speculative content migration utility is shipped: payload v1 is explicit and fail-closed; a deterministic migration becomes mandatory only when a real payload v2 is introduced.
- ✅ P4-06 Validators now enforce scoped subjects, globally unique lecture IDs, supported schema versions, catalog counts, search identities, and generic materialization contracts.
- ✅ P4-07 Legacy progress keys lazily migrate to canonical course/subject/lecture/type/item v2 keys without discarding existing ratings.

**Acceptance criteria**
- Duplicate local IDs across different courses cannot collide.
- Every published payload has an explicit schema version.
- Invalid content fails at build time with an actionable error.

### Phase 5 — One content ingestion pipeline

**Goal:** remove lecture-specific build logic.

- ✅ P5-01 Define one canonical lecture build contract — `lectures/materialization.json` is now the single declaration for generated lecture sources while ordinary lectures remain reviewable JSON under `lectures/data`.
- ✅ P5-02 Fold renal/urolithiasis/bladder materialization into generic tooling — implemented by `tools/materialize_lectures.py`; the materializer and image validator are data-driven and contain no target lecture IDs.
- ✅ P5-03 Retain the verified legacy compressed/template source inputs as reproducible data inputs. The generic materializer passed the fresh full matrix in run `37190596970`; rewriting or deleting validated medical source transport data is intentionally avoided unless a provenance-preserving canonical replacement is introduced.
- ✅ P5-04 Materialization checksums and search metadata are generated/validated from source; lecture catalog metadata remains explicit for reviewability.
- ✅ P5-05 Unified Surgery compatibility protection — all 9 current lectures, including Renal Tumors, use the same baseline path; the renal-specific validator exception was removed.
- ✅ P5-06 Added `tools/add_lecture.py` with dry-run/write modes plus `CONTENT_AUTHORING.md` as the contributor workflow.
- ✅ P5-07 Legacy compressed/template targets retain their raw-byte/SHA-256 and image-integrity contracts. Historical workflow `30875638166` passed validate + 33 Chromium tests + 2 WebKit tests and validated all 24 embedded AVIF images on the pre-modernization content baseline. Shared catalogs are now course-scoped; the refactored generic engine passed the fresh full matrix in run `37190596970`.

**Acceptance criteria**
- No runtime/build pipeline script names a specific lecture ID.
- Adding a lecture uses the same steps regardless of specialty.
- Existing lecture content/counts/images are preserved and validated.

### Phase 6 — Search and navigation scalability

**Goal:** search the content corpus without rendering it.

- ✅ P6-01 Create compact build-time search metadata — implemented as course+subject shards plus a tiny search catalog; embedded image/base64 payloads are explicitly excluded.
- ✅ P6-02 Search lecture/item metadata independently of active DOM — implemented.
- ✅ P6-03 Load a lecture payload only when its search result is opened — implemented and covered by a regression test.
- ✅ P6-04 No Web Worker added yet by design; per-subject shards cap the working set and a worker remains a measured-performance upgrade, not speculative complexity.
- ✅ P6-05 Search results use real buttons, visible focus, live result counts, actionable empty-state guidance, responsive layout, and reduced-motion-aware scrolling; full a11y verified by the green browser matrix in run `37190596970`.
- ✅ P6-06 Added search-shard size budgets plus request/DOM/result-count regressions; end-to-end browser coverage passed in run `37190596970`.

**Acceptance criteria**
- Search can find content in unloaded lectures.
- Search latency does not scale with rendered DOM size.
- Opening a result loads only the required lecture.

### Phase 7 — UI/UX polish after architecture is stable

**Goal:** improve quality without hiding architecture problems with styling.

- ✅ P7-01 Added skip navigation, unified visible focus, ≥44px primary interaction targets, safe-area padding, phone-landscape coverage, reduced-motion-aware scrolling, and scroll-margin protection from sticky controls.
- ✅ P7-02 Replaced structural emoji/text control glyphs in the main app and Print Center with a consistent inline SVG stroke language.
- ✅ P7-03 Added a delayed skeleton for lecture loading so quick loads do not flash an indicator while slower loads receive visible feedback.
- ✅ P7-04 Offline lecture/subject actions expose busy/cached state and distinguish quota/session/network failure guidance.
- ✅ P7-05 Dark mode retains semantic tokens; primary/muted/brand/revision-state foreground/background pairs pass static WCAG AA contrast calculations, with axe verification now green in run `37190596970`.
- ✅ P7-06 Axe, keyboard, Chromium and iPhone/WebKit coverage passed in GitHub Actions run `37190596970`.
- ✅ P7-07 Reworked page hierarchy into a Clinical Study Workspace: compact header, explicit Course → Specialty → Lecture breadcrumb, search-first toolbar, progress-priority stats, bounded reading width, quieter navigation surfaces, and stable card elevation.
- ✅ P7-08 Added lecture-level rated-progress cues to the All Lectures overview so the learner can choose Start vs Continue without opening every lecture.
- ✅ P7-09 Added `UI_DESIGN_SYSTEM.md` and `UI_UX_AUDIT.md` so future courses/features reuse the same hierarchy, spacing, responsive, accessibility, and component language.
- ✅ P7-10 Added regression tests for redesigned heading, semantic progress bars, breadcrumb orientation, empty-state recovery, Print Center target size, mobile targets, and landscape overflow.

### Phase 8 — Repository and operations hardening

**Goal:** make long-term maintenance predictable.

- ✅ P8-01 `dist/`, temporary outputs and Playwright reports are not tracked; repository hygiene blocks them.
- ✅ P8-02 CI uploads generated site/browser reports as short-lived 7-day artifacts.
- ✅ P8-03 Added `RELEASE_PROCESS.md` and release candidate `2026.10.04.2`; version/cache synchronization is build-validated.
- ✅ P8-04 CODEOWNERS was deliberately not added: there is no demonstrated multi-reviewer ownership need, so the repository stays simpler.
- ✅ P8-05 Updated locked Playwright/axe tooling and cleared stale dependency PR noise; only PR #19 is open.
- ✅ P8-06 Rollback and production-promotion policy is documented in `RELEASE_PROCESS.md` and `DEPLOYMENT.md`.
- ⚠️ P8-07 Repository visibility is intentionally public under `Hafezalhoot`; exact production hostname, active Cloudflare Access policy and production branch control still require Cloudflare dashboard verification.

### Phase 9 — Optional multi-device/user platform

**Trigger:** only when accounts, cross-device sync, analytics, centralized authoring, or access roles are actually required.

- ⏳ P9-01 Define authentication/privacy requirements.
- ⏳ P9-02 Introduce backend sync for progress with offline conflict handling.
- ⏳ P9-03 Add admin/content workflow if manual Git authoring no longer scales.
- ⏳ P9-04 Add observability that does not collect unnecessary student data.

**Note:** no backend is required to solve the present content-scaling bottlenecks.

## Verification matrix

Every phase should preserve or improve these checks:

| Capability | Required verification |
| --- | --- |
| Build integrity | `bash build.sh` + Python validators |
| JavaScript integrity | `node --check` on source/generated runtimes |
| Chromium behavior | Playwright E2E |
| Safari/iPhone behavior | Playwright WebKit |
| Accessibility | axe WCAG A/AA + keyboard/focus behavior |
| Offline | service-worker + offline navigation tests |
| Data integrity | schema/count/ID/subtopic/image validation |
| Progress safety | migration/import/reset/corruption tests |
| Performance | request, DOM-node, interaction, bundle/asset budgets |
| Security | CSP/header audit and no unsafe runtime regressions |

## Change log

### 2026-10-16 — Final release-gate preparation

- ✅ GitHub `MEQ main release protection` ruleset #25237566 imported and activated by owner on 2026-10-16; GitHub API confirms `main.protected=true`, default-branch target, PR-only updates, no bypass actors, blocked deletion/non-fast-forward, and required strict green `validate`, `chromium-quality`, and `webkit-quality` jobs. Issue #21 updated; blocked-merge negative integration test and normal green protected merge are pending.

- ✅ Rechecked the repository on the personal `Hafezalhoot` account: PR #19 remains a mergeable draft; the production `main` branch has no protection and the repository has zero active rulesets.
- ✅ Confirmed the last complete matrix (run `37232212679`, head `b9686d54f66cb5b4c73fa3d5f7360690c66a6dda`) passed `validate`, `chromium-quality`, and `webkit-quality`. New documentation/ruleset commits must pass the same CI before release.
- ✅ Added the importable `.github/rulesets/main-protection.json` with mandatory PR, the three required checks, no branch deletion, no force pushes, and no bypass actors; single-maintainer human approvals remain zero.
- ✅ Opened issue [#22](https://github.com/Hafezalhoot/medical-meq-bank/issues/22) for the separate Cloudflare dashboard validation and live-release/rollback acceptance criteria.
- ⚠️ The ruleset file is **not active protection**. Admin configuration of GitHub Rulesets and Cloudflare dashboard verification require the repository/Cloudflare account owner; the connected GitHub application cannot write repository administration settings and no Cloudflare integration is connected.
- ⛔ Preserve PR #19 as a draft and leave `main` untouched until issue #21 protection and issue #22 production safety checks are verified. Only then mark ready, merge the green PR and perform an explicit Cloudflare promotion/smoke test.


### 2026-10-04 — Personal-account migration and CI recovery
- ✅ Final repository-side release audit confirmed the latest full GitHub Actions matrix is green on head `f5eaa43d9b08a3b0e2129685e344bc836bc9641a` (run `37191073031`), and corrected stale public-visibility/release-evidence documentation.

- ✅ Transferred the public repository from the `Hafez-Alhoot` organization to personal account `Hafezalhoot` while preserving repository ID, history, PR #19, issues and branches.
- ✅ GitHub-hosted runners began provisioning normally after the transfer; issue #20 is resolved. The exact organization-side policy that caused the former zero-job `BuildFailed/startup_failure` was not identified.
- ✅ Release candidate `2026.10.04.2` passed the complete GitHub Actions matrix in run `37190596970`: `validate`, `chromium-quality`, and `webkit-quality`.
- ✅ Fixed stale search-runtime validation and aligned Chromium/WebKit tests with metadata-first one-lecture loading and course/subject search shards.
- ✅ Fixed mobile filter reset so it clears stale global-search results.
- ✅ Raised breadcrumb label contrast to pass automated WCAG A/AA checks.
- ✅ Prevented an unnecessary page reload on first service-worker installation while retaining reload behavior for real service-worker updates.
- ✅ Hardened Print Center regression timing so PDF/pagination assertions wait for completed pagination.
- ✅ Removed the temporary hosted-runner probe and the Python invalid-escape warning from the build.
- ✅ Retained verified legacy compressed/template source inputs intentionally as reproducible data inputs; the generic content engine is the only build path and passed the full matrix.
- ⚠️ Final release blockers are configuration-only: protect `main` with required quality checks (#21) and verify Cloudflare production hostname/Access/branch control.
- ✅ Documentation was reconciled after the repository became public and moved to `Hafezalhoot`; README, deployment, release, Actions incident, and UI/UX audit docs no longer describe the old private-organization state as current.


### 2026-10-03 — Release candidate UI and operations hardening
- ✅ 2026-10-04: repository visibility changed from private to public to enable the free public-repository CI/protection path; a fresh Actions run is required to verify whether the previous pre-job startup blocker is cleared.
- ✅ 2026-10-04 follow-up: hardened backup failure reporting so a failed automatic rollback no longer claims that current progress was preserved; failure injection now covers the partial-rollback case explicitly.
- ✅ 2026-10-04 follow-up: bumped the release candidate and PWA cache identity to `2026.10.04.1` after runtime changes, keeping `version.json`, service worker, and PWA client synchronized.
- ⚠️ 2026-10-04 follow-up: release-candidate commit `6134522ba2ef49abc3077bccc26cf7feec85af0a` remains mergeable-clean, but run `37161592860` still fails before job creation; code-side release work is therefore complete pending external runner/Cloudflare controls.
- ✅ 2026-10-04 follow-up: removed the last lecture-specific generated-file assertion from `scripts/quality_gate.sh`; published lecture completeness is validated generically from `lectures/catalog.json`.
- ✅ 2026-10-04 follow-up: converted `scripts/validate_lecture_images.py` from three hard-coded Urology lecture IDs to data-driven AVIF/hash/count validation backed by `materialization.json` and asset manifests.
- ✅ 2026-10-04 follow-up: added failure-injection coverage proving backup import rolls back both IndexedDB progress and local preferences if progress replacement fails mid-restore.
- ✅ 2026-10-04 follow-up: extended Print Center coverage to render the generated worksheet as an actual A4 PDF and verify a valid non-empty PDF payload.
- ✅ 2026-10-04 follow-up: audited the complete shipped runtime/build tool set after these fixes; no specific lecture IDs remain hard-coded in runtime or build pipeline scripts.
- ⚠️ 2026-10-04 follow-up: latest Actions run `37161474808` on `bfaf589960e2dbc1e0196c605bdca314dac1e822` still fails as synthetic `BuildFailed/startup_failure` with zero jobs; PR #19 remains draft and mergeable-clean.
- ✅ 2026-10-04 follow-up: aligned `CONTENT_AUTHORING.md` with the canonical `npm run quality:static`, `npm run test:e2e`, and `npm run test:webkit` release commands so lecture onboarding no longer duplicates stale validator steps.
- ⚠️ 2026-10-04 follow-up: the documentation-only commit `96bf11fb023fb3545b89c08d599cd053f42301b0` triggered Actions run `37161202301`, which again failed as synthetic `BuildFailed/startup_failure` with zero jobs, confirming the blocker persists independently of application code.
- ✅ Finalized a canonical local/CI static gate: `npm run quality:static` → `build.sh` → `scripts/quality_gate.sh`; build creates `dist/` first, then validators/performance/repository/JS checks execute exactly once.
- ✅ Added shared `npm run test:webkit` and aligned README + GitHub CI with the same command.
- ✅ Updated README lecture onboarding to use `tools/add_lecture.py` dry-run/write flow instead of manual multi-file edits.
- ⚠️ GitHub public Status reported Actions operational while this private repository continued returning zero-job `BuildFailed/startup_failure`; the remaining runner blocker is therefore account/organization/repository-specific rather than a broad Actions outage.
- ✅ Consolidated duplicate CI/static validation into one canonical static quality gate used by `build.sh`, npm, Cloudflare and GitHub CI; added performance-budget enforcement to deployment builds.
- ✅ Matched both Playwright Docker images to the locked `@playwright/test` version `1.62.1`.
- ✅ Added `ACTIONS_RECOVERY.md` with the minimal-probe evidence, organization billing/policy checks, and GitHub Support escalation identifiers.
- ⚠️ Minimal hosted-runner probe commit `705338e64d86e1755999b3e1b559786aca5b6f72` produced run `37140311659` with the same synthetic `BuildFailed/startup_failure` and zero jobs, excluding app/build/npm/Playwright code as the cause.
- ✅ Isolated the Actions failure with a native runner-only smoke job (no checkout, marketplace action, container, Node, Python, or project code); it still returned synthetic `BuildFailed/startup_failure` with zero jobs, proving the remaining CI fault is above repository execution.
- ✅ Removed all diagnostic smoke workflows after isolation, restored the full Chromium/WebKit quality matrix, aligned the Playwright container with locked `1.62.1`, and centralized static checks in `scripts/quality_gate.sh` / `npm run quality:static`.
- ⚠️ Exact remediation is now documented in `RELEASE_PROCESS.md`: organization Actions enablement, standard hosted-runner policy, action allowlist/SHA policy, execution protections, and private-repository billing/usage must be checked by an organization administrator.
- ⚠️ GitHub Actions latest evidence: run `37139094282` reports blank workflow name, `path: BuildFailed`, `(Unknown event)`, `startup_failure`, and contains zero jobs and zero artifacts; no repository test step starts.
- 🧪 Final UI release candidate `2026.10.04.1` includes the Clinical Study Workspace hierarchy, lecture-overview progress, semantic active states, unified vector icon language, filter recovery, and design-system documentation.
- ✅ Completed the Clinical Study Workspace redesign using the UI/UX design-system audit: compact header, content-first hierarchy, breadcrumb orientation, progress-priority dashboard, bounded reading width, lower visual noise, and stable interactions.
- ✅ Added lecture progress to the overview, direct empty-state recovery, associated filter labels, semantic progressbar states, and sticky-focus protection.
- ✅ Added permanent `UI_DESIGN_SYSTEM.md` + `UI_UX_AUDIT.md`; no new framework, UI library, font request, or animation dependency was introduced.
- ✅ Fixed shared-catalog validation so each course validates only its own `courseId` entries while preserving global lecture-ID uniqueness; this removes a blocker to the first Internal Medicine lecture.
- ✅ Independent static release audit passed repository hygiene, runtime JavaScript parsing, version synchronization, catalog identity/order checks, 9/9 Surgery baseline coverage, and package/lock dependency consistency.

- 🧪 Prepared release candidate `2026.10.04.1` and synchronized `version.json`, PWA client, and service-worker cache identity.
- ✅ Removed generated `dist/`, temporary build output, and browser reports from tracked source; CI keeps artifacts for 7 days.
- ✅ Added `CONTENT_AUTHORING.md`, `RELEASE_PROCESS.md`, and README operation links.
- ✅ Added one-command lecture dry-run/registration tooling and unified the Surgery regression baseline across all 9 current lectures.
- 🧪 Added skip navigation, consistent focus treatment, safe-area padding, 44px primary controls, delayed lecture skeleton, improved offline error feedback, and course-scoped search/offline behavior.
- ✅ Replaced main structural emoji controls and Print Center emoji icons with inline SVG controls.
- 🧪 Made Rapid Recall keyboard-operable with semantic buttons and `aria-expanded`; added dark-mode restoration, phone-landscape, and touch-target regressions.
- ⚠️ GitHub Actions still ends with synthetic `BuildFailed/startup_failure` before any job is created, so the full Chromium/WebKit/a11y matrix remains unexecuted.
- ⚠️ No Cloudflare plugin/connector is available in this environment; exact production hostname, Access policy, and production branch-control setting remain external verification items.


### 2026-10-03 — Scoped identity, generic ingestion, and scalable search

- 🧪 Added canonical scoped identity through the Course Registry: course → subject → lecture → type → item.
- 🧪 New progress records use scoped v2 keys; legacy keys migrate lazily when encountered.
- 🧪 Added explicit `schemaVersion: 1` to every lecture catalog entry and fail-closed runtime/build validation for unsupported versions.
- ✅ Kept the existing medical content structures instead of performing a speculative typed-block rewrite that would churn verified content without a current product need.
- 🧪 Added `lectures/materialization.json` and one generic `tools/materialize_lectures.py` engine for compressed-parts and template+asset sources.
- ✅ Removed the three lecture-specific Python materializer scripts; the generic tool contains no hard-coded target lecture ID.
- 🧪 Preserved the original raw-byte, SHA-256, repair-chunk, AVIF byte-count, and AVIF hash contracts in data rather than lecture-specific code.
- 🧪 Added per-subject search shards generated at build time; image/base64 payload fields are excluded from indexing.
- 🧪 Global search can find unloaded lecture items and only loads the selected lecture after result activation.
- 🧪 Added search-shard completeness/duplicate/size/image-payload validation and request/DOM regression coverage.
- 🧪 Improved search focus, empty-state, mobile, and reduced-motion behavior.

### 2026-10-03 — Bounded legacy offline export

- 🧪 Reclassified the self-contained full-bank HTML as a backward-compatibility export rather than the scalable offline architecture.
- 🧪 Added an 8 MB hard build/finalization ceiling so corpus growth cannot silently turn the legacy file into an unbounded download.
- 🧪 Documented selective PWA lecture/subject downloads as the supported scalable offline path.
- 🧪 Updated performance budgets and README storage/offline descriptions to match the new architecture.

### 2026-10-03 — Per-item progress storage implementation

- 🧪 Upgraded IndexedDB to schema version 2 with a dedicated `progress-items` store.
- 🧪 Added one-record `set/delete` progress writes instead of serializing the complete bank on every rating click.
- 🧪 Added automatic first-run migration from the legacy `medicalBankStatusV2` localStorage blob.
- 🧪 Added state hydration before the initial lecture payload is rendered.
- 🧪 Added explicit IndexedDB clear/reset semantics.
- 🧪 Added backup schema v2 with separate preferences/progress sections, 16 MB pre-read safety limit, transactional rollback, and legacy v1 import compatibility.
- 🧪 Updated migration/reset/corruption/backup tests.
- ✅ `app.js`, `lecture-loader.js`, `progress-resilience.js`, `pwa-client.js`, `print-manager.js`, and `service-worker.js` all pass source-level JavaScript syntax parsing.

### 2026-10-03 — Lecture loading and selective offline implementation

- 🧪 Reworked `src/lecture-loader.js` into metadata-first, lecture-level loading with deduplicated in-flight payload requests.
- 🧪 Reworked `src/app.js` so the DOM contains only the active lecture; “All lectures” now renders lightweight metadata overview cards.
- 🧪 Subject totals/progress can be calculated from catalog expected counts without loading every lecture body.
- 🧪 Updated the Print Center so opening it no longer triggers an implicit full-bank download.
- 🧪 Removed lecture JSON and the monolithic standalone HTML from mandatory service-worker installation pre-cache.
- 🧪 Added selective lecture cache/remove APIs and optional subject offline download.
- 🧪 Added visible lecture/subject offline controls with 44px minimum interaction targets.
- 🧪 Added/updated regression tests for one-payload startup, one-lecture DOM bounds, metadata-only catalogs, selective offline caching, sequential image verification, and isolated broken-lecture behavior.
- ✅ Source-level JavaScript syntax was checked during the refactor; full build/Chromium/WebKit execution remains blocked by the external GitHub Actions startup failure and the current container has no outbound GitHub network.

### 2026-10-03 — Phase 0 hardening pass

- ✅ Opened draft PR #19 as the delivery track for the modernization program.
- ✅ Reproduced the current GitHub Actions failure on the modernization branch and PR.
- ✅ Confirmed the failure signature is pre-job: empty workflow name, path `BuildFailed`, `startup_failure`, and zero jobs. No repository build/test code executes in this state.
- ✅ Updated deployment documentation from stale Pages instructions to the current Cloudflare Workers setup; later ownership/visibility changes are recorded in the 2026-10-04 entry.
- ✅ Added release/rollback guidance and documented that Cloudflare production promotion must remain gated by the validation matrix.
- ✅ Hardened repository hygiene to reject all `playwright-report*` variants.
- ✅ Removed the tracked `playwright-report-webkit/index.html` artifact.
- ✅ Updated README lecture inventory to include Renal Tumors and linked the modernization/deployment sources of truth.
- ✅ Closed stale PR #17 as superseded by merged PR #16 and active PR #19.
- ⚠️ GitHub Actions execution is externally blocked at private-repository job provisioning; the minimal probe fails before runner creation while GitHub public Actions status is operational. Full automated verification must be rerun after organization/account recovery.
- ⚠️ Exact production hostname and Cloudflare Access policy still require dashboard verification.

### 2026-10-03 — Program initialization

- ✅ Completed full architecture/repository audit against `main`.
- ✅ Confirmed current source head `ae7d0b47b89236a9b152a3083c422779946a41b1`.
- ✅ Confirmed repository admin/push access.
- ✅ Created branch `hardening/scalability-overhaul-20261003`.
- ✅ Established this progress file as the modernization source of truth.
- ✅ Baseline CI failure diagnosed; proceed with runtime scalability work while keeping the external Actions outage visible.

## Decision log

### D-001 — Keep the current platform unless measurement proves otherwise
The application remains a static/vanilla web PWA during the scalability refactor. The current bottlenecks are data loading, rendering, caching, and storage architecture; changing UI framework would add migration risk without fixing those root causes.

### D-002 — Preserve medical content authority
Refactors may reorganize delivery and storage but must not silently add, remove, reinterpret, or rewrite medical study content. Existing content/count/image integrity checks remain release gates.

### D-003 — Prefer backward-compatible migrations
User progress and stable content IDs are treated as persistent data. Breaking schema/ID changes require explicit migration and rollback paths.


### D-004 — Treat synthetic GitHub Actions BuildFailed as a control-plane blocker
The failure was isolated with a workflow containing only a standard hosted runner plus shell-native `echo`/`uname`; the result remained `BuildFailed/startup_failure` with zero jobs. Therefore application code, workflow actions, containers, and validators are excluded as root causes. Organization/repository Actions policy, hosted-runner enablement, workflow-execution policy, account billing/usage, or a GitHub-controlled Actions disablement remain the actionable control-plane checks. No production promotion is considered verified until GitHub creates real jobs and the complete quality matrix passes.

Operational outcome: the blocker was resolved by transferring the same repository to the personal `Hafezalhoot` account, after which hosted runners executed normally. The exact organization-side policy/provisioning setting was not identified, so the historical diagnosis remains a control-plane finding rather than a specific billing/policy attribution.

### D-005 — Do not couple Cloudflare production promotion to an unverified push
Workers Builds can deploy directly from the production branch. Until the quality gate is functioning and Cloudflare branch control is verified, the approved operational pattern is version upload/preview first, then explicit promotion after validation.


### D-006 — Keep lecture IDs globally unique while scoping reusable lower-level identities
Subjects and item progress are scoped by course, but lecture IDs remain globally unique in v1. This keeps catalog lookup and lazy loading simple while still preventing the practical course/subject/item collisions identified in the audit. Revisit only if the product genuinely needs the same lecture ID in multiple course packs.

### D-007 — Do not rewrite verified medical content into speculative typed blocks
The current case/core/image/detailed/rapid structures are explicit enough for the product today. A new rich-content block system would create migration and medical-content review risk without solving a current bottleneck, so schema v1 is versioned and validated instead.

### D-008 — Search indexes are sharded by course and subject
A single full-bank search payload would recreate corpus-size coupling, while subject-only filenames would collide when the same specialty appears in multiple courses. Build output therefore publishes one compact `course--subject` shard plus a tiny catalog; only the active scope is fetched, and explicit offline subject download includes that shard.
