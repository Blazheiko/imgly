---
status: Draft
owner: "Blazheiko"
updated_at: "2026-10-02"
depth: "medium"
---

# Idea brief — imgly-editor

## 1. Raw idea

легкий веб застосунок для роботи з зображеннями, мередбачається такий функціонал як crop фільтри по світлу контрастності кольоровій гаммі і так далі, інструменти для малювання прямо на зображенні від руки , вибір кольору та товщини ліній.Може зберігати зображення в вібраному форматі. Застосунок працює і офлайн завдяки технології PWA, може зберігати результати роботи між сесіями, та має історію роботи з зображеннями.

## 2. Problem

There is no market problem to solve here. This is a personal learning and portfolio project, so the problem is the owner's: they need a finished, publicly deployed and installable offline web app that exercises image processing, freehand drawing, local persistence and PWA techniques end to end. The main threat is scope. The raw idea ends its feature list with "and so on", and an open-ended editor is exactly the kind of project that never ships.

## 3. Users

- **The owner (primary)**: builds the app to learn the techniques and shows it in a portfolio.
- **Portfolio reviewers (secondary)**: recruiters and engineers who open the deployed app, install it and try the end-to-end flow on a desktop browser.
- **Casual desktop users (incidental)**: anyone who wants a quick offline crop, adjust, annotate and export. They are not a design target.

## 4. Why now

There is no external trigger. The driver is self-imposed: a deployed MVP within roughly 4–6 weeks of spare-time work. The deadline is what turns this from a "nice to have" into a project with a finish line.

## 5. Out of scope

- **Mobile-first and touch-optimised UX**: desktop is the primary target. On mobile the app only has to not break.
- **Full-resolution editing and export**: large photos are downscaled on open to a sane limit (about 4096 px on the long side), which keeps memory and offline storage manageable.
- **Advanced adjustments** such as curves, levels, blur, sharpen and presets, plus text and shapes: these come after deployment. They are the "and so on" that sinks the timeline.
- **Per-stroke vector editing**: strokes live on one drawing layer and are not individually selectable or editable objects.
- **Persistent operation history across sessions**: undo/redo lasts only while an image is open. Between sessions the app keeps the work's editable state, not its step-by-step history.
- **Accounts, cloud backup and sync**: these contradict "lightweight" and would add a server, authentication and conflict handling.
- **Project-file export and import**: the exported image is the reliable copy. A separate project format is one more thing to maintain.

## 6. Risks

- **Scope creep (weakest spot)**: "and so on" in the feature list. The plan assumes the fixed set of about 6 adjustments holds. It fails if new filters or tools slip in before deployment.
- **"History" means two different things**: the gallery of recent works and in-session undo/redo. Mixing them up during design leads to an over-built data model.
- **Storage is not durable**: the browser can evict the gallery, either because space runs low or because the user clears site data. This is acceptable only if the app says so honestly and treats export as the real save.
- **Fixed pipeline order**: crop, then adjustments, then drawing. Re-editing yesterday's crop or brightness under an existing drawing layer has to keep the drawing aligned, or the reopen-and-edit promise breaks.
- **Downscaling on open**: this assumes users accept losing full resolution. That fails for anyone who expects to export at the original size.
- **Integration with the OS**: opening files through the system ("Open with…") support differs between browsers. If the browser support is weaker than expected, this angle may shrink to drag-and-drop and paste.

## 7. Recommendation

Build a desktop-first, installable offline image editor with a deliberately fixed MVP:
- crop and 90° rotation;
- six adjustments: brightness, contrast, saturation, temperature/tint, grayscale and sepia;
- one brush with an eraser, colour and width;
- export to PNG, JPEG or WebP with a quality setting.

Each work is stored as the original plus adjustment parameters plus a separate drawing layer. Works can be reopened from a gallery of recent items (capped at about 20, oldest evicted first) and re-edited non-destructively. Undo/redo applies within the open session.

The portfolio differentiator is real integration with the OS: the app acts as a system image handler, accepts drag-and-drop and paste from the clipboard, and copies results to the clipboard. This is planned as the final MVP step and is the first thing cut if the 4–6 week budget slips.

## 8. Open questions

- Exact downscale limit on open: 4096 px or lower? It depends on the memory budget. — owner
- Gallery cap: about 20 works or a storage-size budget? Decide whether the app asks the browser for persistent storage. — owner
- Should the drawing layer be anchored to the cropped frame or to the original image coordinates when the crop is re-edited? — owner, at design
- Minimum browser support for integration with the OS, and the fallback when the system file handler is unavailable. — owner, at design
