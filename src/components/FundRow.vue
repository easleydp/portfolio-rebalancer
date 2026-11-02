<script setup lang="ts">
import { computed } from "vue";
import {
  formatPence,
  formatPercent,
  formatQuantity,
  gbp,
  parsePence,
  parsePercent,
  parseQuantity,
} from "../lib/format";
import type { Fund } from "../lib/rebalance";

const props = defineProps<{ fund: Fund; canRemove: boolean }>();
defineEmits<{ remove: [] }>();

const worth = computed(() => {
  const q = parseQuantity(props.fund.quantity),
    p = parsePence(props.fund.price);
  return q !== null && p !== null ? gbp((q * p) / 100) : "";
});
const rowStarted = computed(() =>
  Boolean(props.fund.name || props.fund.quantity || props.fund.price || props.fund.target),
);
const nameInvalid = computed(
  () =>
    Boolean(props.fund.quantity || props.fund.price || props.fund.target) &&
    !props.fund.name.trim(),
);
const quantityInvalid = computed(
  () => rowStarted.value && parseQuantity(props.fund.quantity) === null,
);
const priceInvalid = computed(() => rowStarted.value && parsePence(props.fund.price) === null);
const targetInvalid = computed(() => rowStarted.value && parsePercent(props.fund.target) === null);
const id = (s: string) => `${s}-${props.fund.id}`;
</script>

<template>
  <div class="row">
    <div>
      <label :for="id('n')">Fund name or ticker</label>
      <input
        :id="id('n')"
        v-model="fund.name"
        type="text"
        placeholder="e.g. VWRL"
        :aria-invalid="nameInvalid"
      />
    </div>
    <div>
      <label :for="id('q')">Quantity</label>
      <input
        :id="id('q')"
        v-model="fund.quantity"
        type="text"
        inputmode="numeric"
        :aria-invalid="quantityInvalid"
        @blur="fund.quantity = formatQuantity(fund.quantity)"
      />
    </div>
    <div>
      <label :for="id('p')">Price (pence)</label>
      <input
        :id="id('p')"
        v-model="fund.price"
        type="text"
        inputmode="decimal"
        :aria-invalid="priceInvalid"
        @blur="fund.price = formatPence(fund.price)"
      />
    </div>
    <div class="suf">
      <label :for="id('t')">Target (%)</label><span>%</span>
      <input
        :id="id('t')"
        v-model="fund.target"
        type="text"
        inputmode="decimal"
        :aria-invalid="targetInvalid"
        @blur="fund.target = formatPercent(fund.target)"
      />
    </div>
    <div>
      <button
        v-if="canRemove"
        type="button"
        class="x"
        :aria-label="`Remove ${fund.name.trim() || 'this fund'}`"
        @click="$emit('remove')"
      >
        Remove
      </button>
    </div>
    <div class="val">
      <template v-if="worth">Currently worth {{ worth }}</template>
    </div>
  </div>
</template>
