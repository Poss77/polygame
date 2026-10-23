/**
 * Polygon Gaming - Referral Adoption Marketplace (Private Preview)
 * Allows players to inspect unreferred players by weekly activity tier and calculate adoption costs.
 */

import { supabase, SUPABASE_URL, SUPABASE_KEY } from '../core/config.js';
import { triggerToast, openModal, closeModal } from '../core/ui.js';
import { appState } from '../core/state.js';

// Configuration of the 6 Weekly Activity Levels
export const REFERRAL_TIERS = [
  {
    level: 5,
    name: 'Apex Legend',
    badge: '👑 L5 Apex',
    color: '#ffd700',
    border: 'rgba(255, 215, 0, 0.4)',
    bg: 'linear-gradient(135deg, rgba(255, 215, 0, 0.08), rgba(255, 215, 0, 0.02))',
    reqText: '6+ Faucets • 50+ Games / week',
    desc: 'Ultra-active downline player with peak daily faucet and arcade engagement. Maximum commission yield.',
    fictivePriceUSD: 25.00,
    estWeeklyPgt: '150 - 400 PGT/wk',
    icon: '👑'
  },
  {
    level: 4,
    name: 'Elite Champion',
    badge: '💎 L4 Elite',
    color: '#00ff88',
    border: 'rgba(0, 255, 136, 0.4)',
    bg: 'linear-gradient(135deg, rgba(0, 255, 136, 0.08), rgba(0, 255, 136, 0.02))',
    reqText: '5+ Faucets • 25+ Games / week',
    desc: 'High-frequency weekly player. Consistent daily earner across arcade leaderboards and faucet claims.',
    fictivePriceUSD: 15.00,
    estWeeklyPgt: '80 - 200 PGT/wk',
    icon: '💎'
  },
  {
    level: 3,
    name: 'Veteran',
    badge: '🥇 L3 Veteran',
    color: '#ffaa00',
    border: 'rgba(255, 170, 0, 0.4)',
    bg: 'linear-gradient(135deg, rgba(255, 170, 0, 0.08), rgba(255, 170, 0, 0.02))',
    reqText: '3+ Faucets • 5+ Games / week',
    desc: 'Steady weekly participant with recurring claims and regular arcade sessions.',
    fictivePriceUSD: 8.00,
    estWeeklyPgt: '40 - 100 PGT/wk',
    icon: '🥇'
  },
  {
    level: 2,
    name: 'Contender',
    badge: '🥈 L2 Contender',
    color: '#c084fc',
    border: 'rgba(192, 132, 252, 0.4)',
    bg: 'linear-gradient(135deg, rgba(192, 132, 252, 0.08), rgba(192, 132, 252, 0.02))',
    reqText: '2+ Faucets • 1+ Game / week',
    desc: 'Casual active player checking in multiple times per week.',
    fictivePriceUSD: 4.00,
    estWeeklyPgt: '20 - 50 PGT/wk',
    icon: '🥈'
  },
  {
    level: 1,
    name: 'Scout',
    badge: '🥉 L1 Scout',
    color: '#38bdf8',
    border: 'rgba(56, 189, 248, 0.4)',
    bg: 'linear-gradient(135deg, rgba(56, 189, 248, 0.08), rgba(56, 189, 248, 0.02))',
    reqText: '1+ Faucet / week',
    desc: 'Entry active player claiming weekly faucet drops with steady growth potential.',
    fictivePriceUSD: 2.00,
    estWeeklyPgt: '10 - 25 PGT/wk',
    icon: '🥉'
  },
  {
    level: 0,
    name: 'Dormant',
    badge: '⚪ L0 Dormant',
    color: '#94a3b8',
    border: 'rgba(148, 163, 184, 0.25)',
    bg: 'linear-gradient(135deg, rgba(148, 163, 184, 0.05), rgba(148, 163, 184, 0.01))',
    reqText: 'Registered • 0 claims this week',
    desc: 'Registered unreferred player currently idle. Budget adoption cost with reactivation upside.',
    fictivePriceUSD: 0.50,
    estWeeklyPgt: 'Reactivation Upside',
    icon: '⚪'
  }
];

// Live state
let availableCensus = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0, 0: 0 };
let cartQuantities = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0, 0: 0 };
let isFetchingCensus = false;
let selectedPaymentMethod = 'pol'; // 'pol', 'pgt', 'card', 'usdt'

/**
 * Safely resolves the active Supabase client instance
 */
function getActiveSupabase() {
  if (supabase && typeof supabase.from === 'function') return supabase;
  if (typeof window !== 'undefined') {
    if (window.supabaseClient && typeof window.supabaseClient.from === 'function') return window.supabaseClient;
    if (window.supabase && typeof window.supabase.from === 'function') return window.supabase;
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      try {
        window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        return window.supabaseClient;
      } catch (e) {}
    }
  }
  return null;
}

