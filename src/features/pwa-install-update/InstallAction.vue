<script setup lang="ts">
import { BaseButton } from '@/shared'
import { INSTALL_LABEL, INSTALL_TITLE } from './messages'
import { usePwaInstallUpdate } from './store'

const store = usePwaInstallUpdate()
</script>

<template>
  <BaseButton
    v-if="store.canInstall"
    variant="ghost"
    :title="INSTALL_TITLE"
    @click="store.install()"
  >
    {{ INSTALL_LABEL }}
  </BaseButton>
</template>
