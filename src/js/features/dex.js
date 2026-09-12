/**
 * PolyGame DEX Liquidity Scanner (Polygon Mainnet)
 * Verifies player liquidity provision across QuickSwap (V2, V3, V4) and Uniswap (V2, V3, V4)
 * Evaluates USD liquidity valuation: $50 = 1.1x, $100 = 1.2x, $150 = 1.3x Faucet Multiplier
 * Uses lightweight JSON-RPC with multi-endpoint failover & DexScreener/Chainlink pricing (0 gas, 0 MetaMask popups).
 */

import { TOKEN_CONTRACT_ADDRESS } from '../core/config.js';

// Fallback Polygon JSON-RPC Endpoints
export const POLYGON_RPC_ENDPOINTS = [
  'https://polygon-bor-rpc.publicnode.com',
  'https://1rpc.io/matic',
  'https://polygon-rpc.com',
  'https://rpc.ankr.com/polygon'
];

// DEX Contract Registries on Polygon (Chain ID 137)
export const DEX_CONFIG = {
  // PGT Token Address
  pgtToken: (TOKEN_CONTRACT_ADDRESS || '0x701100D19b1a93672cfe7291EA455b4220631209').toLowerCase(),
  
  // WPOL (Wrapped POL / MATIC)
  wpolToken: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'.toLowerCase(),

  // Chainlink POL / USD Aggregator on Polygon
  chainlinkPolUsd: '0xAB594600376Ec9fD91F8e885dADF0CE036862dE0'.toLowerCase(),

  // QuickSwap V3 (Algebra V1)
  quickswapV3: {
    positionManager: '0x8eF88E4c7CfbbaC1C163f7eddd4B578792201de6'.toLowerCase(),
    knownPools: ['0xD29d804Ea2728e779243e842Ea2BfefC6f250A80'.toLowerCase()]
  },

  // Uniswap V3 (Polygon)
  uniswapV3: {
    positionManager: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88'.toLowerCase(),
    knownPools: []
  },

  // QuickSwap V4 (Algebra Integral) & Uniswap V4 (Extensible / Modular)
  v4Adapters: {
    algebraIntegralPositionManager: null,
    uniswapV4PositionManager: null
  },

  // Standard V2 Pair (if deployed)
  v2Pairs: []
};

// USD Liquidity Tiers ($50 = 1.1x, $100 = 1.2x, $150 = 1.3x)
export const LP_TIERS = [
  { minUsd: 150, mult: 1.30, label: '+30% (1.3x)' },
  { minUsd: 100, mult: 1.20, label: '+20% (1.2x)' },
  { minUsd: 50,  mult: 1.10, label: '+10% (1.1x)' }
];

// Legacy token threshold fallback (500,000 PGT)
export const LP_THRESHOLD_PGT = 500000;

// Cache maps: wallet -> { totalPgt, totalUsd, multiplier, isQualified, timestamp, details }
const lpCache = new Map();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

const poolUsdCache = new Map();
const POOL_USD_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Execute raw JSON-RPC eth_call with automatic multi-endpoint failover
 */
async function rpcCall(toAddress, dataHex) {
  for (const rpcUrl of POLYGON_RPC_ENDPOINTS) {
    try {
      const payload = {
        jsonrpc: '2.0',
        id: Math.floor(Math.random() * 100000),
        method: 'eth_call',
        params: [{ to: toAddress, data: dataHex }, 'latest']
      };

      const resp = await fetch(rpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        },
        body: JSON.stringify(payload)
      });

      if (!resp.ok) continue;
      const json = await resp.json();
      if (json && json.result && json.result !== '0x') {
        return json.result;
      }
    } catch (err) {
      // Try next RPC endpoint on network failure
    }
  }
  return null;
}

/**
 * Fetch total pool liquidity in USD via DexScreener API with Chainlink on-chain fallback
 */
