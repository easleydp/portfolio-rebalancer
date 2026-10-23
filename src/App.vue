<script setup lang="ts">
import { computed } from 'vue'
import FundRow from './components/FundRow.vue'
import { usePortfolio } from './composables/usePortfolio'
import { formatPounds, gbp, pct } from './lib/format'

const { state, savedAt, parsed, targetsOk, ready, cash, platform, check, plan, prevFor, add, remove, reset } = usePortfolio()

const waiting = computed(() => [
  parsed.value.incomplete && 'Every fund needs a name, quantity, a price and a target.',
  parsed.value.holdings.length < 2 && 'Enter at least two funds.',
  'Targets must add up to exactly 100%.',
].filter(Boolean).join(' '))
const savedOn = computed(() => savedAt.value
  ? new Date(savedAt.value).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '')
const print = () => window.print()
const confirmReset = () => { if (confirm('This will delete everything you have entered. Continue?')) reset() }
</script>

<template>
  <main>
    <h1>Portfolio rebalancer</h1>
    <p class="lead">Fill in what you hold today. The page will tell you whether anything needs buying or selling.</p>

    <section class="noprint" aria-label="How to use this page">
      <details>
        <summary>How to use this page</summary>
        <ol class="how">
          <li><b>Enter your funds.</b> One row for each: its name or ticker, the quantity you hold, its current price in
            pence, and the percentage you want it to make up. The targets must add up to 100%.</li>
          <li><b>Add any spare cash</b> waiting to be invested, if you have some.</li>
          <li><b>Check your numbers.</b> Type in the total value your platform shows for the whole portfolio. If it
            doesn’t roughly match what you entered, the page will say so and try to point out the likely mistake.</li>
          <li><b>Read the result.</b> Each fund gets an acceptable range around its target. If any fund has moved
            outside its range, you’ll see what to buy or sell to get back on track. Otherwise, you’re told nothing needs
            doing. You can adjust how wide the ranges are in Settings.</li>
        </ol>
        <p class="hint"><b>Next time:</b> open this page in the same browser. Your last entries will still be here, so
          just update the quantities and prices.</p>
        <p class="hint"><b>Your privacy:</b> everything is worked out inside your browser. Nothing you type is sent
          anywhere. Your entries are kept only on this device, in this browser, so they won’t appear on other devices,
          and clearing your browser’s site data will erase them.</p>
        <p class="hint">This page does arithmetic only. It doesn’t place trades, and it isn’t financial advice.</p>
      </details>
    </section>

    <section class="noprint" aria-labelledby="h-funds">
      <h2 id="h-funds">1. Your funds</h2>
      <p class="hint">One row per fund. Copy the “Price” column from your investment platform’s dashboard, in pence (for
        example 1,206.00). Everything you type is saved on this computer.</p>
      <FundRow v-for="(f, i) in state.funds" :key="f.id" :fund="f" :can-remove="state.funds.length > 2"
        :prev-pence="prevFor(f.name)" @remove="remove(i)" />
      <div class="bar">
        <button type="button" :disabled="state.funds.length >= 10" @click="add">+ Add a fund</button>
        <div class="total" :class="targetsOk ? 'ok' : 'bad'" aria-live="polite">
          {{ targetsOk ? 'Targets add up to 100% ✓' : `Targets add up to ${pct(parsed.targetSum)} – they need to add up
          to 100%` }}
        </div>
      </div>
    </section>

    <section class="noprint" aria-labelledby="h-cash">
      <h2 id="h-cash">2. Cash to invest <span class="opt">(optional)</span></h2>
      <p class="hint">For example, dividends or interest sitting in your account. Leave blank if there is none.</p>
      <div class="pre cash"><span>£</span>
        <input v-model="state.cash" type="text" inputmode="decimal" placeholder="0.00"
          aria-label="Cash available to invest in pounds"
          @blur="state.cash = formatPounds(state.cash)">
      </div>
    </section>

    <section class="noprint" aria-labelledby="h-chk">
      <h2 id="h-chk">3. Check your numbers</h2>
      <p class="hint">Find the 'Total Value' of your portfolio on your platform’s main screen (funds plus any cash) and
        type it here. We compare it with the figures above to catch slips, such as a price or quantity typed wrongly.
      </p>
      <div class="pre cash"><span>£</span>
        <input v-model="state.plat" type="text" inputmode="decimal" placeholder="0.00"
          aria-label="Total portfolio value shown on your platform, in pounds"
          @blur="state.plat = formatPounds(state.plat)">
      </div>
      <div aria-live="polite">
        <div v-if="check" class="banner" :class="check.ok ? 'fine' : 'bad'">
          {{ check.ok ? 'The numbers match' : 'The numbers don’t match' }}
          <small>Your funds{{ cash > 0 ? ' and cash' : '' }} come to {{ gbp(check.mine) }}<template v-if="check.ok">;
              your platform says {{ gbp(platform!) }}.</template>
            <template v-else>, but your platform says {{ gbp(platform!) }}. {{ check.hint }}</template></small>
        </div>
        <div v-else-if="ready" class="banner note">Waiting for the platform total</div>
      </div>
    </section>

    <section aria-labelledby="h-res" aria-live="polite">
      <h2 id="h-res">4. What to do</h2>
      <div v-if="!ready" class="banner note">Waiting for your details<small>{{ waiting }}</small></div>
      <div v-else-if="!platform" class="banner note">Results are on hold<small>Type your platform’s total value in step
          3 so
          the numbers can be checked.</small></div>
      <div v-else-if="check && !check.ok" class="banner note">Results are on hold<small>They will appear once the
          numbers
          above match.</small></div>
      <template v-else-if="plan">
        <div v-if="plan.needed" class="banner act">Rebalancing is needed<small>At least one fund has moved outside its
            acceptable range.</small></div>
        <template v-else>
          <div class="banner fine">No rebalancing needed<small>Every fund is within its acceptable range.</small></div>
          <div v-if="cash > 0" class="banner note">You have {{ gbp(cash) }} in cash<small>If you want to invest it, the
              fund furthest below target is {{ plan.worst.name }}.</small></div>
        </template>
        <div class="scroll">
          <table>
            <thead>
              <tr>
                <th>Fund</th>
                <th class="n">Worth now</th>
                <th class="n">Now</th>
                <th class="n">Target</th>
                <th class="n">Acceptable range</th>
                <th v-if="plan.needed">What to do</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, i) in plan.rows" :key="i">
                <td>{{ r.name }}<span v-if="r.off" class="flag">{{ r.drift > 0 ? 'Above' : 'Below' }} its acceptable
                    range</span></td>
                <td class="n">{{ gbp(r.value) }}</td>
                <td class="n">{{ pct(r.weight) }}</td>
                <td class="n">{{ pct(r.target) }}</td>
                <td class="n">{{ pct(r.lo) }} – {{ pct(r.hi) }}</td>
                <td v-if="plan.needed">
                  <template v-if="r.qty > 0"><span class="buy">Buy {{ r.qty }} share{{ r.qty === 1 ? '' : 's'
                      }}</span><br>about {{ gbp(r.cost) }}</template>
                  <template v-else-if="r.qty < 0"><span class="sell">Sell {{ -r.qty }} share{{ r.qty === -1 ? '' : 's'
                      }}</span><br>about {{ gbp(-r.cost) }}</template>
                  <span v-else class="hold">Leave as it is</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="foot">Total in funds: {{ gbp(plan.total) }}<template v-if="cash > 0"> plus {{ gbp(cash) }}
            cash</template>.
          <template v-if="plan.needed"> After these trades about {{ gbp(Math.max(0, plan.left)) }} of cash would be left
            over<template v-if="state.settings.whole"> (shares are rounded to whole numbers)</template>.
            <template v-if="plan.left < -0.005"> The sales may not quite cover the purchases, so you may want to buy one
              share fewer.</template>
            These figures don’t include dealing fees, stamp duty or other charges, so allow a little extra cash for
            them.</template>
        </p>
      </template>
      <div v-else class="banner note">Enter quantities and prices to see results.</div>
    </section>

    <section class="noprint">
      <details>
        <summary>Settings <span class="opt">(you probably won’t need to change these)</span></summary>
        <div class="set">
          <div class="suf"><label for="rel">Allowed drift, as a share of each fund’s target</label><span>%</span><input
              id="rel" v-model="state.settings.rel" type="text" inputmode="decimal"></div>
          <div class="suf"><label for="cap">Ceiling in percentage points (optional)</label><span>%</span><input id="cap"
              v-model="state.settings.cap" type="text" inputmode="decimal"></div>
          <div class="chk"><input id="whole" v-model="state.settings.whole" type="checkbox"><label for="whole">Buy and
              sell
              whole shares only</label></div>
        </div>
        <p class="hint">Example with 25 and a ceiling of 5: a fund with a 10% target is acceptable between 7.5% and
          12.5%,
          because a quarter of 10 is 2.5. A fund with a 40% target is acceptable between 35% and 45%: a quarter of 40
          would
          be 10, but the ceiling caps it at 5. Leave the ceiling blank to use only the first setting.</p>
      </details>
    </section>

    <div class="noprint actions">
      <button class="primary" type="button" @click="print">Print this page</button>
      <button type="button" @click="confirmReset">Clear everything</button>
    </div>
    <p v-if="savedOn" class="foot noprint">Saved on this computer: {{ savedOn }}. Next year, open this page and update
      the
      quantities and prices.</p>
    <p class="foot">This page only works out numbers. It does not place trades or give financial advice. Prices are the
      ones
      you type in.</p>
  </main>
</template>
