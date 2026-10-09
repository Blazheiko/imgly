<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, useId } from 'vue'
import { useEditorStore } from '@/features/editor'
import { BaseButton, useNotices } from '@/shared'
import { ACTION_LABEL, ACTION_TOOLTIP, infoNoImage, infoOtherToolOpen } from './messages'
import { createOpenShortcut } from './shortcuts'
import { useCropRotateStore } from './store'

const editor = useEditorStore()
const tool = useCropRotateStore()
const notices = useNotices()
const hintId = useId()

const hasWork = computed(() => editor.work !== null)
const exporting = computed(() => editor.phase === 'exporting')
const open = computed(() => editor.activeTool === 'crop-rotate')
const otherToolOpen = computed(() => editor.activeTool !== null && !open.value)
/** Why the action can't be used now, shown as its description: no image, or another tool open. */
const hint = computed(() =>
  !hasWork.value ? infoNoImage() : otherToolOpen.value ? infoOtherToolOpen() : null,
)

function notifyNoImage() {
  notices.pushAll([{ kind: 'info', text: infoNoImage() }])
}

function notifyOtherToolOpen() {
  notices.pushAll([{ kind: 'info', text: infoOtherToolOpen() }])
}

/**
 * No image → the hint (AC-18); another tool open → apply or cancel it first (adjust AC-18);
 * otherwise open, or a refusal that is never queued (AC-15).
 */
function onActivate() {
  if (!hasWork.value) notifyNoImage()
  else if (otherToolOpen.value) notifyOtherToolOpen()
  else if (!open.value) tool.open()
}

const onKeydown = createOpenShortcut({
  hasWork: () => hasWork.value,
  exporting: () => exporting.value,
  panelOpen: () => editor.activePanel !== null,
  toolOpen: () => open.value,
  otherToolOpen: () => otherToolOpen.value,
  confirming: () => editor.phase === 'confirming',
  open: () => void tool.open(),
  notifyNoImage,
  notifyOtherToolOpen,
})

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <BaseButton
    :disabled="exporting"
    :pressed="hasWork ? open : undefined"
    :aria-disabled="hint ? 'true' : undefined"
    :aria-describedby="hint ? hintId : undefined"
    :title="ACTION_TOOLTIP"
    :class="{ 'crop-rotate-action--unavailable': hint }"
    data-testid="crop-rotate-action"
    data-keeps-space
    @click="onActivate"
  >
    <svg class="crop-rotate-action__icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M4 1v11h11M1 4h11v11" fill="none" stroke="currentColor" stroke-width="1.5" />
    </svg>
    {{ ACTION_LABEL }}
  </BaseButton>
  <span v-if="hint" :id="hintId" class="crop-rotate-action__hint">{{ hint }}</span>
</template>

<style scoped>
.crop-rotate-action--unavailable {
  opacity: 0.45;
}

.crop-rotate-action__icon {
  width: var(--space-4);
  height: var(--space-4);
}

.crop-rotate-action__hint {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
