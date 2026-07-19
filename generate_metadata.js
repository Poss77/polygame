const fs = require('fs');
const path = require('path');

const metadataDir = path.join(__dirname, 'metadata');

if (!fs.existsSync(metadataDir)) {
    fs.mkdirSync(metadataDir);
}

const nftTypes = [
    { id: "nft_common_boost", name: "Common Boost Core", desc: "A common core that boosts faucet rewards by 10%.", fb: 10, gm: 0, sb: 0, rm: 100 },
    { id: "nft_silver_charger", name: "Silver Charger Core", desc: "A silver core that boosts faucet rewards by 25%.", fb: 25, gm: 0, sb: 0, rm: 100 },
    { id: "nft_gold_turbine", name: "Gold Turbine Core", desc: "A gold core that boosts faucet rewards by 50%.", fb: 50, gm: 0, sb: 0, rm: 100 },
    { id: "nft_rare_shield", name: "Rare Shield Core", desc: "A rare core that gives a 15% game multiplier.", fb: 0, gm: 15, sb: 0, rm: 100 },
    { id: "nft_pulse_blaster", name: "Pulse Blaster Core", desc: "A blaster core that gives a 30% game multiplier.", fb: 0, gm: 30, sb: 0, rm: 100 },
    { id: "nft_epic_yield", name: "Epic Yield Core", desc: "An epic core that yields 50% game multiplier and 5% staking boost.", fb: 0, gm: 50, sb: 5, rm: 100 },
    { id: "nft_referral_beacon", name: "Referral Beacon Core", desc: "A beacon core that gives a 10% referral multiplier.", fb: 0, gm: 0, sb: 0, rm: 110 },
    { id: "nft_affiliate_guild", name: "Affiliate Guild Core", desc: "A guild core that gives a 50% referral multiplier.", fb: 0, gm: 0, sb: 0, rm: 150 },
    { id: "nft_legendary_king", name: "Legendary King Core", desc: "A legendary core that doubles your referral rewards.", fb: 0, gm: 0, sb: 0, rm: 200 }
];

nftTypes.forEach(nft => {
    const attributes = [];
    
    // Add Tier trait based on name
    let tier = "Common";
    if (nft.name.includes("Silver") || nft.name.includes("Rare")) tier = "Rare";
    if (nft.name.includes("Gold") || nft.name.includes("Epic")) tier = "Epic";
    if (nft.name.includes("Legendary")) tier = "Legendary";

    attributes.push({ trait_type: "Tier", value: tier });

    if (nft.fb > 0) attributes.push({ trait_type: "Faucet Boost", value: `${nft.fb}%` });
    if (nft.gm > 0) attributes.push({ trait_type: "Game Multiplier", value: `${nft.gm}%` });
    if (nft.sb > 0) attributes.push({ trait_type: "Staking Boost", value: `${nft.sb}%` });
    if (nft.rm > 100) attributes.push({ trait_type: "Referral Multiplier", value: `${nft.rm - 100}%` });

    const metadata = {
        name: nft.name,
        description: nft.desc,
        image: `https://polygame.xyz/metadata/images/${nft.id}.png`,
        attributes: attributes
    };

    fs.writeFileSync(path.join(metadataDir, `${nft.id}.json`), JSON.stringify(metadata, null, 2));
    console.log(`Generated ${nft.id}.json`);
});
