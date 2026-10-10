<script lang="ts">
/** Marked when the tool's screen is first drawn; the @perf suite times opens to it (sad.md §7). */
export const TOOL_READY_MARK = 'imgly:draw-tool-ready'
</script>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useEditorStore } from '@/features/editor'
import DrawControls from './DrawControls.vue'
import { ACTION_LABEL, GROUPS } from './messages'
import { createToolKeys } from './shortcuts'
import { useDrawStore } from './store'

const editor = useEditorStore()
const tool = useDrawStore()

const onKeydown = createToolKeys({
  blocked: () => editor.phase === 'confirming',
  apply: () => tool.apply(),
  cancel: () => tool.cancel(),
  setMode: (mode) => tool.setMode(mode),
  stepWidth: (delta) => tool.stepWidth(delta),
})

const focus = (selector: string) =>
  (document.querySelector(selector) as HTMLElement | null)?.focus()

/** The checked option of the mode group: "Brush" when the tool opens. */
const MODE = `[role="radiogroup"][aria-label="${GROUPS.mode}"] [role="radio"][aria-checked="true"]`
const panel = ref<HTMLElement>()

/** A declined replace returns focus into the tool (screens.md SCR-07), unless it is already there. */
watch(
  () => editor.phase,
  (phase, previous) => {
    if (previous !== 'confirming' || phase === 'confirming') return
    if (panel.value?.contains(document.activeElement)) return
    focus(MODE)
  },
  { flush: 'post' },
)

onMounted(async () => {
  window.addEventListener('keydown', onKeydown)
  await nextTick()
  focus(MODE)
  performance.mark(TOOL_READY_MARK)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  // After Apply or Cancel focus returns to the action that opened the tool.
  void nextTick(() => focus('[data-testid="draw-action"]'))
})
</script>

<template>
  <aside
    ref="panel"
    class="draw-tool"
    :aria-label="ACTION_LABEL"
    data-testid="draw-tool"
    data-keeps-space
  >
    <DrawControls />
  </aside>
</template>

<style scoped>
.draw-tool {
  flex: none;
  width: var(--panel-width);
  overflow-y: auto;
  border-left: 1px solid var(--color-border);
  background: var(--color-surface-raised);
}

@media (max-width: 1023px) {
  .draw-tool {
    width: auto;
    border-top: 1px solid var(--color-border);
    border-left: none;
  }
}
</style>
