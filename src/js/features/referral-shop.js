/**
 * Polygon Gaming - Referral Adoption Marketplace (Private Hidden Preview)
 * Allows players to inspect unreferred players by weekly activity tier and adopt them
 * using POL (Polygon Web3) or PGT Token balance, with volume and VIP tier discounts.
 */

import { supabase, SUPABASE_URL, SUPABASE_KEY, ADMIN_WALLET_ADDRESS } from '../core/config.js';
import { triggerToast, openModal, closeModal } from '../core/ui.js';
import { appState } from '../core/state.js';

// Configuration of the 6 Weekly Activity Levels with 3x reduced pricing
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
    fictivePriceUSD: 8.00,
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
    fictivePriceUSD: 5.00,
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
    fictivePriceUSD: 2.50,
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
    fictivePriceUSD: 1.25,
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
    fictivePriceUSD: 0.60,
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
    fictivePriceUSD: 0.15,
    estWeeklyPgt: 'Reactivation Upside',
    icon: '⚪'
  }
];

// Live state
let availableCensus = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0, 0: 0 };
let cartQuantities = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0, 0: 0 };
let isFetchingCensus = false;
let selectedPaymentMethod = 'pol'; // 'pol' or 'pgt'

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
 * Calculate volume and VIP tier discounts
 * - Purchases >= $20: -10% volume discount
 * - Purchases >= $100: -20% volume discount
 * - VIP Members: +10% additional discount
 */
export function calculateDiscounts(subtotalUSD) {
  const isVip = Boolean(appState && typeof appState.isVipActive === 'function' ? appState.isVipActive() : false);

  let volumePercent = 0;
  if (subtotalUSD >= 100.0) {
    volumePercent = 20;
  } else if (subtotalUSD >= 20.0) {
    volumePercent = 10;
  }

  const vipPercent = isVip ? 10 : 0;
  const totalPercent = Math.min(volumePercent + vipPercent, 30);
  const discountUSD = Math.round((subtotalUSD * (totalPercent / 100.0)) * 100) / 100;
  const finalPriceUSD = Math.max(0, Math.round((subtotalUSD - discountUSD) * 100) / 100);

  // Conversions: 1 POL = $0.40 USD | 1 PGT = $0.002 USD (500 PGT / $1)
  const finalPricePOL = Math.round((finalPriceUSD / 0.40) * 100) / 100;
  const finalPricePGT = Math.round(finalPriceUSD * 500);

  return {
    subtotalUSD,
    volumePercent,
    vipPercent,
    totalPercent,
    discountUSD,
    finalPriceUSD,
    finalPricePOL,
    finalPricePGT,
    isVip
  };
}
window.calculateDiscounts = calculateDiscounts;

/**
 * Fetch unreferred player counts grouped by weekly activity tier
 */
