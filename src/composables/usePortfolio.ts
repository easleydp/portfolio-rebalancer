/** Manages reactive portfolio state, persistence and derived rebalancing results. */
import { computed, nextTick, reactive, ref, watch } from "vue";
import { parsePercent, parsePounds } from "../lib/format";
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
    { deep: true },
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
  const targetsOk = computed(() => Math.abs(parsed.value.targetSum - 100) < 0.005);
  const ready = computed(
    () => !parsed.value.incomplete && targetsOk.value && parsed.value.holdings.length >= 2,
  );
  const cashInvalid = computed(() => state.cash.trim() !== "" && parsePounds(state.cash) === null);
  const cash = computed(() => Math.max(0, parsePounds(state.cash) ?? 0));
  const total = computed(() => parsed.value.holdings.reduce((a, h) => a + h.quantity * h.price, 0));
  const platformInvalid = computed(
    () => state.plat.trim() !== "" && parsePounds(state.plat) === null,
  );
  const platform = computed(() => {
    const v = parsePounds(state.plat);
    return v !== null && v > 0 ? v : null;
  });
  const relInvalid = computed(() => parsePercent(state.settings.rel) === null);
  const capInvalid = computed(
    () => state.settings.cap.trim() !== "" && parsePercent(state.settings.cap) === null,
  );
  const settingsInvalid = computed(() => relInvalid.value || capInvalid.value);
  const check = computed(() =>
    ready.value && !cashInvalid.value && platform.value !== null && total.value > 0
      ? checkTotal(parsed.value.holdings, cash.value, platform.value)
      : null,
  );
  const plan = computed(() => {
    if (
      !ready.value ||
      cashInvalid.value ||
      settingsInvalid.value ||
      !check.value?.ok ||
      total.value <= 0
    )
      return null;
    const { rel, cap } = state.settings;
    return rebalance(parsed.value.holdings, cash.value, {
      rel: parsePercent(rel) ?? 25,
      cap: parsePercent(cap),
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
    cashInvalid,
    total,
    platform,
    platformInvalid,
    relInvalid,
    capInvalid,
    settingsInvalid,
    check,
    plan,
    add,
    remove,
    reset,
    flushSave,
  };
}
