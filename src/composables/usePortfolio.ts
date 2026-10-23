import { computed, nextTick, reactive, ref, watch } from "vue";
import { parseNum } from "../lib/format";
import { checkTotal, rebalance, toHoldings } from "../lib/rebalance";
import { clearSaved, defaults, load, newFund, save } from "../lib/storage";

const DEBOUNCE_MS = 500;

export function usePortfolio() {
  const state = reactive(load());
  const savedAt = ref(state.saved);
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let isResetting = false;

  const flushSave = () => {
    if (saveTimer !== undefined) {
      clearTimeout(saveTimer);
      saveTimer = undefined;
      savedAt.value = save(state);
    }
  };

  watch(
    state,
    () => {
      if (isResetting) return;
      if (saveTimer !== undefined) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        saveTimer = undefined;
        savedAt.value = save(state);
      }, DEBOUNCE_MS);
    },
    { deep: true }
  );

  if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", flushSave);
    window.addEventListener("pagehide", flushSave);
    window.addEventListener("beforeprint", flushSave);
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") flushSave();
      });
    }
  }

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

  const add = () => {
    if (state.funds.length < 10) state.funds.push(newFund());
  };
  const remove = (i: number) => {
    if (state.funds.length > 2) state.funds.splice(i, 1);
  };
  function reset() {
    if (saveTimer !== undefined) {
      clearTimeout(saveTimer);
      saveTimer = undefined;
    }
    isResetting = true;
    Object.assign(state, defaults());
    clearSaved();
    savedAt.value = "";
    nextTick(() => {
      isResetting = false;
    });
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
    add,
    remove,
    reset,
    flushSave,
  };
}