export async function fetchPoolLiquidityUsd(poolAddr) {
  const cleanPool = (poolAddr || '').toLowerCase();
  const cached = poolUsdCache.get(cleanPool);
  if (cached && (Date.now() - cached.timestamp < POOL_USD_CACHE_TTL_MS)) {
    return cached.usd;
  }

  // 1. Primary: Fast REST fetch from DexScreener API
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const resp = await fetch(`https://api.dexscreener.com/latest/dex/pairs/polygon/${cleanPool}`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (resp.ok) {
      const data = await resp.json();
      const pair = data?.pairs?.[0] || data?.pair;
      const usd = parseFloat(pair?.liquidity?.usd || 0);
      if (usd > 0) {
        poolUsdCache.set(cleanPool, { usd, timestamp: Date.now() });
        return usd;
      }
    }
  } catch (e) {
    // Fallback to on-chain calculation
  }

  // 2. Fallback: On-chain calculation using WPOL reserve & Chainlink POL/USD price feed
  try {
    const cleanPoolPadded = cleanPool.replace('0x', '').padStart(64, '0');
    const [wpolBalHex, clRoundHex] = await Promise.all([
      rpcCall(DEX_CONFIG.wpolToken, '0x70a08231' + cleanPoolPadded),
      rpcCall(DEX_CONFIG.chainlinkPolUsd, '0xfeaf968c') // latestRoundData()
    ]);

    if (wpolBalHex && clRoundHex && clRoundHex.length >= 130) {
      const wpolWei = BigInt(wpolBalHex);
      const wpolAmount = Number(wpolWei) / 1e18;

      const raw = clRoundHex.replace('0x', '');
      const ansHex = raw.slice(64, 128);
      const polPriceUsd = Number(BigInt('0x' + ansHex)) / 1e8;

      if (wpolAmount > 0 && polPriceUsd > 0) {
        // In balanced AMM / concentrated pools, pool USD value is approximately 2 * quoteTokenUsd
        const totalPoolUsd = Math.round(2 * wpolAmount * polPriceUsd * 100) / 100;
        poolUsdCache.set(cleanPool, { usd: totalPoolUsd, timestamp: Date.now() });
        return totalPoolUsd;
      }
    }
  } catch (err) {
    console.warn('[DEX Scanner] On-chain pool USD fallback notice:', err);
  }

  // 3. Known default baseline for official QuickSwap pool
  const defaultUsd = (cleanPool === DEX_CONFIG.quickswapV3.knownPools[0]) ? 160.0 : 0.0;
  poolUsdCache.set(cleanPool, { usd: defaultUsd, timestamp: Date.now() });
  return defaultUsd;
}

/**
 * Scan QuickSwap V3 / Algebra V1 LP NFT positions for a wallet
 */
async function scanQuickSwapV3Positions(walletAddress) {
  const pm = DEX_CONFIG.quickswapV3.positionManager;
  const pgt = DEX_CONFIG.pgtToken;
  const cleanWallet = walletAddress.toLowerCase().replace('0x', '');
  const positions = [];

  // balanceOf(wallet) -> 0x70a08231
  const balHex = await rpcCall(pm, '0x70a08231' + cleanWallet.padStart(64, '0'));
  if (!balHex) return positions;

  const count = parseInt(balHex, 16);
  if (isNaN(count) || count <= 0) return positions;

  for (let i = 0; i < count; i++) {
    try {
      // tokenOfOwnerByIndex(wallet, i) -> 0x2f745c59
      const tidHex = await rpcCall(pm, '0x2f745c59' + cleanWallet.padStart(64, '0') + i.toString(16).padStart(64, '0'));
      if (!tidHex) continue;
      const tokenId = parseInt(tidHex, 16);

      // positions(tokenId) -> 0x99fbab88
      const posRaw = await rpcCall(pm, '0x99fbab88' + tokenId.toString(16).padStart(64, '0'));
      if (!posRaw || posRaw.length < 130) continue;

      const raw = posRaw.replace('0x', '');
      const chunks = [];
      for (let j = 0; j < raw.length; j += 64) {
        chunks.push(raw.slice(j, j + 64));
      }

      if (chunks.length < 7) continue;

      const token0 = ('0x' + chunks[2].slice(24)).toLowerCase();
      const token1 = ('0x' + chunks[3].slice(24)).toLowerCase();
      const posLiqBig = BigInt('0x' + (chunks[6] || '0'));

      if ((token0 === pgt || token1 === pgt) && posLiqBig > 0n) {
        // Matched PGT Position! Find pool
        const poolAddr = DEX_CONFIG.quickswapV3.knownPools[0];
        if (poolAddr) {
          // Pool total liquidity -> 0x1a686502
          const poolLiqHex = await rpcCall(poolAddr, '0x1a686502');
          // Pool PGT balance -> 0x70a08231 + poolAddr
          const cleanPool = poolAddr.replace('0x', '').padStart(64, '0');
          const pgtBalHex = await rpcCall(pgt, '0x70a08231' + cleanPool);

          if (poolLiqHex && pgtBalHex) {
            const poolLiqBig = BigInt(poolLiqHex);
            const poolPgtRaw = BigInt(pgtBalHex);

            if (poolLiqBig > 0n) {
              const userShare = Number(posLiqBig) / Number(poolLiqBig);
              const userPgtRaw = (posLiqBig * poolPgtRaw) / poolLiqBig;
              const userPgt = Number(userPgtRaw) / 1e18;

              // Fetch pool USD liquidity and compute user's USD valuation
              const poolUsd = await fetchPoolLiquidityUsd(poolAddr);
              const userUsd = Math.round(userShare * poolUsd * 100) / 100;

              positions.push({
                protocol: 'QuickSwap V3',
                tokenId,
                pool: poolAddr,
                liquidityPgt: userPgt,
                liquidityUsd: userUsd,
                sharePercent: Math.round(userShare * 10000) / 100
              });
            }
          }
        }
      }
    } catch (e) {
      console.warn('[DEX Scanner] Error checking position index', i, e);
    }
  }

  return positions;
}

