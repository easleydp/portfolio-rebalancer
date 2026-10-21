import { computed, nextTick, reactive, ref, watch } from "vue";
import { parseNum } from "../lib/format";
import { checkTotal, rebalance, toHoldings } from "../lib/rebalance";
import { clearSaved, defaults, key, load, newFund, save } from "../lib/storage";

export function usePortfolio() {
  const state = reactive(load());
  const savedAt = ref(state.saved);
  watch(
    state,
    () => {
      savedAt.value = save(state);
    },
    { deep: true }
  );

  const parsed = computed(() => toHoldings(state.funds));
  const targetsOk = computed(
    () => Math.abs(parsed.value.targetSum - 100) < 0.005
  );
  const ready = computed(
    () =>
      !parsed.value.incomplete &&
      targetsOk.value &&
      parsed.value.holdings.length >= 2
  );
  const cash = computed(() => Math.max(0, parseNum(state.cash) ?? 0));
  const total = computed(() =>
    parsed.value.holdings.reduce((a, h) => a + h.quantity * h.price, 0)
  );
  const platform = computed(() => {
    const v = parseNum(state.plat);
    return v !== null && v > 0 ? v : null;
  });
  const check = computed(() =>
    ready.value && platform.value !== null && total.value > 0
      ? checkTotal(parsed.value.holdings, cash.value, platform.value)
      : null
  );
  const plan = computed(() => {
    if (!ready.value || !check.value?.ok || total.value <= 0) return null;
    const { rel, cap, whole } = state.settings;
    return rebalance(parsed.value.holdings, cash.value, {
      rel: parseNum(rel) ?? 25,
      cap: parseNum(cap),
      whole,
    });
  });

  const prevFor = (name: string): number | undefined => state.prev?.[key(name)];
  const add = () => {
    if (state.funds.length < 10) state.funds.push(newFund());
  };
  const remove = (i: number) => {
    if (state.funds.length > 2) state.funds.splice(i, 1);
  };
  function reset() {
    Object.assign(state, defaults());
    nextTick(() => {
      clearSaved();
      savedAt.value = "";
    }); // after the watcher has run
  }
  return {
    state,
    savedAt,
    parsed,
    targetsOk,
    ready,
    cash,
    total,
    platform,
    check,
    plan,
    prevFor,
    add,
    remove,
    reset,
  };
}
