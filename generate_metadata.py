import os
import json

metadata_dir = os.path.join(os.path.dirname(__file__), 'metadata')

if not os.path.exists(metadata_dir):
    os.makedirs(metadata_dir)

nft_types = [
    { "id": "nft_common_boost", "name": "Common Boost Core", "desc": "A common core that boosts faucet rewards by 10%.", "fb": 10, "gm": 0, "sb": 0, "rm": 100 },
    { "id": "nft_silver_charger", "name": "Silver Charger Core", "desc": "A silver core that boosts faucet rewards by 25%.", "fb": 25, "gm": 0, "sb": 0, "rm": 100 },
    { "id": "nft_gold_turbine", "name": "Gold Turbine Core", "desc": "A gold core that boosts faucet rewards by 50%.", "fb": 50, "gm": 0, "sb": 0, "rm": 100 },
    { "id": "nft_rare_shield", "name": "Rare Shield Core", "desc": "A rare core that gives a 15% game multiplier.", "fb": 0, "gm": 15, "sb": 0, "rm": 100 },
    { "id": "nft_pulse_blaster", "name": "Pulse Blaster Core", "desc": "A blaster core that gives a 30% game multiplier.", "fb": 0, "gm": 30, "sb": 0, "rm": 100 },
    { "id": "nft_epic_yield", "name": "Epic Yield Core", "desc": "An epic core that yields 50% game multiplier and 5% staking boost.", "fb": 0, "gm": 50, "sb": 5, "rm": 100 },
    { "id": "nft_referral_beacon", "name": "Referral Beacon Core", "desc": "A beacon core that gives a 10% referral multiplier.", "fb": 0, "gm": 0, "sb": 0, "rm": 110 },
    { "id": "nft_affiliate_guild", "name": "Affiliate Guild Core", "desc": "A guild core that gives a 50% referral multiplier.", "fb": 0, "gm": 0, "sb": 0, "rm": 150 },
    { "id": "nft_legendary_king", "name": "Legendary King Core", "desc": "A legendary core that doubles your referral rewards.", "fb": 0, "gm": 0, "sb": 0, "rm": 200 },
    { "id": "nft_yield_vault", "name": "Yield Vault Core", "desc": "A staking core granting +15% APY yield.", "fb": 0, "gm": 0, "sb": 15, "rm": 100 },
    { "id": "nft_vip_pass", "name": "VIP Access Pass", "desc": "A consumable pass granting 30 Days of VIP status (+100% all yields).", "fb": 0, "gm": 0, "sb": 0, "rm": 100 },
    { "id": "nft_vip_pass_yearly", "name": "Yearly VIP Access Pass", "desc": "A consumable pass granting 365 Days of VIP status (+100% all yields).", "fb": 0, "gm": 0, "sb": 0, "rm": 100 }
]

for nft in nft_types:
    attributes = []
    
    tier = "Common"
    if "Silver" in nft["name"] or "Rare" in nft["name"]:
        tier = "Rare"
    if "Gold" in nft["name"] or "Epic" in nft["name"]:
        tier = "Epic"
    if "Legendary" in nft["name"]:
        tier = "Legendary"

    attributes.append({ "trait_type": "Tier", "value": tier })

    if nft["fb"] > 0:
        attributes.append({ "trait_type": "Faucet Boost", "value": f'{nft["fb"]}%' })
    if nft["gm"] > 0:
        attributes.append({ "trait_type": "Game Multiplier", "value": f'{nft["gm"]}%' })
    if nft["sb"] > 0:
        attributes.append({ "trait_type": "Staking Boost", "value": f'{nft["sb"]}%' })
    if nft["rm"] > 100:
        attributes.append({ "trait_type": "Referral Multiplier", "value": f'{nft["rm"] - 100}%' })

    metadata = {
        "name": nft["name"],
        "description": nft["desc"],
        "image": f'https://poss77.github.io/polygame/metadata/images/{nft["id"]}.png',
        "attributes": attributes
    }

    file_path = os.path.join(metadata_dir, f'{nft["id"]}.json')
    with open(file_path, 'w') as f:
        json.dump(metadata, f, indent=2)
    print(f'Generated {nft["id"]}.json')