/**
 * Fetch unreferred player counts grouped by weekly activity tier
 */
export async function fetchUnreferredCensus(forceRefresh = false) {
  if (isFetchingCensus) return;
  isFetchingCensus = true;

  const btnRefresh = document.getElementById('btn-refresh-referral-shop');
  if (btnRefresh) {
    btnRefresh.classList.add('loading-spin');
    btnRefresh.disabled = true;
  }

  try {
    const client = getActiveSupabase();
    if (!client) {
      console.warn('[ReferralShop] Supabase client not ready yet, retrying...');
      setTimeout(() => fetchUnreferredCensus(forceRefresh), 400);
      return;
    }

    const { data, error } = await client
      .from('users')
      .select('weekly_active_tier, last_weekly_active_tier, is_banned')
      .or('referred_by_l1.is.null,referred_by_l1.eq.');

    if (error) {
      console.warn('[ReferralShop] Census query notice:', error);
    }

    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0, 0: 0 };
    if (Array.isArray(data)) {
      data.forEach(row => {
        if (row.is_banned) return;
        let lvl = row.last_weekly_active_tier;
        if (lvl === null || lvl === undefined) {
          lvl = row.weekly_active_tier || 0;
        }
        lvl = parseInt(lvl, 10);
        if (isNaN(lvl) || lvl < 0) lvl = 0;
        if (lvl > 5) lvl = 5;
        counts[lvl] = (counts[lvl] || 0) + 1;
      });
    }

    availableCensus = counts;
    renderReferralShopTiers();
    updateOrderSummary();
    updateShopHeroStats();
  } catch (err) {
    console.error('[ReferralShop] Error loading census:', err);
  } finally {
    isFetchingCensus = false;
    if (btnRefresh) {
      btnRefresh.classList.remove('loading-spin');
      btnRefresh.disabled = false;
    }
  }
}
window.fetchUnreferredCensus = fetchUnreferredCensus;

/**
 * Update top hero statistics
 */
function updateShopHeroStats() {
  const totalAvailable = Object.values(availableCensus).reduce((a, b) => a + b, 0);
  const activeAvailable = (availableCensus[1] || 0) + (availableCensus[2] || 0) + (availableCensus[3] || 0) + (availableCensus[4] || 0) + (availableCensus[5] || 0);
  const dormantAvailable = availableCensus[0] || 0;
  const myL1 = appState?.state?.referralsL1 || 0;

  const elTotal = document.getElementById('shop-stat-total-available');
  const elActive = document.getElementById('shop-stat-active-available');
  const elDormant = document.getElementById('shop-stat-dormant-available');
  const elMyL1 = document.getElementById('shop-stat-my-l1');

  if (elTotal) elTotal.innerText = totalAvailable.toLocaleString();
  if (elActive) elActive.innerText = activeAvailable.toLocaleString();
  if (elDormant) elDormant.innerText = dormantAvailable.toLocaleString();
  if (elMyL1) elMyL1.innerText = myL1.toLocaleString();
}

/**
 * Render the tier listing cards
 */
