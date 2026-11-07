# My Medical Library

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users and purpose

A personal medical lecture and question library for studying original lecture material, practicing questions and reviewing saved weaknesses. The current continuation request delegates implementation choices and asks for clear navigation and easier management of Materials, Chapters, Lectures and Topics.

## Stack and operating context

Existing vanilla HTML/CSS/JS PWA, Python authoring/build tools, device-local IndexedDB progress and an existing Cloudflare Worker. The legacy standalone HTML export remains supported. No framework rewrite is required for the redesign.

## Product constraints

Material/course → specialty → optional Chapter → lecture → topic. Chapter groups are curriculum metadata; topics belong inside one lecture. The catalog currently has 3 courses and 12 published lectures, with 138 reviewed MCQs across 3 lectures.

Keep Exam mode, authored question types, original-source figures and fingerprints, learner progress identities, safe backup/restore, print and offline behavior. The uploaded original lecture remains the authority for clinical facts. Do not invent medical content or score written responses automatically.

Authoring is separate from study. The initial browser flow prepares local metadata drafts only. Source review, validation and controlled publication remain the repository workflow. A static browser form does not supply a private administrative authorization boundary.

## Evidence and continuity

`AGENTS.md`, `CONTENT_AUTHORING.md` and the actual source/data contracts govern development. `docs/project-autopilot/PROJECT_STATUS.md` records current branch, test and release evidence; older design documents contain historical states and are not proof of current deployment.
