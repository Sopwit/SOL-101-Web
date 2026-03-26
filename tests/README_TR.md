# tests Klasoru

Bu klasor proje test senaryolari icin ayrilmistir.

Su an kapsam sinirli veya bos olabilir; bu normaldir. Ancak yeni test eklenecekse su ayrim korunmalidir:

- frontend davranis testleri
- API/entegrasyon testleri
- on-chain veya Anchor dogrulama testleri

Pratik kural:

- Test dosyalari dogrudan urun kodunu kopyalamamali
- Ozellikle wallet auth, forum/shop/market akislari ve profil senkronu icin senaryo odakli testler tercih edilmelidir