export function renderReferralShopTiers() {
  const container = document.getElementById('referral-shop-tiers-container');
  if (!container) return;

  let html = '';

  REFERRAL_TIERS.forEach(tier => {
    const lvl = tier.level;
    const available = availableCensus[lvl] || 0;
    const inCart = cartQuantities[lvl] || 0;
    const subtotal = (inCart * tier.fictivePriceUSD).toFixed(2);
    const isOutOfStock = available <= 0;

    html += `
      <div class="ref-shop-card ${isOutOfStock ? 'is-out-of-stock' : ''}" style="border: 1px solid ${tier.border}; background: ${tier.bg};">
        <!-- Card Header -->
        <div class="ref-shop-card-head">
          <div style="display: flex; align-items: center; gap: 0.6rem;">
            <span class="ref-shop-tier-badge" style="background: rgba(255,255,255,0.06); color: ${tier.color}; border: 1px solid ${tier.color};">
              ${tier.badge}
            </span>
            <strong style="color: #fff; font-size: 1.05rem;">${tier.name}</strong>
          </div>
          <div class="ref-shop-stock-badge ${isOutOfStock ? 'stock-empty' : 'stock-available'}">
            ${isOutOfStock ? '⚠️ 0 Available' : `🟢 ${available} In Pool`}
          </div>
        </div>

        <!-- Tier Info & Requirements -->
        <div class="ref-shop-meta-row">
          <div class="ref-shop-req-pill">
            <span style="color: var(--text-dim); font-size: 0.72rem;">CRITERIA:</span>
            <strong style="font-size: 0.78rem; color: #fff;">${tier.reqText}</strong>
          </div>
          <div class="ref-shop-yield-pill" style="color: ${tier.color};">
            <span style="font-size: 0.72rem; color: var(--text-dim);">EST. COMMISSION:</span>
            <strong style="font-size: 0.78rem;">${tier.estWeeklyPgt}</strong>
          </div>
        </div>

        <p class="ref-shop-desc">${tier.desc}</p>

        <!-- Pricing & Quantity Controls -->
        <div class="ref-shop-bottom-row">
          <div class="ref-shop-price-box">
            <span style="font-size: 0.7rem; color: var(--text-dim); text-transform: uppercase;">Fictive Price</span>
            <div style="font-size: 1.2rem; font-weight: 800; color: #fff;">
              $${tier.fictivePriceUSD.toFixed(2)}
              <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 400;">/ player</span>
            </div>
          </div>

          <div class="ref-shop-stepper-box">
            <button class="ref-shop-btn-step" onclick="window.stepReferralShopCart(${lvl}, -1)" ${inCart <= 0 ? 'disabled' : ''}>-</button>
            <input type="number" 
                   id="ref-shop-input-${lvl}" 
                   class="ref-shop-input-qty" 
                   value="${inCart}" 
                   min="0" 
                   max="${available}" 
                   ${isOutOfStock ? 'disabled' : ''}
                   onchange="window.setReferralShopQtyDirect(${lvl}, this.value)">
            <button class="ref-shop-btn-step" onclick="window.stepReferralShopCart(${lvl}, 1)" ${isOutOfStock || inCart >= available ? 'disabled' : ''}>+</button>
            <button class="ref-shop-btn-max" onclick="window.maxReferralShopCart(${lvl})" ${isOutOfStock || inCart >= available ? 'disabled' : ''}>Max</button>
          </div>
        </div>

        ${inCart > 0 ? `
          <div class="ref-shop-subtotal-bar">
            <span>Selected: <strong>${inCart} × $${tier.fictivePriceUSD.toFixed(2)}</strong></span>
            <span style="color: var(--color-primary); font-weight: 800;">$${subtotal} USD</span>
          </div>
        ` : ''}
      </div>
    `;
  });

  container.innerHTML = html;
}
window.renderReferralShopTiers = renderReferralShopTiers;

/**
 * Increment or decrement cart quantity for a tier
 */
export function stepReferralShopCart(level, delta) {
  const available = availableCensus[level] || 0;
  const current = cartQuantities[level] || 0;
  let next = current + delta;
  if (next < 0) next = 0;
  if (next > available) next = available;

  cartQuantities[level] = next;
  renderReferralShopTiers();
  updateOrderSummary();
}
window.stepReferralShopCart = stepReferralShopCart;

/**
 * Set max available for a tier
 */
export function maxReferralShopCart(level) {
  const available = availableCensus[level] || 0;
  cartQuantities[level] = available;
  renderReferralShopTiers();
  updateOrderSummary();
}
window.maxReferralShopCart = maxReferralShopCart;

/**
 * Handle direct number input
 */
export function setReferralShopQtyDirect(level, val) {
  const available = availableCensus[level] || 0;
  let parsed = parseInt(val, 10);
  if (isNaN(parsed) || parsed < 0) parsed = 0;
  if (parsed > available) parsed = available;

  cartQuantities[level] = parsed;
  renderReferralShopTiers();
  updateOrderSummary();
}
window.setReferralShopQtyDirect = setReferralShopQtyDirect;

/**
 * Clear all cart selections
 */
export function clearReferralShopCart() {
  cartQuantities = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0, 0: 0 };
  renderReferralShopTiers();
  updateOrderSummary();
  triggerToast("Referral selections cleared", "info");
}
window.clearReferralShopCart = clearReferralShopCart;

/**
 * Update the sticky order summary sidebar
 */
