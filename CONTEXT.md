---
status: Living
updated_at: "2026-10-03"
---

# Domain Context — imgly-editor

## Glossary

- Downscale limit — the maximum length, in pixels, of an image's long side once it is opened (4096 px); larger images are reduced to it proportionally on open. NOT the export size the Editor chooses later, which can only be equal or smaller.
- Editor — the person editing an image in the app: the owner or any casual desktop user. NOT the Portfolio reviewer, whose goal is to judge the app rather than to finish an image.
- Original — the opened image after orientation is applied and it is reduced to the Downscale limit; every later edit starts from it. NOT the source file on disk, which the app never modifies and does not keep.
- Portfolio reviewer — a recruiter or engineer who opens the deployed app to evaluate it, usually for the first time and on a desktop browser. NOT a separate permission level: the app has no accounts, so a reviewer can do everything an Editor can.
- Preview — what the canvas currently shows: the Work rendered with all its edits at the current View. NOT the exported image, which is rendered separately at the Original's resolution.
- Supported image — an image file whose content, not its name, is JPEG, PNG, WebP, AVIF or GIF, or HEIC/HEIF when the current browser can decode it itself; only Supported images can be opened. NOT any image the browser happens to decode: SVG, BMP, ICO, TIFF, camera RAW/DNG and PSD are refused with a named reason even where the browser could open them.
- Unsaved edits — changes to the open Work that exist nowhere outside the current session and would be lost if it were replaced. NOT View changes (zoom or pan), which never count as edits.
- View — how the Preview is framed on screen: the zoom level and the pan position. NOT part of the Work: it is never saved or exported, and changing it is not an edit.
- Work — one image being edited: its Original plus everything applied on top of it (crop and rotation, adjustment values, the drawing layer). NOT a file on disk, and NOT an exported image.

## Invariants

- Only one Work is open at a time.
- An Original's long side never exceeds the Downscale limit.
- Opening a new image never discards the open Work unless the new image has been read successfully and, when there are Unsaved edits, the Editor has confirmed the replacement.
