<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, useId } from 'vue'
import { useEditorStore } from '@/features/editor'
import { BaseButton, useNotices } from '@/shared'
import {
  INFO_EXPORTING,
  INFO_TOOL_OPEN,
  LABEL_REDO,
  LABEL_UNDO,
  redoHint,
  undoHint,
} from './messages'
import { createUndoRedoShortcuts } from './shortcuts'

const editor = useEditorStore()
const notices = useNotices()
const undoHintId = useId()
const redoHintId = useId()

const exporting = computed(() => editor.phase === 'exporting')
const toolOpen = computed(() => editor.activeTool !== null)

/** Why both are refused, if they are: an export (AC-07) or an open tool (AC-08). */
const refusal = computed(() =>
  exporting.value ? INFO_EXPORTING : toolOpen.value ? INFO_TOOL_OPEN : null,
)
const undoText = computed(() => refusal.value ?? undoHint(editor.undoTool))
const redoText = computed(() => refusal.value ?? redoHint(editor.redoTool))

function notify(text: string) {
  notices.pushAll([{ kind: 'info', text }])
}

/** A tool open → its hint as a notice; nothing to take → nothing (AC-05); else the action. */
function onUndo() {
  if (toolOpen.value) notify(INFO_TOOL_OPEN)
  else if (editor.canUndo) editor.undo()
}

function onRedo() {
  if (toolOpen.value) notify(INFO_TOOL_OPEN)
  else if (editor.canRedo) editor.redo()
}

const onKeydown = createUndoRedoShortcuts({
  hasWork: () => editor.work !== null,
  confirming: () => editor.phase === 'confirming' || editor.covered,
  exporting: () => exporting.value,
  toolOpen: () => toolOpen.value,
  canUndo: () => editor.canUndo,
  canRedo: () => editor.canRedo,
  undo: () => void editor.undo(),
  redo: () => void editor.redo(),
  notifyToolOpen: () => notify(INFO_TOOL_OPEN),
  notifyExporting: () => notify(INFO_EXPORTING),
})

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <span class="undo-redo">
    <!-- Unavailable but focusable (aria-disabled), except during an export (screens.md SCR-04).
         data-keeps-space: Space activates them instead of starting space-pan (AC-14). -->
    <BaseButton
      variant="ghost"
      icon="undo-2"
      :disabled="exporting"
      :aria-label="LABEL_UNDO"
      :aria-disabled="editor.canUndo ? undefined : 'true'"
      :aria-describedby="undoHintId"
      :title="undoText"
      data-testid="undo-action"
      data-keeps-space
      @click="onUndo"
    />
    <BaseButton
      variant="ghost"
      icon="redo-2"
      :disabled="exporting"
      :aria-label="LABEL_REDO"
      :aria-disabled="editor.canRedo ? undefined : 'true'"
      :aria-describedby="redoHintId"
      :title="redoText"
      data-testid="redo-action"
      data-keeps-space
      @click="onRedo"
    />
    <span :id="undoHintId" class="undo-redo__hint">{{ undoText }}</span>
    <span :id="redoHintId" class="undo-redo__hint">{{ redoText }}</span>
  </span>
</template>

<style scoped>
.undo-redo {
  display: inline-flex;
  gap: var(--space-2);
}

.undo-redo__hint {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
