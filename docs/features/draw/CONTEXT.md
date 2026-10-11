---
status: Living
updated_at: "2026-10-09"
---

# Domain Context — draw

## Glossary

- Brush — the "Draw" tool's mode that paints fully opaque Strokes of the chosen colour and width onto the Drawing layer. NOT the Eraser, which removes marks, and NOT a way to change the image's own pixels: the Brush paints only on the Drawing layer.
- Clear — the "Draw" tool's action that removes every mark from the Draft at once, applied marks included; like a Stroke, it reaches the Work only on Apply. NOT Cancel, which throws away only the changes made since the tool opened and keeps the marks applied before.
- Draft — the Drawing layer being changed in the open "Draw" tool, with every Stroke and Clear made since it opened; it reaches the Work only on Apply and is thrown away by Cancel, Escape or replacing the Work. NOT Unsaved edits: changes in the Draft never count as Unsaved edits until they are applied. NOT the crop-rotate Draft, which holds a Geometry, and NOT the adjust Draft, which holds Adjustments.
- Eraser — the "Draw" tool's mode that removes marks from the Drawing layer along its Stroke, uncovering the image under them. NOT a way to make the image transparent: where nothing is drawn, the Eraser changes nothing.
