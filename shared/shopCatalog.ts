import { getCatalogBaseDuanPrice } from "./duanEconomy.ts";

export type ShopCatalogItem = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  price: number;
  basePrice?: number;
  rarity: "common" | "rare" | "epic" | "legendary";
  stock: number;
  baseStock?: number;
  category: string;
  soldCount?: number;
  restockAt?: string | null;
  restockDurationMinutes?: number;
};

const RESTOCK_DURATION_BY_RARITY = {
  common: 15,
  rare: 25,
  epic: 40,
  legendary: 60,
} as const;

const STOCK_BY_RARITY = {
  common: 12,
  rare: 8,
  epic: 4,
  legendary: 2,
} as const;

function createCatalogItem(item: ShopCatalogItem): ShopCatalogItem {
  const standardizedPrice = getCatalogBaseDuanPrice(item);
  const standardizedStock = STOCK_BY_RARITY[item.rarity];
  return {
    ...item,
    price: standardizedPrice,
    basePrice: standardizedPrice,
    stock: standardizedStock,
    baseStock: item.baseStock ?? standardizedStock,
    soldCount: item.soldCount ?? 0,
    restockAt: item.restockAt ?? null,
    restockDurationMinutes: item.restockDurationMinutes ?? RESTOCK_DURATION_BY_RARITY[item.rarity],
  };
}

