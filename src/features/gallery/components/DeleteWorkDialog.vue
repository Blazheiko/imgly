<script setup lang="ts">
import { nextTick } from 'vue'
import { BaseButton, Dialog } from '@/shared'
import { useGallery } from '../store'
import * as m from '../messages'

const gallery = useGallery()

/** The entry (or, with none left, the empty-state action) that should take focus after a delete. */
function neighbourSelector(id: string): string {
  const list = gallery.entries
  const i = list.findIndex((e) => e.id === id)
  const next = list[i + 1] ?? list[i - 1]
  return next ? `[data-entry-id="${next.id}"]` : '[data-testid="gallery-open-image"]'
}

async function confirm() {
  const pending = gallery.pendingDelete
  if (!pending) return
  const selector = neighbourSelector(pending.id)
  await gallery.confirmDelete()
  await nextTick()
  document.querySelector<HTMLElement>(selector)?.focus()
}
</script>

<template>
  <Dialog
    v-if="gallery.pendingDelete"
    :title="m.deleteDialogTitle(gallery.pendingDelete.name)"
    initial-focus="[data-initial-focus]"
    @cancel="gallery.cancelDelete()"
  >
    {{ m.deleteDialogBody() }}
    <template #actions>
      <BaseButton variant="secondary" data-initial-focus @click="gallery.cancelDelete()">
        {{ m.deleteDialogCancel() }}
      </BaseButton>
      <BaseButton variant="primary" @click="confirm()">
        {{ m.deleteDialogConfirm() }}
      </BaseButton>
    </template>
  </Dialog>
</template>