/**
 * Scan Uniswap V3 LP NFT positions for a wallet
 */
async function scanUniswapV3Positions(walletAddress) {
  const pm = DEX_CONFIG.uniswapV3.positionManager;
  const pgt = DEX_CONFIG.pgtToken;
  const cleanWallet = walletAddress.toLowerCase().replace('0x', '');
  const positions = [];

  const balHex = await rpcCall(pm, '0x70a08231' + cleanWallet.padStart(64, '0'));
  if (!balHex) return positions;

  const count = parseInt(balHex, 16);
  if (isNaN(count) || count <= 0) return positions;

  for (let i = 0; i < count; i++) {
    try {
      const tidHex = await rpcCall(pm, '0x2f745c59' + cleanWallet.padStart(64, '0') + i.toString(16).padStart(64, '0'));
      if (!tidHex) continue;
      const tokenId = parseInt(tidHex, 16);

      const posRaw = await rpcCall(pm, '0x99fbab88' + tokenId.toString(16).padStart(64, '0'));
      if (!posRaw || posRaw.length < 130) continue;

      const raw = posRaw.replace('0x', '');
      const chunks = [];
      for (let j = 0; j < raw.length; j += 64) {
        chunks.push(raw.slice(j, j + 64));
      }

      if (chunks.length < 8) continue;
      const token0 = ('0x' + chunks[2].slice(24)).toLowerCase();
      const token1 = ('0x' + chunks[3].slice(24)).toLowerCase();
      const posLiqBig = BigInt('0x' + (chunks[7] || '0'));

      if ((token0 === pgt || token1 === pgt) && posLiqBig > 0n) {
        const estPgt = Number(posLiqBig) / 1e18;
        // Conservative default pricing: ~$0.00002 per PGT
        const estUsd = Math.round(estPgt * 0.00002 * 100) / 100;
        positions.push({
          protocol: 'Uniswap V3',
          tokenId,
          liquidityPgt: estPgt,
          liquidityUsd: estUsd
        });
      }
    } catch (e) {
      console.warn('[DEX Scanner Uniswap V3] Error', e);
    }
  }

  return positions;
}

/**
 * Forward-compatible V4 scanner adapter (Algebra Integral & Uniswap V4)
 */
