<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { Check, ChevronDown, Languages } from 'lucide-vue-next'
import { translate, type Language, type Locale } from './i18n'

const props = defineProps<{ value: Language; locale: Locale }>()
const emit = defineEmits<{ change: [language: Language] }>()
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const open = ref(false)
const active = ref(0)
const options = computed(() => [
  { value: 'system' as const, label: translate(props.locale, '跟随系统') },
  { value: 'en' as const, label: 'English' },
  { value: 'zh-CN' as const, label: '简体中文' },
])
const selected = computed(() => options.value.findIndex((option) => option.value === props.value))
const label = computed(() => translate(props.locale, '语言'))

function toggle() {
  active.value = selected.value
  open.value = !open.value
}
function choose(index: number) {
  open.value = false
  emit('change', options.value[index]!.value)
  trigger.value?.focus()
}
function keydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) {
    event.preventDefault()
    event.stopPropagation()
    open.value = false
  } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    if (!open.value) {
      active.value = selected.value
      open.value = true
    } else {
      active.value = (active.value + (event.key === 'ArrowDown' ? 1 : -1) + 3) % 3
    }
  } else if (open.value && ['Home', 'End'].includes(event.key)) {
    event.preventDefault()
    active.value = event.key === 'Home' ? 0 : 2
  } else if (open.value && ['Enter', ' '].includes(event.key)) {
    event.preventDefault()
    choose(active.value)
  } else if (event.key === 'Tab') {
    open.value = false
  }
}
function outside(event: PointerEvent) {
  if (!root.value?.contains(event.target as Node)) open.value = false
}
onMounted(() => document.addEventListener('pointerdown', outside))
onUnmounted(() => document.removeEventListener('pointerdown', outside))
</script>

<template>
  <div ref="root" class="language-control">
    <button
      ref="trigger"
      class="language-trigger"
      role="combobox"
      type="button"
      :aria-label="label"
      :title="label"
      aria-haspopup="listbox"
      aria-controls="language-options"
      :aria-expanded="open"
      :aria-activedescendant="open ? `language-option-${active}` : undefined"
      @click="toggle"
      @keydown="keydown"
    >
      <Languages :size="17" aria-hidden="true" />
      <span class="language-value">{{ options[selected]?.label }}</span>
      <ChevronDown class="language-chevron" :class="{ open }" :size="13" aria-hidden="true" />
    </button>
    <div v-if="open" id="language-options" class="language-menu" role="listbox" :aria-label="label">
      <button
        v-for="(option, index) in options"
        :id="`language-option-${index}`"
        :key="option.value"
        role="option"
        type="button"
        tabindex="-1"
        class="language-option"
        :class="{ selected: value === option.value, active: active === index }"
        :aria-selected="value === option.value"
        @pointermove="active = index"
        @mousedown.prevent
        @click="choose(index)"
      >
        <span>{{ option.label }}</span>
        <Check v-if="value === option.value" :size="14" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>
