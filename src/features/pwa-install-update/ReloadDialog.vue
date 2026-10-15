<script setup lang="ts">
import { computed } from 'vue'
import { BaseButton, Dialog } from '@/shared'
import { ACTION_RELOAD, reloadDialogCopy } from './messages'
import { usePwaInstallUpdate } from './store'

const store = usePwaInstallUpdate()
const copy = computed(() => reloadDialogCopy(store.confirming?.reopenId != null))
</script>

<template>
  <Dialog
    v-if="store.confirming"
    :title="copy.title"
    initial-focus="[data-action='cancel']"
    @cancel="store.cancelReload()"
  >
    {{ copy.body }}
    <template #actions>
      <BaseButton variant="secondary" data-action="cancel" @click="store.cancelReload()">
        Cancel
      </BaseButton>
      <BaseButton variant="primary" @click="store.confirmReload()">{{ ACTION_RELOAD }}</BaseButton>
    </template>
  </Dialog>
</template>
