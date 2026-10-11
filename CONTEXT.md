---
status: Living
updated_at: "2026-10-09"
---

# Domain Context — imgly-editor

## Glossary

- Adjustments — the Work's seven colour values, applied after its Geometry: brightness, contrast, saturation, temperature and tint from −100 to +100, and grayscale and sepia from 0% to 100%; each has a neutral value (0, or 0%) at which it changes no pixel, and together they change only colour, never transparency, size or position. NOT the Geometry, which decides which part of the Original is shown and how it is turned, and NOT the drawing layer, which is painted over the adjusted image and is never adjusted itself.
- Crop — the rectangle of the image, as it stands after its Flip, Rotation and Straighten angle, that the Work keeps; the Preview and every Export show only what is inside it, and it always lies fully inside the image and is at least 1×1 px. NOT the View, which only frames the Preview on screen and is never saved, and NOT a destructive cut: the area outside the Crop stays in the Original and can be brought back by widening the Crop.
- Downscale limit — the maximum length, in pixels, of an image's long side once it is opened (4096 px); larger images are reduced to it proportionally on open. NOT the export size the Editor chooses later, which can only be equal or smaller.
- Drawing layer — the Work's one layer of freehand marks, as large as the Original and attached to it, so every Flip, Rotation, Straighten angle and Crop moves it together with the image; it is painted over the adjusted image in the Preview and every Export, is never adjusted itself, and is empty for a newly opened Work. NOT the Original, whose pixels no Stroke ever changes, and NOT a set of separate objects: applied Strokes merge into the one layer and cannot be selected or edited one by one.
- Editor — the person editing an image in the app: the owner or any casual desktop user. NOT the Portfolio reviewer, whose goal is to judge the app rather than to finish an image.
- Export — an image file the Editor saves from the Work in a chosen format, rendered with all its edits at the Work's full size or a smaller size the Editor chooses, independent of the View; it is the durable copy of the Work. NOT the Preview, which follows the View, and NOT the Work, which stays editable.
- Flip — mirroring the image horizontally, vertically or both, as part of its Geometry. NOT Rotation: a horizontal Flip followed by a vertical Flip looks like a 180° Rotation, but each is kept as chosen.
- Geometry — which part of the Original the Work shows and how it is oriented: its Flip, Rotation, Straighten angle and Crop, applied in that order. NOT the View, which never changes the Work, and NOT the adjustment values or the drawing layer, which are applied after it.
- Original — the opened image after orientation is applied and it is reduced to the Downscale limit; every later edit starts from it. NOT the source file on disk, which the app never modifies and does not keep.
- Portfolio reviewer — a recruiter or engineer who opens the deployed app to evaluate it, usually for the first time and on a desktop browser. NOT a separate permission level: the app has no accounts, so a reviewer can do everything an Editor can.
- Preview — what the canvas currently shows: the Work rendered with all its edits at the current View. NOT an Export, which is rendered separately at the Work's full size or a smaller size the Editor chooses.
- Rotation — the Work's turn in quarter turns: 0°, 90°, 180° or 270° clockwise, as part of its Geometry; it keeps every pixel and swaps width and height on 90° and 270°. NOT the Straighten angle, which is a small free angle, and NOT a View change: the View has no rotation.
- Source name — the name of the file the Work was opened from, with its last extension removed only when that extension is a known image extension (jpg, jpeg, jpe, jfif, png, webp, avif, gif, heic or heif, in any letter case); it is used to name Exports. NOT the source file itself, which the app never keeps or modifies, and NOT simply everything before the last dot: `scan.v2` stays `scan.v2`.
- Source format — the image format the Work was opened from, judged by the file's content (for example JPEG, PNG, WebP or HEIC); it picks the default Export format. NOT the Export format the Editor chooses, which can differ, and NOT the file name's extension, which can lie.
- Straighten angle — a small free turn of the image between −45° and +45°, used to level a tilted horizon, as part of its Geometry; it is applied after the Rotation, and the Crop shrinks automatically so that no empty corner ever enters the Work. NOT Rotation, which only turns in exact quarter turns and loses no pixels.
- Stroke — one continuous mark on the Drawing layer, made with the Brush or the Eraser from pressing the pointer down until releasing it. NOT a View gesture: panning or zooming never makes a Stroke, and NOT an object the Editor can select later.
- Supported image — an image file whose content, not its name, is JPEG, PNG, WebP, AVIF or GIF, or HEIC/HEIF when the current browser can decode it itself; only Supported images can be opened. NOT any image the browser happens to decode: SVG, BMP, ICO, TIFF, camera RAW/DNG and PSD are refused with a named reason even where the browser could open them.
- Unsaved edits — changes to the open Work made since it was opened or last exported successfully; they would be lost if the Work were replaced. NOT View changes (zoom or pan), which never count as edits, and NOT the ability to re-edit: after an Export the edits are kept in the exported image, but they can no longer be adjusted separately once the Work is replaced.
- View — how the Preview is framed on screen: the zoom level and the pan position. NOT part of the Work: it is never saved or exported, and changing it is not an edit.
- Work — one image being edited: its Original, Source name and Source format plus everything applied on top of it (its Geometry, adjustment values, the drawing layer). NOT a file on disk, and NOT an exported image.

## Invariants

- Only one Work is open at a time.
- An Original's long side never exceeds the Downscale limit.
- Opening a new image never discards the open Work unless the new image has been read successfully and, when there are Unsaved edits, the Editor has confirmed the replacement.
- A Work's Crop always lies fully inside its image, as it stands after its Flip, Rotation and Straighten angle, and is at least 1×1 px.
