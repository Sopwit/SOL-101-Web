import type { ShopItem } from "../types";

type LocalizedCopy = {
  name: string;
  description: string;
};

const ENGLISH_ITEM_COPY: Record<string, LocalizedCopy> = {
  altinbalta: { name: "Golden Axe", description: "A grand battle axe with a gold-plated head, built to swing the tide of combat in a single strike." },
  altingogusluk: { name: "Golden Chestplate", description: "A prestigious chestplate that pairs polished shine with elite defensive strength." },
  altinhancer: { name: "Golden Dagger", description: "A refined but deadly dagger made for fast attacks and sharp critical hits." },
  altinsavascekici: { name: "Golden War Hammer", description: "A majestic war hammer known for breaking defenses with crushing force." },
  atankalp: { name: "Beating Heart", description: "A disturbing collectible material that still seems alive after dropping from rare creatures." },
  balikkilcigi: { name: "Fish Bone", description: "A lightweight crafting material commonly used in recipes and side quests." },
  balta: { name: "Axe", description: "A dependable close-range weapon with balanced weight and a sturdy grip." },
  basitkilic: { name: "Basic Sword", description: "A simple but reliable sword suited for a new adventurer's first battles." },
  berserkerarmor: { name: "Berserker Armor", description: "Legendary armor made for fighters who trade caution for relentless aggression." },
  coin: { name: "Coin", description: "A symbolic currency piece tied to rewards, barter, and collectible systems." },
  ciftbaslibalta: { name: "Double-Headed Axe", description: "A fearsome axe with twin blades built for wide swings and heavy damage." },
  crimsonbeherit: { name: "Crimson Beherit", description: "A blood-red relic etched with ominous markings, tied to immense power and a dark fate." },
  dekoratifkilic: { name: "Decorative Sword", description: "A display-ready blade designed to represent status and style more than practicality." },
  demirgogusluk: { name: "Iron Chestplate", description: "A solid mid-tier chest armor forged for fighters who hold the front line." },
  derigogusluk: { name: "Leather Chestplate", description: "A flexible armor piece that preserves mobility while offering basic protection." },
  devdekoratifkilic: { name: "Giant Decorative Sword", description: "A massive prestige weapon valued as much for presence as for power." },
  direncyuzugu: { name: "Resistance Ring", description: "A ring that boosts toughness and helps its wearer stay standing in longer fights." },
  dondurmaiksiri: { name: "Freeze Potion", description: "A cold-infused potion that slows enemies and disrupts their movement." },
  dragonslayer: { name: "Dragon Slayer", description: "A legendary weapon forged for towering beasts and defining boss encounters." },
  et: { name: "Meat", description: "A fresh resource used in cooking, quests, and basic survival systems." },
  evlilikyuzugu: { name: "Wedding Ring", description: "A refined accessory favored by collectors and role-play focused players." },
  gargara: { name: "Mouthwash", description: "An odd consumable tied to temporary status effects despite its ordinary look." },
  guckolyesi: { name: "Power Necklace", description: "A combat-oriented necklace that enhances raw offensive strength." },
  gucluaskiksiri: { name: "Strong Love Potion", description: "A rare brew with a longer-lasting and more potent special effect." },
  guclucaniksiri: { name: "Strong Health Potion", description: "A high-tier potion that restores a substantial amount of health in hard fights." },
  guclusuratiksiri: { name: "Strong Speed Potion", description: "An advanced potion that noticeably increases movement and combat pace for a short time." },
  gucyuzugu: { name: "Power Ring", description: "A strength-focused ring that pairs especially well with melee builds." },
  hancer: { name: "Dagger", description: "A light close-range weapon tailored to fast, agile combat." },
  hayatkolyesi: { name: "Life Necklace", description: "A valuable necklace that reinforces survivability and a larger health pool." },
  hirsizeldiveni: { name: "Thief Gloves", description: "Precision gear designed for stealth, agility, and nimble movement." },
  kafatasi: { name: "Skull", description: "A dark relic gathered from dangerous regions and prized in ritual or collection systems." },
  kayanyildiz: { name: "Shooting Star", description: "A rare celestial material infused with energy for magic and quest systems." },
  kehanet: { name: "Prophecy", description: "A mysterious collectible wrapped in omen and arcane significance." },
  kralintaci: { name: "King's Crown", description: "A magnificent crown that represents prestige, power, and noble status." },
  kurtkemigi: { name: "Wolf Bone", description: "A basic bone fragment gathered from wild creatures and widely used in crafting." },
  manaiksiri: { name: "Mana Potion", description: "A restorative potion that keeps spellcasters supplied with magical energy." },
  parakolyesi: { name: "Coin Necklace", description: "A distinctive accessory themed around fortune, loot, and wealth." },
  savascekici: { name: "War Hammer", description: "A trusted classic for fighters who prefer slow, punishing blows." },
  ustunciftbaslibalta: { name: "Superior Double-Headed Axe", description: "A legendary twin-bladed axe built for veteran warriors and overwhelming impact." },
  ustundemirgogusluk: { name: "Superior Iron Chestplate", description: "Heavy armor forged to endure the hardest hits at the highest tier." },
  yabaniksiri: { name: "Wild Potion", description: "A simple nature-themed potion that provides grounded, practical effects." },
  zayifaskiksiri: { name: "Weak Love Potion", description: "A playful low-tier special potion aimed at early progression." },
  zayifcaniksiri: { name: "Weak Health Potion", description: "A dependable starter potion that provides basic healing." },
  zayifsuratiksiri: { name: "Weak Speed Potion", description: "An entry-level potion that grants a modest burst of speed." },
  zehirsisesi: { name: "Poison Bottle", description: "A sharp mixture suited to poison-based tactics and damage-over-time effects." },
  zenginlikyuzugu: { name: "Wealth Ring", description: "A striking ring that combines prestige, fortune, and loot-focused identity." },
  zerafetyuzugu: { name: "Grace Ring", description: "An elegant collectible ring valued for its craftsmanship and refined style." },
};

export function localizeShopItem(item: ShopItem, language: "tr" | "en"): ShopItem {
  if (language === "tr") {
    return item;
  }

  const localized = ENGLISH_ITEM_COPY[item.id];
  if (!localized) {
    return item;
  }

  return {
    ...item,
    name: localized.name,
    description: localized.description,
  };
}

export function normalizeShopSearch(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
