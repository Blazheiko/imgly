<script setup lang="ts">
import { BaseButton, Dialog } from '@/shared'
import { useEditorStore } from '../store'

const editor = useEditorStore()
</script>

<template>
  <Dialog
    title="Replace the current image?"
    initial-focus="[data-action='cancel']"
    @cancel="editor.cancelReplace()"
  >
    Your edits to the current image will be lost.
    <template #actions>
      <BaseButton variant="secondary" data-action="cancel" @click="editor.cancelReplace()">
        Cancel
      </BaseButton>
      <BaseButton variant="primary" @click="editor.confirmReplace()">Replace</BaseButton>
    </template>
  </Dialog>
</template>
