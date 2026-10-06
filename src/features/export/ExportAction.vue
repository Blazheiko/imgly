<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId } from 'vue'
import { useEditorStore } from '@/features/editor'
import { BaseButton, Spinner, useNotices } from '@/shared'
import ExportPanel from './ExportPanel.vue'
import { infoNoImage } from './messages'
import { createSaveShortcut } from './shortcuts'
import { useExportStore } from './store'

const editor = useEditorStore()
const store = useExportStore()
const notices = useNotices()

const button = ref<InstanceType<typeof BaseButton>>()
const anchor = computed(() => (button.value?.$el as HTMLElement | undefined) ?? null)
const hintId = useId()

const hasWork = computed(() => editor.work !== null)
// File ready is still an export: Export stays disabled with progress (screens.md SCR-01).
const exporting = computed(() => editor.phase === 'exporting')
// Reading an image or the replace dialog also make Export unavailable for the moment.
const unavailable = computed(() => exporting.value || store.editorBusy)

function notifyNoImage() {
  notices.pushAll([{ kind: 'info', text: infoNoImage() }])
}

function onActivate() {
  if (!hasWork.value) notifyNoImage()
  else if (store.panelOpen) store.closePanel()
  else store.openPanel()
}

const onKeydown = createSaveShortcut({
  hasWork: () => hasWork.value,
  exporting: () => unavailable.value,
  panelOpen: () => store.panelOpen,
  confirm: () => void store.confirm(),
  openPanel: () => store.openPanel(),
  notifyNoImage,
})

// Capture phase: Ctrl/Cmd+S is handled before any field or the browser can act on it.
onMounted(() => window.addEventListener('keydown', onKeydown, { capture: true }))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown, { capture: true }))
</script>

<template>
  <BaseButton
    ref="button"
    variant="primary"
    :disabled="unavailable"
    :aria-disabled="hasWork ? undefined : 'true'"
    :aria-describedby="hasWork ? undefined : hintId"
    :aria-expanded="store.panelOpen ? 'true' : 'false'"
    aria-haspopup="dialog"
    data-keeps-space
    :class="{ 'export-action--unavailable': !hasWork }"
    @click="onActivate"
  >
    <span v-if="exporting" class="export-action__spinner"><Spinner label="Exporting" /></span>
    {{ exporting ? 'Exporting…' : 'Export' }}
  </BaseButton>
  <span v-if="!hasWork" :id="hintId" class="export-action__hint">{{ infoNoImage() }}</span>
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
