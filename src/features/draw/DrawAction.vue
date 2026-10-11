<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, useId } from 'vue'
import { useEditorStore } from '@/features/editor'
import { BaseButton, useNotices } from '@/shared'
import { ACTION_LABEL, ACTION_TOOLTIP, infoNoImage, infoOtherToolOpen } from './messages'
import { createOpenShortcut } from './shortcuts'
import { useDrawStore } from './store'

const editor = useEditorStore()
const tool = useDrawStore()
const notices = useNotices()
const hintId = useId()

const hasWork = computed(() => editor.work !== null)
const exporting = computed(() => editor.phase === 'exporting')
const open = computed(() => editor.activeTool === 'draw')
const otherToolOpen = computed(() => editor.activeTool !== null && !open.value)
/** Why the action can't be used now, shown as its description: no image, or another tool open. */
const hint = computed(() =>
  !hasWork.value ? infoNoImage() : otherToolOpen.value ? infoOtherToolOpen() : null,
)

function notify(text: string) {
  notices.pushAll([{ kind: 'info', text }])
}

/**
 * No image → the hint (AC-17); another tool open → apply or cancel it first (AC-16); otherwise
 * open, or a refusal that is never queued (AC-14).
 */
function onActivate() {
  if (hint.value) notify(hint.value)
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
  notifyNoImage: () => notify(infoNoImage()),
  notifyOtherToolOpen: () => notify(infoOtherToolOpen()),
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
    :class="{ 'draw-action--unavailable': hint }"
    data-testid="draw-action"
    data-keeps-space
    @click="onActivate"
  >
    <svg class="draw-action__icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d="M11 2l3 3-8 8H3v-3zM2 15h12"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linejoin="round"
      />
    </svg>
    {{ ACTION_LABEL }}
  </BaseButton>
  <span v-if="hint" :id="hintId" class="draw-action__hint">{{ hint }}</span>
</template>

<style scoped>
.draw-action--unavailable {
  opacity: 0.45;
}

.draw-action__icon {
  width: var(--space-4);
  height: var(--space-4);
}

.draw-action__hint {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