// Public assets use ASCII slugs so URLs stay stable across macOS, git, Vite
// and Supabase deployments.
const BASE_SHOP_ITEM_CATALOG: ShopCatalogItem[] = [
  { id: "altinbalta", name: "Altın Balta", description: "Saf altın kaplaması ve ağır başlığıyla tek darbede savaşın dengesini değiştiren görkemli bir balta.", imageUrl: "/assets/shop-items/altinbalta.png", price: 420, rarity: "epic", stock: 12, category: "Weapons" },
  { id: "altingogusluk", name: "Altın Göğüslük", description: "Parlak yüzeyi kadar sağlam yapısıyla da öne çıkan, seçkin savaşçılara yakışır koruyucu bir zırh.", imageUrl: "/assets/shop-items/altingogusluk.png", price: 360, rarity: "epic", stock: 12, category: "Armor" },
  { id: "altinhancer", name: "Altın Hançer", description: "Hızlı saldırılar ve kritik vuruşlar için tasarlanmış, zarif ama ölümcül bir hançer.", imageUrl: "/assets/shop-items/altinhancer.png", price: 420, rarity: "epic", stock: 12, category: "Weapons" },
  { id: "altinsavascekici", name: "Altın Savaş Çekici", description: "Ağır darbeleriyle savunmaları kıran, ihtişamlı görünümü kadar yıkıcı gücüyle de ünlü bir savaş çekici.", imageUrl: "/assets/shop-items/altinsavascekici.png", price: 420, rarity: "epic", stock: 12, category: "Weapons" },
  { id: "atankalp", name: "Atan Kalp", description: "Nadir yaratıklardan düşen, hâlâ canlıymış gibi titreşen ürkütücü bir koleksiyon malzemesi.", imageUrl: "/assets/shop-items/atankalp.png", price: 60, rarity: "common", stock: 40, category: "Materials" },
  { id: "balikkilcigi", name: "Balık Kılçığı", description: "Basit görünse de zanaat tariflerinde ve yan görevlerde sıkça kullanılan hafif bir malzeme.", imageUrl: "/assets/shop-items/balikkilcigi.png", price: 60, rarity: "common", stock: 40, category: "Materials" },
  { id: "balta", name: "Balta", description: "Dayanıklı sapı ve dengeli ağırlığıyla yakın dövüşte güven veren klasik bir balta.", imageUrl: "/assets/shop-items/balta.png", price: 240, rarity: "rare", stock: 24, category: "Weapons" },
  { id: "basitkilic", name: "Basit Kılıç", description: "Yeni başlayan maceracıların ilk savaşlarında güvenle kullanabileceği sade ama sağlam bir kılıç.", imageUrl: "/assets/shop-items/basitkilic.png", price: 240, rarity: "common", stock: 40, category: "Weapons" },
  { id: "berserkerarmor", name: "Berserker Armor", description: "Savunmadan çok saldırıya oynayan savaşçılar için dövüş ateşini yükselten efsanevi bir zırh.", imageUrl: "/assets/shop-items/berserkerarmor.png", price: 540, rarity: "legendary", stock: 5, category: "Armor" },
  { id: "coin", name: "Coin", description: "Takas, görev ödülü ve koleksiyon sistemlerinde temel değer birimi olarak görülen simgesel bir para parçası.", imageUrl: "/assets/shop-items/coin.png", price: 60, rarity: "common", stock: 40, category: "Materials" },
  { id: "ciftbaslibalta", name: "Çift Başlı Balta", description: "İki ağızlı yapısıyla geniş savuruşlar yapan, yüksek hasarlı ve korkutucu bir savaş baltası.", imageUrl: "/assets/shop-items/ciftbaslibalta.png", price: 240, rarity: "rare", stock: 24, category: "Weapons" },
  { id: "dekoratifkilic", name: "Dekoratif Kılıç", description: "Savaş alanından çok asalet ve gösteriş için tasarlanmış, göz alıcı bir koleksiyon kılıcı.", imageUrl: "/assets/shop-items/dekoratifkilic.png", price: 240, rarity: "rare", stock: 24, category: "Weapons" },
  { id: "demirgogusluk", name: "Demir Göğüslük", description: "Ön saflarda savaşanlar için hazırlanmış, sağlamlığıyla öne çıkan orta seviye bir göğüs zırhı.", imageUrl: "/assets/shop-items/demirgogusluk.png", price: 260, rarity: "rare", stock: 24, category: "Armor" },
  { id: "derigogusluk", name: "Deri Göğüslük", description: "Hafif yapısı sayesinde hareket kabiliyetini korurken temel koruma sağlayan esnek bir zırh parçası.", imageUrl: "/assets/shop-items/derigogusluk.png", price: 260, rarity: "rare", stock: 24, category: "Armor" },
  { id: "devdekoratifkilic", name: "Dev Dekoratif Kılıç", description: "Boyutuyla dikkat çeken, gücün ve statünün sembolü hâline gelmiş devasa bir prestij silahı.", imageUrl: "/assets/shop-items/devdekoratifkilic.png", price: 600, rarity: "legendary", stock: 5, category: "Weapons" },
  { id: "direncyuzugu", name: "Direnç Yüzüğü", description: "Taşıyana savunma ve dayanıklılık kazandıran, savaşta ayakta kalmayı kolaylaştıran bir yüzük.", imageUrl: "/assets/shop-items/direncyuzugu.png", price: 300, rarity: "rare", stock: 24, category: "Accessories" },
  { id: "dondurmaiksiri", name: "Dondurma İksiri", description: "Düşmanların hareketlerini ağırlaştıran soğuk özlü bir iksir.", imageUrl: "/assets/shop-items/dondurmaiksiri.png", price: 80, rarity: "common", stock: 40, category: "Consumables" },
  { id: "dragonslayer", name: "Dragon Slayer", description: "Dev yaratıklar ve patron savaşları için dövülmüş, efsanelere konu olmuş bir silah.", imageUrl: "/assets/shop-items/dragonslayer.png", price: 600, rarity: "legendary", stock: 5, category: "Weapons" },
  { id: "et", name: "Et", description: "Yemek tariflerinde, görev zincirlerinde ve temel hayatta kalma sistemlerinde kullanılabilen taze bir kaynak.", imageUrl: "/assets/shop-items/et.png", price: 60, rarity: "common", stock: 40, category: "Materials" },
  { id: "evlilikyuzugu", name: "Evlilik Yüzüğü", description: "Rol yapma ve koleksiyon odaklı oyuncuların gözdesi olan zarif ve anlam yüklü bir yüzük.", imageUrl: "/assets/shop-items/evlilikyuzugu.png", price: 220, rarity: "rare", stock: 24, category: "Accessories" },
  { id: "gargara", name: "Gargara", description: "Sıradan görünmesine rağmen geçici durum etkileriyle ilişkilendirilen ilginç bir tüketim eşyası.", imageUrl: "/assets/shop-items/gargara.png", price: 80, rarity: "common", stock: 40, category: "Consumables" },
  { id: "guckolyesi", name: "Güç Kolyesi", description: "Fiziksel saldırıları destekleyen, savaşçı sınıflar için değerli bir güç kolyesi.", imageUrl: "/assets/shop-items/guckolyesi.png", price: 220, rarity: "rare", stock: 24, category: "Accessories" },
  { id: "gucluaskiksiri", name: "Güçlü Aşk İksiri", description: "Nadir bulunan, etkisi uzun süren ve sıradan iksirlerden çok daha güçlü bir karışım.", imageUrl: "/assets/shop-items/gucluaskiksiri.png", price: 260, rarity: "epic", stock: 12, category: "Consumables" },
  { id: "guclucaniksiri", name: "Güçlü Can İksiri", description: "Zorlu savaşlarda büyük miktarda iyileştirme sağlayan üst seviye bir can iksiri.", imageUrl: "/assets/shop-items/guclucaniksiri.png", price: 260, rarity: "epic", stock: 12, category: "Consumables" },
  { id: "guclusuratiksiri", name: "Güçlü Sürat İksiri", description: "Kısa süreliğine hareket ve saldırı temposunu belirgin biçimde artıran gelişmiş bir iksir.", imageUrl: "/assets/shop-items/guclusuratiksiri.png", price: 260, rarity: "epic", stock: 12, category: "Consumables" },
  { id: "gucyuzugu", name: "Güç Yüzüğü", description: "Yakın dövüş odaklı karakterlerin hasar potansiyelini yükselten kuvvetli bir aksesuar.", imageUrl: "/assets/shop-items/gucyuzugu.png", price: 220, rarity: "rare", stock: 24, category: "Accessories" },
  { id: "hancer", name: "Hançer", description: "Hızlı vuruşlar ve çevik manevralar için ideal, hafif yapılı bir yakın dövüş silahı.", imageUrl: "/assets/shop-items/hancer.png", price: 240, rarity: "rare", stock: 24, category: "Weapons" },
  { id: "hayatkolyesi", name: "Hayat Kolyesi", description: "Can havuzunu güçlendirerek savunmacı oyun tarzını destekleyen değerli bir kolye.", imageUrl: "/assets/shop-items/hayatkolyesi.png", price: 300, rarity: "rare", stock: 24, category: "Accessories" },
  { id: "hirsizeldiveni", name: "Hırsız Eldiveni", description: "Sessiz hareket etmeyi ve çevik oyun stilini destekleyen, ustalık isteyen bir ekipman.", imageUrl: "/assets/shop-items/hirsizeldiveni.png", price: 220, rarity: "rare", stock: 24, category: "Accessories" },
  { id: "kafatasi", name: "Kafatası", description: "Karanlık bölgelerden toplanan, büyüsel ritüeller ve koleksiyonlar için aranan bir kalıntı.", imageUrl: "/assets/shop-items/kafatasi.png", price: 60, rarity: "common", stock: 40, category: "Materials" },
  { id: "kayanyildiz", name: "Kayan Yıldız", description: "Göksel enerjiyi içinde barındıran, büyü ve görev sistemlerinde değerli sayılan nadir bir materyal.", imageUrl: "/assets/shop-items/kayanyildiz.png", price: 240, rarity: "epic", stock: 12, category: "Materials" },
  { id: "kehanet", name: "Kehanet", description: "Gizemli gücüyle dikkat çeken, koleksiyoncuların peşine düştüğü özel bir parça.", imageUrl: "/assets/shop-items/kehanet.png", price: 240, rarity: "epic", stock: 12, category: "Materials" },
  { id: "kralintaci", name: "Kralın Tacı", description: "Prestij, güç ve soyluluğu temsil eden; en seçkin oyunculara hitap eden görkemli bir taç.", imageUrl: "/assets/shop-items/kralintaci.png", price: 580, rarity: "legendary", stock: 5, category: "Accessories" },
  { id: "kurtkemigi", name: "Kurt Kemiği", description: "Vahşi yaratıklardan elde edilen, üretim tariflerinde sıkça aranan temel bir kemik parçası.", imageUrl: "/assets/shop-items/kurtkemigi.png", price: 60, rarity: "common", stock: 40, category: "Materials" },
  { id: "manaiksiri", name: "Mana İksiri", description: "Büyü gücünü tazeleyerek savaşın ortasında bile yetenek kullanımını sürdüren bir iksir.", imageUrl: "/assets/shop-items/manaiksiri.png", price: 160, rarity: "rare", stock: 24, category: "Consumables" },
  { id: "parakolyesi", name: "Para Kolyesi", description: "Servet ve ganimet temasını taşıyan, ekonomi odaklı oyuncular için dikkat çekici bir aksesuar.", imageUrl: "/assets/shop-items/parakolyesi.png", price: 220, rarity: "rare", stock: 24, category: "Accessories" },
  { id: "savascekici", name: "Savaş Çekici", description: "Ağır vuruşları seven savaşçılar için dengeli ve güvenilir bir klasik çekiç.", imageUrl: "/assets/shop-items/savascekici.png", price: 240, rarity: "rare", stock: 24, category: "Weapons" },
  { id: "ustunciftbaslibalta", name: "Üstün Çift Başlı Balta", description: "Usta savaşçılar için geliştirilmiş, yıkıcı gücüyle efsane statüsüne ulaşmış çift başlı bir balta.", imageUrl: "/assets/shop-items/ustunciftbaslibalta.png", price: 600, rarity: "legendary", stock: 5, category: "Weapons" },
  { id: "ustundemirgogusluk", name: "Üstün Demir Göğüslük", description: "En sert darbeleri karşılamak için dövülmüş, üst düzey koruma sağlayan ağır bir zırh.", imageUrl: "/assets/shop-items/ustundemirgogusluk.png", price: 540, rarity: "legendary", stock: 5, category: "Armor" },
  { id: "yabaniksiri", name: "Yaban İksiri", description: "Doğanın ham gücünü taşıyan, temel etkiler sunan sade ama kullanışlı bir iksir.", imageUrl: "/assets/shop-items/yabaniksiri.png", price: 80, rarity: "common", stock: 40, category: "Consumables" },
  { id: "zayifaskiksiri", name: "Zayıf Aşk İksiri", description: "Erken oyunda kullanılan, hafif etkili ve eğlenceli bir özel iksir.", imageUrl: "/assets/shop-items/zayifaskiksiri.png", price: 80, rarity: "common", stock: 40, category: "Consumables" },
  { id: "zayifcaniksiri", name: "Zayıf Can İksiri", description: "Başlangıç seviyesinde temel iyileştirme sağlayan güvenilir bir can iksiri.", imageUrl: "/assets/shop-items/zayifcaniksiri.png", price: 80, rarity: "common", stock: 40, category: "Consumables" },
  { id: "zayifsuratiksiri", name: "Zayıf Sürat İksiri", description: "Kısa süreli küçük bir hız avantajı sağlayan başlangıç seviyesi bir karışım.", imageUrl: "/assets/shop-items/zayifsuratiksiri.png", price: 80, rarity: "common", stock: 40, category: "Consumables" },
  { id: "zehirsisesi", name: "Zehir Şişesi", description: "Zehir etkili saldırılar ve durum hasarı odaklı stratejiler için kullanılabilecek keskin bir karışım.", imageUrl: "/assets/shop-items/zehirsisesi.png", price: 80, rarity: "common", stock: 40, category: "Consumables" },
  { id: "zenginlikyuzugu", name: "Zenginlik Yüzüğü", description: "Servet, ganimet ve prestij temasını bir araya getiren güçlü ve göz alıcı bir yüzük.", imageUrl: "/assets/shop-items/zenginlikyuzugu.png", price: 400, rarity: "epic", stock: 12, category: "Accessories" },
  { id: "zerafetyuzugu", name: "Zerafet Yüzüğü", description: "İnce işçiliği ve şık görünümüyle koleksiyon değeri taşıyan zarif bir yüzük.", imageUrl: "/assets/shop-items/zerafetyuzugu.png", price: 400, rarity: "epic", stock: 12, category: "Accessories" },
];

export const SHOP_ITEM_CATALOG: ShopCatalogItem[] = BASE_SHOP_ITEM_CATALOG.map(createCatalogItem);

export const LEGACY_SHOP_ITEM_IDS = [
  "cosmic-blade",
  "stellar-shield",
  "nebula-potion",
  "space-helmet",
  "quantum-gauntlets",
  "crystal-amulet",
];
