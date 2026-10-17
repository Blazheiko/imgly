<script setup lang="ts">
// The imgly brand mark (ui-refresh screens.md §Brand mark, brand/logo-concept.svg `mark`): two crop
// corners and an accent dot on a 32 × 32 grid. Decoration only; the wordmark beside it is the text.
import { useId } from 'vue'

withDefaults(defineProps<{ wordmark?: boolean }>(), { wordmark: true })

const gradientId = `app-logo-${useId()}`
</script>

<template>
  <span class="app-logo">
    <svg class="app-logo__mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient :id="gradientId" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style="stop-color: var(--color-brand-from)" />
          <stop offset="1" style="stop-color: var(--color-brand-to)" />
        </linearGradient>
      </defs>
      <path
        d="M5 14V8a3 3 0 0 1 3-3h6"
        fill="none"
        :stroke="`url(#${gradientId})`"
        stroke-width="3.25"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M27 18v6a3 3 0 0 1-3 3h-6"
        fill="none"
        :stroke="`url(#${gradientId})`"
        stroke-width="3.25"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <circle cx="21" cy="11" r="3" :fill="`url(#${gradientId})`" />
    </svg>
    <span v-if="wordmark" class="app-logo__wordmark">imgly</span>
  </span>
</template>

<style scoped>
.app-logo {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.app-logo__mark {
  flex: none;
  width: var(--space-6);
  height: var(--space-6);
}

.app-logo__wordmark {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  letter-spacing: var(--tracking-tight);
  line-height: var(--line-height-tight);
}
</style>
