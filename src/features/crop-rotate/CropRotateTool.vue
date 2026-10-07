<script lang="ts">
/** Marked when the tool's screen is first drawn; the @perf suite times opens to it (sad.md §7). */
export const TOOL_READY_MARK = 'imgly:crop-tool-ready'
</script>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted } from 'vue'
import { useEditorStore } from '@/features/editor'
import CropRotateControls from './CropRotateControls.vue'
import { createToolKeys } from './shortcuts'
import { useCropRotateStore } from './store'

const editor = useEditorStore()
const tool = useCropRotateStore()

const onKeydown = createToolKeys({
  blocked: () => editor.phase === 'confirming',
  apply: () => tool.apply(),
  cancel: () => tool.cancel(),
})

const focus = (selector: string) =>
  (document.querySelector(selector) as HTMLElement | null)?.focus()

onMounted(async () => {
  window.addEventListener('keydown', onKeydown)
  await nextTick()
  focus('[data-testid="crop-frame"]') // focus starts on the frame (screens.md §Keyboard)
  performance.mark(TOOL_READY_MARK)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  // After Apply or Cancel focus returns to the action that opened the tool.
  void nextTick(() => focus('[data-testid="crop-rotate-action"]'))
})
</script>

<template>
  <aside
    class="crop-rotate-tool"
    aria-label="Crop and rotate"
    data-testid="crop-rotate-tool"
    data-keeps-space
  >
    <CropRotateControls />
  </aside>
</template>

<style scoped>
.crop-rotate-tool {
  flex: none;
  width: var(--panel-width);
  overflow-y: auto;
  border-left: 1px solid var(--color-border);
  background: var(--color-surface-raised);
}

@media (max-width: 1023px) {
  .crop-rotate-tool {
    width: auto;
    border-top: 1px solid var(--color-border);
    border-left: none;
  }
}
</style>
