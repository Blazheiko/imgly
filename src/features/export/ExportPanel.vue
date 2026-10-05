<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  normalizeLongSide,
  normalizeQuality,
  SIZE_PRESETS,
  type ExportFormat,
  type Size,
} from '@/core'
import { useEditorStore } from '@/features/editor'
import {
  BaseButton,
  NumberField,
  Popover,
  SegmentedControl,
  SliderField,
  Spinner,
} from '@/shared/ui'
import { FORMAT_LABELS, lineFileReady } from './messages'
import { useExportStore } from './store'

defineProps<{ anchor: HTMLElement | null }>()

const store = useExportStore()
const editor = useEditorStore()

const qualityField = ref<InstanceType<typeof SliderField>>()
const longSideField = ref<InstanceType<typeof NumberField>>()
const saveButton = ref<InstanceType<typeof BaseButton>>()

const busy = computed(() => store.status !== 'idle')
const exporting = computed(() => store.status === 'exporting')
const fileReady = computed(() => store.status === 'fileReady')

const formatOptions = computed(() =>
  (['png', 'jpeg', 'webp'] as const).map((format) => ({
    value: format,
    label: FORMAT_LABELS[format],
    disabled: busy.value || store.availability[format] !== true,
    hint: format === 'png' ? undefined : store.formatHints[format],
  })),
)

const presetOptions = computed(() =>
  SIZE_PRESETS.map((percent) => ({ value: percent, label: `${percent}%`, disabled: busy.value })),
)

const workSize = computed<Size>(() => {
  const original = editor.work?.original
  return { width: original?.width ?? 1, height: original?.height ?? 1 }
})

const normalizeSide = (raw: string, previous: number) =>
  normalizeLongSide(raw, previous, workSize.value)

function selectFormat(format: ExportFormat) {
  store.selectFormat(format)
}

function selectPreset(percent: number | null) {
  if (percent !== null) store.selectPreset(percent)
}

/** Escape or a click outside: in File ready it ends the export as cancelled (sad.md §1). */
function onClose() {
  if (fileReady.value) store.cancelReady()
  else store.closePanel()
}

let unregister: (() => void) | undefined
onMounted(() => {
  unregister = store.registerFlush(() => {
    qualityField.value?.apply()
    longSideField.value?.apply()
  })
})
onBeforeUnmount(() => unregister?.())

watch(fileReady, async (ready) => {
  if (!ready) return
  await nextTick()
  ;(saveButton.value?.$el as HTMLElement | undefined)?.focus()
})
</script>

<template>
  <Popover
    :open="store.panelOpen"
    :anchor="anchor"
    :locked="exporting"
    label="Export"
    initial-focus='[role="radio"][tabindex="0"]'
    @close="onClose"
  >
    <div class="export-panel">
      <section class="export-panel__section">
        <h3 class="export-panel__heading">Format</h3>
        <SegmentedControl
          :model-value="store.format"
          :options="formatOptions"
          label="Format"
          @update:model-value="selectFormat"
        />
        <p v-if="store.transparencyHint" class="export-panel__hint">{{ store.transparencyHint }}</p>
      </section>

      <section v-if="store.showsQuality" class="export-panel__section">
        <h3 class="export-panel__heading">Quality</h3>
        <SliderField
          ref="qualityField"
          :model-value="store.quality"
          label="Quality"
          :min="1"
          :max="100"
          :normalize="normalizeQuality"
          :disabled="busy"
          @update:model-value="store.setQuality"
        />
      </section>

      <section class="export-panel__section">
        <h3 class="export-panel__heading">Size</h3>
        <SegmentedControl
          :model-value="store.activePreset"
          :options="presetOptions"
          label="Size"
          @update:model-value="selectPreset"
        />
        <NumberField
          ref="longSideField"
          class="export-panel__long-side"
          :model-value="store.longSide"
          label="Long side"
          unit="px"
          :normalize="normalizeSide"
          :disabled="busy"
          @update:model-value="store.setLongSide"
        />
        <p class="export-panel__readout">
          {{ store.dimensions.width }} × {{ store.dimensions.height }} px
        </p>
      </section>

      <section class="export-panel__section">
        <h3 class="export-panel__heading">File name</h3>
        <p class="export-panel__name">{{ store.suggestedName }}</p>
        <p class="export-panel__hint">{{ fileReady ? lineFileReady() : store.pathLine }}</p>
      </section>

      <div class="export-panel__actions">
        <BaseButton
          v-if="fileReady"
          ref="saveButton"
          variant="primary"
          @click="store.saveFromReady()"
        >
          Save…
        </BaseButton>
        <BaseButton v-else variant="primary" :disabled="exporting" @click="store.confirm()">
          <span v-if="exporting" class="export-panel__spinner"><Spinner label="Exporting" /></span>
          {{ exporting ? 'Exporting…' : 'Export' }}
        </BaseButton>
      </div>
    </div>
  </Popover>
</template>

<style scoped>
.export-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.export-panel__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.export-panel__heading {
  margin: 0;
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
}

.export-panel__hint {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

.export-panel__readout {
  margin: 0;
  color: var(--color-text-muted);
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
}

.export-panel__name {
  margin: 0;
  overflow-wrap: anywhere;
  font-size: var(--font-size-sm);
}

.export-panel__actions {
  display: flex;
  justify-content: flex-end;
}

.export-panel__spinner :deep(.spinner__ring) {
  width: var(--space-4);
  height: var(--space-4);
}
</style>