export function updateOrderSummary() {
  let totalCount = 0;
  let totalPriceUSD = 0.0;
  const breakdownList = [];

  REFERRAL_TIERS.forEach(tier => {
    const qty = cartQuantities[tier.level] || 0;
    if (qty > 0) {
      totalCount += qty;
      const cost = qty * tier.fictivePriceUSD;
      totalPriceUSD += cost;
      breakdownList.push({
        badge: tier.badge,
        name: tier.name,
        color: tier.color,
        qty: qty,
        cost: cost.toFixed(2)
      });
    }
  });

  // DOM elements
  const elTotalCount = document.getElementById('shop-summary-total-count');
  const elTotalPrice = document.getElementById('shop-summary-total-price');
  const elPricePol = document.getElementById('shop-summary-price-pol');
  const elPricePgt = document.getElementById('shop-summary-price-pgt');
  const elItemsList = document.getElementById('shop-summary-items-list');
  const btnCheckout = document.getElementById('btn-shop-checkout');

  if (elTotalCount) elTotalCount.innerText = `${totalCount} ${totalCount === 1 ? 'Player' : 'Players'}`;
  if (elTotalPrice) elTotalPrice.innerText = `$${totalPriceUSD.toFixed(2)} USD`;
  
  // Fictional conversions (~1 POL = $0.40, ~1 PGT = $0.002)
  if (elPricePol) elPricePol.innerText = `≈ ${(totalPriceUSD / 0.40).toFixed(2)} POL`;
  if (elPricePgt) elPricePgt.innerText = `≈ ${(totalPriceUSD / 0.002).toLocaleString()} PGT`;

  if (elItemsList) {
    if (breakdownList.length === 0) {
      elItemsList.innerHTML = `
        <div style="text-align: center; padding: 1.5rem 0.5rem; color: var(--text-dim); font-size: 0.85rem;">
          🛒 No referrals selected yet.<br>
          <span style="font-size: 0.75rem; color: var(--text-muted);">Use the +/- steppers on the left to select active players.</span>
        </div>
      `;
    } else {
      let bHtml = '';
      breakdownList.forEach(item => {
        bHtml += `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.4rem 0.6rem; background: rgba(255,255,255,0.02); border-radius: 6px; margin-bottom: 0.35rem; border: 1px solid rgba(255,255,255,0.05);">
            <div style="display: flex; align-items: center; gap: 0.4rem;">
              <span style="font-size: 0.7rem; font-weight: 800; color: ${item.color};">${item.badge}</span>
              <span style="font-size: 0.8rem; color: #fff;">${item.name}</span>
            </div>
            <div style="text-align: right;">
              <strong style="color: #fff; font-size: 0.85rem;">${item.qty}x</strong>
              <span style="font-size: 0.75rem; color: var(--color-primary); margin-left: 0.4rem;">$${item.cost}</span>
            </div>
          </div>
        `;
      });
      elItemsList.innerHTML = bHtml;
    }
  }

  if (btnCheckout) {
    btnCheckout.disabled = (totalCount === 0);
  }
}
window.updateOrderSummary = updateOrderSummary;

/**
 * Open the interactive checkout simulation modal
 */
export function openReferralCheckoutModal() {
  const totalCount = Object.values(cartQuantities).reduce((a, b) => a + b, 0);
  if (totalCount === 0) {
    triggerToast("Please select at least 1 referral to proceed", "warning");
    return;
  }

  let totalPriceUSD = 0.0;
  const listItems = [];
  REFERRAL_TIERS.forEach(tier => {
    const qty = cartQuantities[tier.level] || 0;
    if (qty > 0) {
      const cost = qty * tier.fictivePriceUSD;
      totalPriceUSD += cost;
      listItems.push(`<strong>${qty}x ${tier.badge}</strong> ($${cost.toFixed(2)})`);
    }
  });

  const elModalCount = document.getElementById('modal-ref-checkout-count');
  const elModalTotal = document.getElementById('modal-ref-checkout-total');
  const elModalBreakdown = document.getElementById('modal-ref-checkout-breakdown');

  if (elModalCount) elModalCount.innerText = `${totalCount} Players`;
  if (elModalTotal) elModalTotal.innerText = `$${totalPriceUSD.toFixed(2)} USD`;
  if (elModalBreakdown) elModalBreakdown.innerHTML = listItems.join(', ');

  openModal('buy-referrals-checkout');
}
window.openReferralCheckoutModal = openReferralCheckoutModal;

/**
 * Select payment method in the checkout modal
 */
export function selectPaymentMethod(method) {
  selectedPaymentMethod = method;
  document.querySelectorAll('.ref-payment-card').forEach(card => {
    card.classList.remove('selected');
  });
  const el = document.getElementById(`pay-method-${method}`);
  if (el) el.classList.add('selected');
}
window.selectPaymentMethod = selectPaymentMethod;

/**
 * Simulate the checkout process
 */
export function simulateReferralPurchase() {
  const totalCount = Object.values(cartQuantities).reduce((a, b) => a + b, 0);
  closeModal('buy-referrals-checkout');

  if (typeof window.confetti === 'function') {
    window.confetti({ particleCount: 70, spread: 60, origin: { y: 0.7 } });
  }

  triggerToast(`🎉 [Simulation] ${totalCount} active referrals would be assigned to your downline! Payment integration coming soon.`, "success");
}
window.simulateReferralPurchase = simulateReferralPurchase;

/**
 * Initialize the Referral Shop view when routed
 */
export function initReferralShop() {
  fetchUnreferredCensus();
}
window.initReferralShop = initReferralShop;
