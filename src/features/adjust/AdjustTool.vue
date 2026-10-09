<script lang="ts">
/** Marked when the tool's screen is first drawn; the @perf suite times opens to it (sad.md §7). */
export const TOOL_READY_MARK = 'imgly:adjust-tool-ready'
</script>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useEditorStore } from '@/features/editor'
import AdjustControls from './AdjustControls.vue'
import { ACTION_LABEL } from './messages'
import { createCompareKey, createToolKeys } from './shortcuts'
import { useAdjustStore } from './store'

const editor = useEditorStore()
const tool = useAdjustStore()

const onToolKey = createToolKeys({
  blocked: () => editor.phase === 'confirming',
  apply: () => tool.apply(),
  cancel: () => tool.cancel(),
})
const compareKey = createCompareKey({
  start: () => tool.startCompare(),
  end: () => tool.endCompare(),
})

function onKeydown(event: KeyboardEvent) {
  compareKey.keydown(event)
  onToolKey(event)
}

/** Compare ends when the window loses focus, so a release elsewhere can't leave it held (AC-08). */
function onBlur() {
  tool.endCompare()
}

const focus = (selector: string) =>
  (document.querySelector(selector) as HTMLElement | null)?.focus()

const BRIGHTNESS = '[data-testid="adjust-slider-brightness"] input[type="range"]'
const panel = ref<HTMLElement>()

/**
 * A declined replace returns focus into the tool (screens.md SCR-06). The dialog gives focus back to
 * its opener, which is the top bar's "Open image" when the file came from there; a drop leaves
 * focus inside the tool, where it stays. Runs after the dialog has unmounted.
 */
watch(
  () => editor.phase,
  (phase, previous) => {
    if (previous !== 'confirming' || phase === 'confirming') return
    if (panel.value?.contains(document.activeElement)) return
    focus(BRIGHTNESS)
  },
  { flush: 'post' },
)

onMounted(async () => {
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('keyup', compareKey.keyup)
  window.addEventListener('blur', onBlur)
  await nextTick()
  // Focus starts on the brightness slider (screens.md §Keyboard).
  focus(BRIGHTNESS)
  performance.mark(TOOL_READY_MARK)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('keyup', compareKey.keyup)
  window.removeEventListener('blur', onBlur)
  // After Apply or Cancel focus returns to the action that opened the tool.
  void nextTick(() => focus('[data-testid="adjust-action"]'))
})
</script>

<template>
  <aside
    ref="panel"
    class="adjust-tool"
    :aria-label="ACTION_LABEL"
    data-testid="adjust-tool"
    data-keeps-space
  >
    <AdjustControls />
  </aside>
</template>

<style scoped>
.adjust-tool {
  flex: none;
  width: var(--panel-width);
  overflow-y: auto;
  border-left: 1px solid var(--color-border);
  background: var(--color-surface-raised);
}

@media (max-width: 1023px) {
  .adjust-tool {
    width: auto;
    border-top: 1px solid var(--color-border);
    border-left: none;
  }
}
</style>
