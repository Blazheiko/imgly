---
status: Living
updated_at: "2026-10-06"
---

# Domain Context — crop-rotate

## Glossary

- Draft — the Geometry being changed in the open "Crop and rotate" tool; it reaches the Work only on Apply and is thrown away by Cancel, Escape or replacing the Work. NOT Unsaved edits: changes in the Draft never count as Unsaved edits until they are applied.
- Proportion — the width-to-height ratio the crop frame is locked to (Free, Original, 1:1, 4:3, 3:2 or 16:9, landscape or portrait), remembered for the Work until it is replaced. NOT the export size or its presets, which scale the Work and never change its shape.
- Turned image — the Original as it stands after its Flip, Rotation and Straighten angle, before the Crop; the Crop is measured in its pixels and must lie fully inside it, and the tool shows it whole. NOT the Work's result, which is only the part inside the Crop, and NOT the View, which never turns.
