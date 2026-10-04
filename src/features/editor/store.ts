import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { Work } from '@/core'

/** The editor store — the coordination point between features (no event bus). */
export const useEditorStore = defineStore('editor', () => {
  const work = ref<Work | null>(null)

  return { work }
})
