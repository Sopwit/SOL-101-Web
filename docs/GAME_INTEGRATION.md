# SOL101 Oyun Entegrasyon Kılavuzu

Bu döküman, SOL101 platformunu oyununuzla entegre etmek için gerekli tüm bilgileri içerir.

## API Endpoint

```
https://[PROJECT_ID].supabase.co/functions/v1/make-server-5d6242bb
```

## Authentication

Tüm isteklerde aşağıdaki header'ı ekleyin:

```javascript
{
  "Authorization": "Bearer [PUBLIC_ANON_KEY]",
  "Content-Type": "application/json"
}
```

## 1. Oyun Verilerini Senkronize Etme

Oyuncunun oyundaki ilerlemesini platforma senkronize etmek için:

### Endpoint
`POST /game/sync`

### Request Body
```json
{
  "walletAddress": "kullanıcı_wallet_adresi",
  "level": 5,
  "xp": 350,
  "achievements": ["first_win", "speedrunner", "collector"],
  "itemsEarned": ["item_123", "item_456"]
}
```

### Response
```json
{
  "synced": true
}
```

### Kullanım Örneği (JavaScript)
```javascript
async function syncGameData(walletAddress, gameData) {
  const response = await fetch(`${API_BASE_URL}/game/sync`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PUBLIC_ANON_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      walletAddress,
      ...gameData
    })
  });
  
  const result = await response.json();
  return result.synced;
}

// Örnek kullanım
await syncGameData("5eykt...abc", {
  level: 10,
  xp: 750,
  achievements: ["level_10", "boss_defeated"],
  itemsEarned: ["legendary_sword"]
});
```

## 2. Oyun Eventlerini Tetikleme

Oyunda önemli olaylar gerçekleştiğinde platform üzerinde event kaydetmek için:

### Endpoint
`POST /game/event`

### Request Body
```json
{
  "walletAddress": "kullanıcı_wallet_adresi",
  "eventType": "boss_defeated",
  "eventData": {
    "bossName": "Dragon King",
    "difficulty": "hard",
    "rewardTokens": 100,
    "timestamp": "2026-03-10T12:00:00Z"
  }
}
```

### Event Types
- `level_up` - Oyuncu seviye atladı
- `achievement_unlocked` - Başarı kazanıldı
- `item_earned` - Item kazanıldı
- `boss_defeated` - Boss yenildi
- `quest_completed` - Görev tamamlandı
- `milestone_reached` - Milestone'a ulaşıldı

### Kullanım Örneği (Unity C#)
```csharp
public async Task TriggerGameEvent(string walletAddress, string eventType, object eventData)
{
    var requestData = new {
        walletAddress = walletAddress,
        eventType = eventType,
        eventData = eventData
    };
    
    var json = JsonUtility.ToJson(requestData);
    
    using (UnityWebRequest www = UnityWebRequest.Post(API_BASE_URL + "/game/event", json))
    {
        www.SetRequestHeader("Authorization", "Bearer " + PUBLIC_ANON_KEY);
        www.SetRequestHeader("Content-Type", "application/json");
        
        await www.SendWebRequest();
        
        if (www.result == UnityWebRequest.Result.Success)
        {
            Debug.Log("Event triggered successfully");
        }
    }
}
```

## 3. Platform Verilerine Erişim

### Profil Bilgilerini Alma

```javascript
async function getPlayerProfile(walletAddress) {
  const response = await fetch(`${API_BASE_URL}/profile/${walletAddress}`, {
    headers: {
      'Authorization': `Bearer ${PUBLIC_ANON_KEY}`
    }
  });
  
  return await response.json();
}
```

### Oyuncu İstatistiklerini Alma

```javascript
async function getPlayerStats(walletAddress) {
  const response = await fetch(`${API_BASE_URL}/profile/${walletAddress}/stats`, {
    headers: {
      'Authorization': `Bearer ${PUBLIC_ANON_KEY}`
    }
  });
  
  return await response.json();
}
```

### Envanter Bilgilerini Alma

```javascript
async function getPlayerInventory(walletAddress) {
  const response = await fetch(`${API_BASE_URL}/inventory/${walletAddress}`, {
    headers: {
      'Authorization': `Bearer ${PUBLIC_ANON_KEY}`
    }
  });
  
  return await response.json();
}
```

## 4. Ödül Sistemi Entegrasyonu

Oyuncuya platf üzerinden ödül vermek için:

```javascript
async function rewardPlayer(walletAddress, itemId) {
  const response = await fetch(`${API_BASE_URL}/inventory/${walletAddress}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PUBLIC_ANON_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ itemId })
  });
  
  return await response.json();
}
```

## 5. Gerçek Zamanlı Senkronizasyon

Oyun oturumu boyunca düzenli olarak senkronize etmek için:

```javascript
class GamePlatformSync {
  constructor(walletAddress) {
    this.walletAddress = walletAddress;
    this.syncInterval = 60000; // 1 dakika
    this.pendingEvents = [];
  }
  
  start() {
    this.intervalId = setInterval(() => {
      this.sync();
    }, this.syncInterval);
  }
  
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }
  
  async sync() {
    // Oyun verilerini topla
    const gameData = {
      level: this.getCurrentLevel(),
      xp: this.getCurrentXP(),
      achievements: this.getNewAchievements(),
      itemsEarned: this.getNewItems()
    };
    
    // Platform ile senkronize et
    await syncGameData(this.walletAddress, gameData);
    
    // Bekleyen eventleri gönder
    for (const event of this.pendingEvents) {
      await this.triggerEvent(event.type, event.data);
    }
    this.pendingEvents = [];
  }
  
  async triggerEvent(eventType, eventData) {
    const response = await fetch(`${API_BASE_URL}/game/event`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PUBLIC_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        walletAddress: this.walletAddress,
        eventType,
        eventData
      })
    });
    
    return await response.json();
  }
  
  getCurrentLevel() { /* Oyun kodunuzdan seviye alın */ }
  getCurrentXP() { /* Oyun kodunuzdan XP alın */ }
  getNewAchievements() { /* Yeni başarıları alın */ }
  getNewItems() { /* Yeni itemleri alın */ }
}

// Kullanım
const platformSync = new GamePlatformSync(playerWalletAddress);
platformSync.start();

// Oyun bittiğinde
platformSync.stop();
```

## 6. Başarı Sistemi

### Başarı Tanımlama Örneği

```javascript
const ACHIEVEMENTS = {
  FIRST_BLOOD: {
    id: 'first_blood',
    name: 'First Blood',
    description: 'İlk düşmanı yendin',
    icon: '⚔️'
  },
  LEVEL_10: {
    id: 'level_10',
    name: 'Deneyimli Savaşçı',
    description: '10. seviyeye ulaştın',
    icon: '🏆'
  },
  COLLECTOR: {
    id: 'collector',
    name: 'Koleksiyoncu',
    description: '50 farklı item topladın',
    icon: '📦'
  },
  SPEEDRUNNER: {
    id: 'speedrunner',
    name: 'Hız Canavarı',
    description: 'Bir seviyeyi 5 dakikadan kısa sürede tamamladın',
    icon: '⚡'
  }
};

// Başarı kazanıldığında
async function unlockAchievement(walletAddress, achievementId) {
  await syncGameData(walletAddress, {
    achievements: [achievementId]
  });
  
  await triggerGameEvent(walletAddress, 'achievement_unlocked', {
    achievementId,
    achievementName: ACHIEVEMENTS[achievementId].name,
    timestamp: new Date().toISOString()
  });
}
```

## 7. Hata Yönetimi

```javascript
async function safeSyncGameData(walletAddress, gameData) {
  try {
    const response = await fetch(`${API_BASE_URL}/game/sync`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PUBLIC_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        walletAddress,
        ...gameData
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.error('Sync failed:', error);
      
      // Offline mode'a geç veya yerel olarak kaydet
      localStorage.setItem('pending_sync', JSON.stringify({
        walletAddress,
        gameData,
        timestamp: Date.now()
      }));
      
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Network error:', error);
    return false;
  }
}
```

## 8. Test Etme

### Test Wallet Adresi
Geliştirme sırasında test için:
```
Test Wallet: 5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d
```

### Test Event Gönderme

```javascript
// Test eventi
await fetch(`${API_BASE_URL}/game/event`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${PUBLIC_ANON_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    walletAddress: "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d",
    eventType: "test_event",
    eventData: {
      message: "Test edildi",
      timestamp: new Date().toISOString()
    }
  })
});
```

## 9. Best Practices

1. **Batch İşlemler**: Birden fazla küçük güncelleme yerine, belirli aralıklarla toplu senkronizasyon yapın
2. **Offline Support**: Ağ bağlantısı olmadığında verileri yerel olarak kaydedin
3. **Rate Limiting**: API'yi çok sık çağırmayın (dakikada 60 istek limiti)
4. **Hata Yönetimi**: Her API çağrısında try-catch kullanın
5. **Validasyon**: Verileri göndermeden önce doğrulayın
6. **Logging**: Önemli olayları logglayın

## Destek

Sorun yaşarsanız:
- GitHub Issues: [proje linki]
- Discord: [discord linki]
- E-posta: support@sol101.com
