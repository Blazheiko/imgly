<script setup lang="ts">
import { computed } from 'vue'
import { BaseButton, Dialog } from '@/shared'
import { ACTION_RELOAD, reloadDialogCopy } from './messages'
import { UPDATE_SLOT, usePwaInstallUpdate } from './store'

const store = usePwaInstallUpdate()
// Focus goes back to "Reload" even when the toast re-rendered it, or another button took focus
// while Reload waited for a save before the confirmation opened.
const reloadAction = `.toast[data-slot="${UPDATE_SLOT}"] .base-button`
const copy = computed(() => reloadDialogCopy(store.confirming?.reopenId != null))
</script>

<template>
  <Dialog
    v-if="store.confirming"
    :title="copy.title"
    initial-focus="[data-action='cancel']"
    :return-focus="reloadAction"
    prefer-return-focus
    @cancel="store.cancelReload()"
  >
    {{ copy.body }}
    <template #actions>
      <BaseButton variant="secondary" icon="x" data-action="cancel" @click="store.cancelReload()">
        Cancel
      </BaseButton>
      <BaseButton variant="primary" icon="refresh-cw" @click="store.confirmReload()">{{
        ACTION_RELOAD
      }}</BaseButton>
    </template>
  </Dialog>
</template>