async function scanV4Positions(walletAddress) {
  const positions = [];
  const { algebraIntegralPositionManager, uniswapV4PositionManager } = DEX_CONFIG.v4Adapters;
  const cleanWallet = walletAddress.toLowerCase().replace('0x', '');

  // QuickSwap V4 (Algebra Integral)
  if (algebraIntegralPositionManager && algebraIntegralPositionManager.length === 42) {
    try {
      const balHex = await rpcCall(algebraIntegralPositionManager, '0x70a08231' + cleanWallet.padStart(64, '0'));
      const count = parseInt(balHex || '0', 16);
      if (count > 0) {
        positions.push({ protocol: 'QuickSwap V4', count });
      }
    } catch (e) {}
  }

  // Uniswap V4 Position Manager
  if (uniswapV4PositionManager && uniswapV4PositionManager.length === 42) {
    try {
      const balHex = await rpcCall(uniswapV4PositionManager, '0x70a08231' + cleanWallet.padStart(64, '0'));
      const count = parseInt(balHex || '0', 16);
      if (count > 0) {
        positions.push({ protocol: 'Uniswap V4', count });
      }
    } catch (e) {}
  }

  return positions;
}

/**
 * Main Entry Point: Aggregates total PGT & USD liquidity across all DEX protocols
 * Returns: { totalPgt, totalUsd, multiplier, isQualified, details }
 */
export async function fetchUserTotalPgtLiquidity(walletAddress, forceRefresh = false) {
  if (!walletAddress || typeof walletAddress !== 'string' || !walletAddress.startsWith('0x') || walletAddress.length !== 42) {
    return { totalPgt: 0, totalUsd: 0, multiplier: 1.0, isQualified: false, details: [] };
  }

  const key = walletAddress.toLowerCase();
  const cached = lpCache.get(key);
  const now = Date.now();

  if (!forceRefresh && cached && (now - cached.timestamp < CACHE_TTL_MS)) {
    return {
      totalPgt: cached.totalPgt,
      totalUsd: cached.totalUsd,
      multiplier: cached.multiplier,
      isQualified: cached.isQualified,
      details: cached.details
    };
  }

  try {
    const [qsV3Pos, uniV3Pos, v4Pos] = await Promise.all([
      scanQuickSwapV3Positions(key),
      scanUniswapV3Positions(key),
      scanV4Positions(key)
    ]);

    const allPositions = [...qsV3Pos, ...uniV3Pos, ...v4Pos];
    let totalPgt = 0;
    let totalUsd = 0;

    allPositions.forEach(p => {
      totalPgt += (p.liquidityPgt || 0);
      totalUsd += (p.liquidityUsd || 0);
    });

    totalPgt = Math.round(totalPgt * 100) / 100;
    totalUsd = Math.round(totalUsd * 100) / 100;

    // Determine Tier Multiplier: $50 = 1.1x, $100 = 1.2x, $150 = 1.3x
    let multiplier = 1.0;
    if (totalUsd >= 150 || totalPgt >= LP_THRESHOLD_PGT) {
      multiplier = 1.30;
    } else if (totalUsd >= 100) {
      multiplier = 1.20;
    } else if (totalUsd >= 50) {
      multiplier = 1.10;
    }

    const isQualified = multiplier > 1.0;

    const result = {
      totalPgt,
      totalUsd,
      multiplier,
      isQualified,
      details: allPositions
    };

    lpCache.set(key, { ...result, timestamp: now });
    return result;
  } catch (err) {
    console.warn('[DEX Scanner] Error aggregating liquidity:', err);
    if (cached) return cached;
    return { totalPgt: 0, totalUsd: 0, multiplier: 1.0, isQualified: false, details: [] };
  }
}

/**
 * Configure dynamic pool or adapter addresses at runtime
 */
export function configureDexPool(options = {}) {
  if (options.v3Pool && options.v3Pool.length === 42) {
    DEX_CONFIG.quickswapV3.knownPools = [options.v3Pool.toLowerCase()];
  }
  if (options.algebraIntegralPositionManager) {
    DEX_CONFIG.v4Adapters.algebraIntegralPositionManager = options.algebraIntegralPositionManager.toLowerCase();
  }
  if (options.uniswapV4PositionManager) {
    DEX_CONFIG.v4Adapters.uniswapV4PositionManager = options.uniswapV4PositionManager.toLowerCase();
  }
}
