<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId } from 'vue'
import { useEditorStore } from '@/features/editor'
import { BaseButton, Spinner, useNotices } from '@/shared'
import ExportPanel from './ExportPanel.vue'
import { infoNoImage, infoToolOpen } from './messages'
import { createSaveShortcut } from './shortcuts'
import { useExportStore } from './store'

const editor = useEditorStore()
const store = useExportStore()
const notices = useNotices()

const button = ref<InstanceType<typeof BaseButton>>()
const anchor = computed(() => (button.value?.$el as HTMLElement | undefined) ?? null)
const hintId = useId()

const hasWork = computed(() => editor.work !== null)
// An open tool's Draft is not the Work yet: Export waits for Apply or Cancel (crop-rotate AC-16).
const toolOpen = computed(() => editor.activeTool !== null)
/** Unavailable but focusable, with a hint saying why (SCR-02; crop-rotate SCR-03). */
const hint = computed(() =>
  !hasWork.value ? infoNoImage() : toolOpen.value ? infoToolOpen() : null,
)
// File ready is still an export: Export stays disabled with progress (screens.md SCR-01).
const exporting = computed(() => editor.phase === 'exporting')
// Reading an image or the replace dialog also make Export unavailable for the moment.
const unavailable = computed(() => exporting.value || store.editorBusy)
// With no Work it stays focusable (aria-disabled) and shows its hint, even during a read (SCR-02).
const disabled = computed(() => exporting.value || (hasWork.value && store.editorBusy))

function notifyNoImage() {
  notices.pushAll([{ kind: 'info', text: infoNoImage() }])
}

function notifyToolOpen() {
  notices.pushAll([{ kind: 'info', text: infoToolOpen() }])
}

function onActivate() {
  if (!hasWork.value) notifyNoImage()
  else if (toolOpen.value) notifyToolOpen()
  else if (store.panelOpen) store.closePanel()
  else store.openPanel()
}

const onKeydown = createSaveShortcut({
  hasWork: () => hasWork.value,
  exporting: () => unavailable.value,
  toolOpen: () => toolOpen.value,
  panelOpen: () => store.panelOpen,
  confirm: () => void store.confirm(),
  openPanel: () => store.openPanel(),
  notifyNoImage,
  notifyToolOpen,
})

// Capture phase: Ctrl/Cmd+S is handled before any field or the browser can act on it.
onMounted(() => window.addEventListener('keydown', onKeydown, { capture: true }))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown, { capture: true }))
</script>

<template>
  <BaseButton
    ref="button"
    variant="primary"
    :disabled="disabled"
    :aria-disabled="hint ? 'true' : undefined"
    :aria-describedby="hint ? hintId : undefined"
    :aria-expanded="store.panelOpen ? 'true' : 'false'"
    aria-haspopup="dialog"
    data-keeps-space
    :class="{ 'export-action--unavailable': hint !== null }"
    @click="onActivate"
  >
    <span v-if="exporting" class="export-action__spinner"><Spinner label="Exporting" /></span>
    {{ exporting ? 'Exporting…' : 'Export' }}
  </BaseButton>
  <span v-if="hint" :id="hintId" class="export-action__hint">{{ hint }}</span>
  <ExportPanel :anchor="anchor" />
</template>

<style scoped>
.export-action--unavailable {
  opacity: 0.45;
}

.export-action__spinner :deep(.spinner__ring) {
  width: var(--space-4);
  height: var(--space-4);
}

.export-action__hint {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
