<script setup lang="ts">
import { computed } from 'vue'
import { formatPence, formatPercent, formatQuantity, gbp, parsePence, parseNum } from '../lib/format'
import type { Fund } from '../lib/rebalance'

const props = defineProps<{ fund: Fund; canRemove: boolean }>()
defineEmits<{ remove: [] }>()

const worth = computed(() => {
  const q = parseNum(props.fund.quantity), p = parsePence(props.fund.price)
  return q !== null && p !== null ? gbp((q * p) / 100) : ''
})
const id = (s: string) => `${s}-${props.fund.id}`
</script>

<template>
  <div class="row">
    <div><label :for="id('n')">Fund name or ticker</label>
      <input :id="id('n')" v-model="fund.name" type="text" placeholder="e.g. VWRL">
    </div>
    <div><label :for="id('q')">Quantity</label>
      <input :id="id('q')" v-model="fund.quantity" type="text" inputmode="decimal"
        @blur="fund.quantity = formatQuantity(fund.quantity)">
    </div>
    <div><label :for="id('p')">Price (pence)</label>
      <input :id="id('p')" v-model="fund.price" type="text" inputmode="decimal"
        @blur="fund.price = formatPence(fund.price)">
    </div>
    <div class="suf"><label :for="id('t')">Target (%)</label><span>%</span>
      <input :id="id('t')" v-model="fund.target" type="text" inputmode="decimal"
        @blur="fund.target = formatPercent(fund.target)">
    </div>
    <div><button v-if="canRemove" type="button" class="x" :aria-label="`Remove ${fund.name.trim() || 'this fund'}`"
        @click="$emit('remove')">Remove</button></div>
    <div class="val">
      <template v-if="worth">Currently worth {{ worth }}</template>
    </div>
  </div>
</template>
