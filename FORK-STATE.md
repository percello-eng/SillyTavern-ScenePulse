# Percello ScenePulse fork — current deployed state

**Status date:** 11 September 2026  
**Status:** deployed / known working  
**Scope:** fork-specific code state, deployment, validation and rollback points. This document does not replace the wider SillyTavern project handover or the separately maintained ScenePulse design briefs.

## 1. Repository position

- Repository: `percello-eng/SillyTavern-ScenePulse`
- Maintained fork of: `xenofei/SillyTavern-ScenePulse`
- Upstream baseline retained in history: ScenePulse v6.27.20, commit `2888d0d748033c5b16eac410f5396af055142483`
- Live host path: `/home/percello/sillytavern/data/default-user/extensions/SillyTavern-ScenePulse`
- Current deployed code commit: `7fdb38f849722cda2356d5a6c519985a48f35ae7`
- Current known-working tag: `known-working-2026-09-11`
- Previous rollback tag: `known-working-2026-09-09` → `a68501a5efd831a18b772f0c74bbe90e00219783`
- Lifecycle development branch retained: `fix/respins-swipe-lifecycle`

`known-working-2026-09-11` marks the deployed code state. Documentation-only commits may sit above that tag on `main` without changing the deployed extension behaviour.

## 2. Fork-specific code deltas

### 2.1 Renderer guard

Commit `a68501a5efd831a18b772f0c74bbe90e00219783` fixes the verbose `sceneTension` renderer crash.

The renderer now always adds the base tension-row class, but only adds a colour-specific `sp-tension-*` class when the returned tension value exactly matches a recognised tension key. Verbose explanatory tension strings therefore no longer cause `classList.add()` to reject an invalid token and abort ScenePulse panel rendering.

This fix is retained unchanged by the later lifecycle work.

### 2.2 Response lifecycle / snapshot-branch handling

Commit `7fdb38f849722cda2356d5a6c519985a48f35ae7` implements the accepted response-lifecycle fix.

Required invariant:

> Rejecting or changing an assistant response must also invalidate ScenePulse state derived from that response. Canonical ScenePulse state must correspond to the currently selected transcript branch.

Changed files:

- `index.js`
- `src/generation/engine.js`
- `src/settings.js`
- `src/ui/message.js`

Protected renderer file `src/ui/update-panel.js` was not changed by this lifecycle amendment.

## 3. Lifecycle implementation summary

The deployed implementation now:

- invalidates snapshots derived from a rejected or replaced assistant response;
- tracks snapshot provenance with source `send_date`, selected `swipe_id` and a deterministic message-text fingerprint;
- validates source-message provenance before accepting a newly generated snapshot;
- uses composite chat ownership so delayed/in-flight ScenePulse work cannot cross between chats;
- reconciles inherited/stale snapshots synchronously on chat changes when the chat identity is available;
- handles Regenerate with soft lifecycle cancellation so the replacement RP generation is not killed;
- handles swipe/respin and Continue lifecycle changes with hard cancellation only when ScenePulse owns the active API request;
- restricts physical generation cancellation to the actual visible SillyTavern `#mes_stop` control;
- serialises ScenePulse connection-profile switching, awaits profile application/restoration, bounds save waits, and rechecks staleness before accepting the result;
- preserves a ScenePulse snapshot after a normal in-place manual text edit where the same message version and selected swipe remain current;
- conservatively removes inherited branch snapshots when provenance establishes that they belong to another selected response version.

Legacy snapshots are not given invented provenance. They are retained or removed only where the available evidence supports that decision.

## 4. Validation record

The final accepted code diff from `a68501a` to `7fdb38f` has SHA-256:

```text
704b790eece75f7f7d439e7719d7e37631d73beb4422158de12a454cf708accc
```

Static validation on the actual live bind-mounted repository:

- `node --check` passed on all four modified JavaScript files;
- all 23 existing ScenePulse test files passed;
- `git diff --check` passed;
- only the intended four files changed;
- the protected renderer fix remained untouched.

Independent LLM review was performed against the exact final v5 diff and exact baseline. Earlier review findings were incorporated and the final review outcome was **GO — suitable for runtime validation**.

Runtime validation passed for:

- ordinary accepted assistant generation;
- new swipe/respin generation;
- selecting an existing swipe;
- ordinary Regenerate;
- stale in-flight ScenePulse result rejection;
- Continue;
- in-place manual assistant-message edit followed by chat switch/reload;
- branch creation from a non-current historical swipe.

The attempted case of triggering another Regenerate while ScenePulse itself was still generating was prevented by the normal SillyTavern UI, so the competing action could not be initiated through the tested UI path.

The branch-from-historical-swipe test specifically confirmed that inherited snapshot `#8` was removed on branch load because its provenance did not match the selected branch response; ScenePulse fell back to the latest valid earlier snapshot.

## 5. Validated runtime environment

The lifecycle amendment was validated under the current project environment:

- SillyTavern `1.18.0`;
- ScenePulse v6.27.20 fork;
- ScenePulse profile: `Working - current`;
- Generation mode: `Separate`;
- context messages: `8`;
- delta mode: off;
- ScenePulse connection profile: `Deepseek v4 flash - main chat`.

No Qvink configuration, character card, Author's Note, ScenePulse field architecture or `Working - current` prompt rules were changed as part of the lifecycle amendment.

## 6. Deployment record

The accepted lifecycle candidate was:

1. developed and validated on `fix/respins-swipe-lifecycle`;
2. committed as `7fdb38f849722cda2356d5a6c519985a48f35ae7` with message `Fix ScenePulse response lifecycle snapshot handling`;
3. pushed to the remote feature branch;
4. fast-forwarded to local `main`;
5. pushed to remote `main`;
6. tagged with annotated tag `known-working-2026-09-11` using message `Known working after ScenePulse response lifecycle snapshot fix`.

The previous `known-working-2026-09-09` rollback point remains available.

## 7. Current qualifications / watch points

- Intermittent empty DeepSeek quiet responses were observed during testing; ScenePulse retries recovered. No evidence linked those empty responses to the lifecycle amendment.
- Cross-extension connection-profile interference remains an accepted residual risk outside the scope of this patch.
- A transient `CHAT_CHANGED` event can occur before a chat ID is available; reconciliation deliberately skips that instant rather than guessing ownership, and subsequent loaded-chat state remains authoritative.
- Upstream ScenePulse remains at the older baseline in this fork history. Future upstream updates must be reviewed against both fork-specific fixes before adoption.
- Extension replacement/update can supersede fork files; Git history and the known-working tags are the controlling recovery mechanism.

## 8. Explicitly not implemented by this deployment

The following remain separate planned design work and must not be inferred from this code deployment:

- ScenePulse character-continuity / relationship-state development;
- narrative-direction / future-story-ideas development;
- broader world/lorebook architecture work.

This document records the fork and deployment state only.