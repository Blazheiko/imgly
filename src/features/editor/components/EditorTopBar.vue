<script setup lang="ts">
import { useSlots } from 'vue'
import { AppLogo, BaseButton } from '@/shared'

const props = withDefaults(defineProps<{ showOpen: boolean; openDisabled?: boolean }>(), {
  openDisabled: false,
})
defineEmits<{ open: [] }>()

// ui-refresh SCR-01: ① Gallery and Open image · ② Undo, Redo · ③ the tools · ④ Install app, Export.
// Other features' actions are mounted by the app shell. A group with nothing to show is left out,
// so no divider or gap marks it (AC-15).
type Group = 'leading' | 'history' | 'tools' | 'actions'

// Slots are not reactive, so the groups are worked out on each render, not cached in a computed.
const slots = useSlots()
function shownGroups(): Group[] {
  const shown: Group[] = []
  if (slots['leading-actions'] || props.showOpen) shown.push('leading')
  if (slots.history) shown.push('history')
  if (slots.tools) shown.push('tools')
  if (slots.actions) shown.push('actions')
  return shown
}
</script>

<template>
  <header class="editor-top-bar" data-testid="editor-top-bar">
    <AppLogo />
    <div class="editor-top-bar__actions">
      <template v-for="(group, index) in shownGroups()" :key="group">
        <span
          v-if="index > 0"
          class="editor-top-bar__divider"
          :class="{ 'editor-top-bar__divider--before-trailing': group === 'actions' }"
          aria-hidden="true"
        />
        <div class="editor-top-bar__group" :class="`editor-top-bar__group--${group}`">
          <template v-if="group === 'leading'">
            <slot name="leading-actions" />
            <BaseButton
              v-if="showOpen"
              variant="ghost"
              icon="image-plus"
              :disabled="openDisabled"
              @click="$emit('open')"
            >
              Open image
            </BaseButton>
          </template>
          <slot v-else-if="group === 'history'" name="history" />
          <slot v-else-if="group === 'tools'" name="tools" />
          <slot v-else name="actions" />
        </div>
      </template>
    </div>
  </header>
</template>

<style scoped>
.editor-top-bar {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--space-3);
  height: var(--toolbar-size);
  padding: 0 var(--space-4);
  border-bottom: 1px solid var(--color-titlebar-border);
  background: var(--color-titlebar);
  color: var(--color-on-titlebar);
}

.editor-top-bar__actions {
  display: flex;
  flex: 1;
  align-items: center;
  gap: var(--space-3);
}

.editor-top-bar :deep(.app-logo) {
  flex: none;
  padding-right: var(--space-3);
  border-right: 1px solid var(--color-titlebar-border);
}

.editor-top-bar__group {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.editor-top-bar__divider {
  flex: none;
  width: 1px;
  height: var(--space-6);
  background: var(--color-titlebar-border);
}

/* Group ④ sits at the right end, so Export ends the bar. */
.editor-top-bar__divider--before-trailing {
  margin-right: auto;
}

.editor-top-bar__group--actions:first-child {
  margin-left: auto;
}
</style>
