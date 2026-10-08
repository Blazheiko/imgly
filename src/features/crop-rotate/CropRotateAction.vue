<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, useId } from 'vue'
import { useEditorStore } from '@/features/editor'
import { BaseButton, useNotices } from '@/shared'
import { ACTION_LABEL, ACTION_TOOLTIP, infoNoImage } from './messages'
import { createOpenShortcut } from './shortcuts'
import { useCropRotateStore } from './store'

const editor = useEditorStore()
const tool = useCropRotateStore()
const notices = useNotices()
const hintId = useId()

const hasWork = computed(() => editor.work !== null)
const exporting = computed(() => editor.phase === 'exporting')
const open = computed(() => editor.activeTool === 'crop-rotate')

function notifyNoImage() {
  notices.pushAll([{ kind: 'info', text: infoNoImage() }])
}

/** No image → the hint (AC-18); otherwise open, or a refusal that is never queued (AC-15). */
function onActivate() {
  if (!hasWork.value) notifyNoImage()
  else if (!open.value) tool.open()
}

const onKeydown = createOpenShortcut({
  hasWork: () => hasWork.value,
  exporting: () => exporting.value,
  panelOpen: () => editor.activePanel !== null,
  toolOpen: () => editor.activeTool !== null,
  confirming: () => editor.phase === 'confirming',
  open: () => void tool.open(),
  notifyNoImage,
})

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <BaseButton
    :disabled="exporting"
    :pressed="hasWork ? open : undefined"
    :aria-disabled="hasWork ? undefined : 'true'"
    :aria-describedby="hasWork ? undefined : hintId"
    :title="ACTION_TOOLTIP"
    :class="{ 'crop-rotate-action--unavailable': !hasWork }"
    data-testid="crop-rotate-action"
    data-keeps-space
    @click="onActivate"
  >
    <svg class="crop-rotate-action__icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M4 1v11h11M1 4h11v11" fill="none" stroke="currentColor" stroke-width="1.5" />
    </svg>
    {{ ACTION_LABEL }}
  </BaseButton>
  <span v-if="!hasWork" :id="hintId" class="crop-rotate-action__hint">{{ infoNoImage() }}</span>
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