export async function fetchUnreferredCensus(forceRefresh = false) {
  if (isFetchingCensus && !forceRefresh) return;
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

    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0, 0: 0 };
    let fetchedViaRpc = false;

    // 1. Fast server-side aggregation RPC
    try {
      const { data: rpcCounts, error: rpcErr } = await client.rpc('get_unreferred_census');
      if (!rpcErr && rpcCounts && typeof rpcCounts === 'object') {
        counts[0] = parseInt(rpcCounts['0'] || 0, 10);
        counts[1] = parseInt(rpcCounts['1'] || 0, 10);
        counts[2] = parseInt(rpcCounts['2'] || 0, 10);
        counts[3] = parseInt(rpcCounts['3'] || 0, 10);
        counts[4] = parseInt(rpcCounts['4'] || 0, 10);
        counts[5] = parseInt(rpcCounts['5'] || 0, 10);
        fetchedViaRpc = true;
      }
    } catch (e) {
      // Fallback to table scan
    }

    // 2. Fallback to direct table scan if RPC unavailable
    if (!fetchedViaRpc) {
      const { data, error } = await client
        .from('users')
        .select('weekly_active_tier, last_weekly_active_tier, is_banned')
        .or('referred_by_l1.is.null,referred_by_l1.eq.');

      if (error) {
        console.warn('[ReferralShop] Census query notice:', error);
      }

      if (Array.isArray(data)) {
        data.forEach(row => {
          if (row.is_banned) return;
          // Highest (best) tier achieved across the last 2 weeks (current active week vs prior completed week)
          let lvl = Math.max(
            parseInt(row.weekly_active_tier || 0, 10),
            parseInt(row.last_weekly_active_tier || 0, 10)
          );
          lvl = parseInt(lvl, 10);
          if (isNaN(lvl) || lvl < 0) lvl = 0;
          if (lvl > 5) lvl = 5;
          counts[lvl] = (counts[lvl] || 0) + 1;
        });
      }
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
            <span style="font-size: 0.7rem; color: var(--text-dim); text-transform: uppercase;">Adoption Price</span>
            <div style="font-size: 1.25rem; font-weight: 800; color: #fff;">
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
 * Update the sticky order summary sidebar with volume and VIP discounts
 */
export function updateOrderSummary() {
  let totalCount = 0;
  let subtotalUSD = 0.0;
  const breakdownList = [];

  REFERRAL_TIERS.forEach(tier => {
    const qty = cartQuantities[tier.level] || 0;
    if (qty > 0) {
      totalCount += qty;
      const cost = qty * tier.fictivePriceUSD;
      subtotalUSD += cost;
      breakdownList.push({
        badge: tier.badge,
        name: tier.name,
        color: tier.color,
        qty: qty,
        cost: cost.toFixed(2)
      });
    }
  });

  const disc = calculateDiscounts(subtotalUSD);

  // DOM elements
  const elTotalCount = document.getElementById('shop-summary-total-count');
  const elSubtotalPrice = document.getElementById('shop-summary-subtotal-price');
  const elDiscountRow = document.getElementById('shop-summary-discount-row');
  const elDiscountBadge = document.getElementById('shop-summary-discount-badge');
  const elTotalPrice = document.getElementById('shop-summary-total-price');
  const elPricePol = document.getElementById('shop-summary-price-pol');
  const elPricePgt = document.getElementById('shop-summary-price-pgt');
  const elItemsList = document.getElementById('shop-summary-items-list');
  const btnCheckout = document.getElementById('btn-shop-checkout');

  if (elTotalCount) elTotalCount.innerText = `${totalCount} ${totalCount === 1 ? 'Player' : 'Players'}`;
  if (elSubtotalPrice) elSubtotalPrice.innerText = `$${disc.subtotalUSD.toFixed(2)} USD`;
  
  if (elDiscountRow && elDiscountBadge) {
    if (disc.totalPercent > 0) {
      elDiscountRow.style.display = 'flex';
      let tags = [];
      if (disc.volumePercent > 0) tags.push(`-${disc.volumePercent}% Volume`);
      if (disc.vipPercent > 0) tags.push(`-${disc.vipPercent}% 👑 VIP`);
      elDiscountBadge.innerHTML = `<span style="color: #00ff88; font-weight: 800;">${tags.join(' + ')} (-$${disc.discountUSD.toFixed(2)})</span>`;
    } else {
      elDiscountRow.style.display = 'none';
    }
  }

  if (elTotalPrice) elTotalPrice.innerText = `$${disc.finalPriceUSD.toFixed(2)} USD`;
  if (elPricePol) elPricePol.innerText = `≈ ${disc.finalPricePOL.toFixed(2)} POL`;
  if (elPricePgt) elPricePgt.innerText = `≈ ${disc.finalPricePGT.toLocaleString()} PGT`;

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
 * Open the interactive checkout modal with POL & PGT payment selection
 */
export function openReferralCheckoutModal() {
  const totalCount = Object.values(cartQuantities).reduce((a, b) => a + b, 0);
  if (totalCount === 0) {
    triggerToast("Please select at least 1 referral to proceed", "warning");
    return;
  }

  let subtotal = 0.0;
  const listItems = [];
  REFERRAL_TIERS.forEach(tier => {
    const qty = cartQuantities[tier.level] || 0;
    if (qty > 0) {
      const cost = qty * tier.fictivePriceUSD;
      subtotal += cost;
      listItems.push(`<strong>${qty}x ${tier.badge}</strong> ($${cost.toFixed(2)})`);
    }
  });

  const disc = calculateDiscounts(subtotal);

  const elModalCount = document.getElementById('modal-ref-checkout-count');
  const elModalBreakdown = document.getElementById('modal-ref-checkout-breakdown');
  const elModalSubtotal = document.getElementById('modal-ref-checkout-subtotal');
  const elModalDiscount = document.getElementById('modal-ref-checkout-discount');
  const elModalTotal = document.getElementById('modal-ref-checkout-total');
  const elModalPol = document.getElementById('modal-ref-cost-pol');
  const elModalPgt = document.getElementById('modal-ref-cost-pgt');

  if (elModalCount) elModalCount.innerText = `${totalCount} Players`;
  if (elModalBreakdown) elModalBreakdown.innerHTML = listItems.join(', ');
  if (elModalSubtotal) elModalSubtotal.innerText = `$${disc.subtotalUSD.toFixed(2)} USD`;

  if (elModalDiscount) {
    if (disc.totalPercent > 0) {
      elModalDiscount.innerHTML = `<span style="color: #00ff88; font-weight: 800;">-${disc.totalPercent}% (-$${disc.discountUSD.toFixed(2)})</span>`;
    } else {
      elModalDiscount.innerText = '$0.00';
    }
  }

  if (elModalTotal) elModalTotal.innerText = `$${disc.finalPriceUSD.toFixed(2)} USD`;
  if (elModalPol) elModalPol.innerText = `${disc.finalPricePOL.toFixed(2)} POL`;
  if (elModalPgt) elModalPgt.innerText = `${disc.finalPricePGT.toLocaleString()} PGT`;

  selectPaymentMethod(selectedPaymentMethod || 'pol');
  openModal('buy-referrals-checkout');
}
window.openReferralCheckoutModal = openReferralCheckoutModal;

/**
 * Select payment method in the checkout modal (strictly 'pol')
 */
export function selectPaymentMethod(method = 'pol') {
  selectedPaymentMethod = 'pol';

  const cardPol = document.getElementById('pay-method-pol');
  if (cardPol) cardPol.classList.add('selected');

  const btnConfirm = document.getElementById('btn-confirm-ref-purchase');
  if (btnConfirm) {
    let subtotal = 0;
    REFERRAL_TIERS.forEach(t => { subtotal += (cartQuantities[t.level] || 0) * t.fictivePriceUSD; });
    const disc = calculateDiscounts(subtotal);
    btnConfirm.innerHTML = `🟣 Pay <strong>${disc.finalPricePOL.toFixed(2)} POL</strong> (Web3)`;
  }
}
window.selectPaymentMethod = selectPaymentMethod;

/**
 * Execute on-chain POL payment and adopt the selected referrals
 */
export async function executeReferralAdoption() {
  const totalCount = Object.values(cartQuantities).reduce((a, b) => a + b, 0);
  if (totalCount === 0) {
    triggerToast("Please select at least 1 referral to proceed", "warning");
    return;
  }

  let subtotal = 0.0;
  REFERRAL_TIERS.forEach(tier => {
    subtotal += (cartQuantities[tier.level] || 0) * tier.fictivePriceUSD;
  });
  const disc = calculateDiscounts(subtotal);

  const buyerId = (appState?.state?.playerId || appState?.state?.walletAddress || '').toLowerCase();
  if (!buyerId) {
    triggerToast("Please connect your wallet first", "error");
    return;
  }

  const btnConfirm = document.getElementById('btn-confirm-ref-purchase');
  if (btnConfirm) {
    btnConfirm.disabled = true;
    btnConfirm.innerText = "Processing POL Payment...";
  }

  try {
    // --- POL ON-CHAIN PAYMENT (Polygon Web3) ---
    if (!window.ethereum) {
      triggerToast("Please connect MetaMask or a Web3 wallet on Polygon!", "error");
      if (btnConfirm) {
        btnConfirm.disabled = false;
        selectPaymentMethod('pol');
      }
      return;
    }

    triggerToast(`Confirming ${disc.finalPricePOL.toFixed(2)} POL payment in wallet...`, "info");
    const provider = new window.ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

    const receiver = ADMIN_WALLET_ADDRESS || "0x10B9993990c9EF8a212c9557cB02aD94da9a654d";
    const tx = await signer.sendTransaction({
      to: receiver,
      value: window.ethers.parseEther(disc.finalPricePOL.toFixed(4))
    });

    triggerToast("POL payment submitted to Polygon! Awaiting on-chain confirmation...", "info");
    await tx.wait();

    const client = getActiveSupabase();
    const prevTotal = appState.state.referralsCount || 0;
    let adoptedCount = totalCount;
    let updatedL1 = (appState.state.referralsL1 || 0) + adoptedCount;
    let updatedL2 = appState.state.referralsL2 || 0;
    let updatedL3 = appState.state.referralsL3 || 0;
    let updatedL4 = appState.state.referralsL4 || 0;
    let updatedTotal = (appState.state.referralsCount || 0) + adoptedCount;

    if (client) {
      try {
        // Direct RPC guarded by anti-replay and anti-loop validation in PostgreSQL
        const { data, error } = await client.rpc('adopt_referrals', {
          p_buyer_id: buyerId,
          p_l5: cartQuantities[5] || 0,
          p_l4: cartQuantities[4] || 0,
          p_l3: cartQuantities[3] || 0,
          p_l2: cartQuantities[2] || 0,
          p_l1: cartQuantities[1] || 0,
          p_l0: cartQuantities[0] || 0,
          p_payment_method: 'POL',
          p_pgt_cost: 0,
          p_tx_hash: tx.hash,
          p_pol_cost: disc.finalPricePOL
        });

        if (data && data.success) {
          adoptedCount = data.adopted_count || totalCount;
          if (data.referrals_l1 !== undefined) updatedL1 = data.referrals_l1;
          if (data.referrals_l2 !== undefined) updatedL2 = data.referrals_l2;
          if (data.referrals_l3 !== undefined) updatedL3 = data.referrals_l3;
          if (data.referrals_l4 !== undefined) updatedL4 = data.referrals_l4;
          if (data.referrals_count !== undefined) updatedTotal = data.referrals_count;
        } else if (error) {
          console.warn('[ReferralShop] POL RPC notice:', error.message);
        } else if (data && !data.success) {
          console.warn('[ReferralShop] RPC returned non-success:', data.error);
        }
      } catch (rpcErr) {
        console.warn('[ReferralShop] Verification error notice:', rpcErr);
      }
    }

    // Instantly decrement local inventory census to update pool cards in real time
    Object.keys(cartQuantities).forEach(lvlStr => {
      const lvl = parseInt(lvlStr, 10);
      if (availableCensus[lvl] !== undefined) {
        availableCensus[lvl] = Math.max(0, availableCensus[lvl] - (cartQuantities[lvl] || 0));
      }
    });

    appState.update({
      referralsL1: updatedL1,
      referralsL2: updatedL2,
      referralsL3: updatedL3,
      referralsL4: updatedL4,
      referralsCount: updatedTotal
    });

    if (typeof appState.addActivity === 'function') {
      appState.addActivity('You', `adopted ${adoptedCount} referrals with on-chain POL`, `-${disc.finalPricePOL.toFixed(2)} POL`);
    }

    closeModal('buy-referrals-checkout');
    clearReferralShopCart();
    renderReferralShopTiers();
    updateShopHeroStats();

    if (typeof window.confetti === 'function') {
      window.confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
    }

    const inheritedSubRefs = Math.max(0, (updatedTotal - prevTotal) - adoptedCount);
    const subRefMsg = inheritedSubRefs > 0 ? ` (+${inheritedSubRefs} inherited sub-referrals!)` : '';
    triggerToast(`🎉 POL Payment Confirmed! ${adoptedCount} active player${adoptedCount > 1 ? 's' : ''}${subRefMsg} added to your downline network!`, "success");
    
    if (typeof window.loadMyDownlineNetwork === 'function') {
      window.loadMyDownlineNetwork();
    }
    fetchUnreferredCensus(true);
  } catch (err) {
    console.error("[ReferralShop] Adoption error:", err);
    triggerToast("Payment cancelled or failed: " + (err.reason || err.message || err), "error");
  } finally {
    if (btnConfirm) {
      btnConfirm.disabled = false;
      selectPaymentMethod('pol');
    }
  }
}
window.executeReferralAdoption = executeReferralAdoption;

/**
 * Initialize the Referral Shop view when routed
 */
export function initReferralShop() {
  fetchUnreferredCensus();
}
window.initReferralShop = initReferralShop;
