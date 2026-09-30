# Maça Yazıl

Lütfen halısaha grubumuz için şifresiz ve çok basit çalışan tek sayfalık bir web uygulaması oluştur. Uygulamanın kuralları ve özellikleri şunlar olsun:

1. Üst kısımda büyük bir "Maça Yazıl" butonu ve altında "İsim" girilecek bir kutu olsun. Şifre veya üyelik kesinlikle olmayacak.

2. Kullanıcı ismini yazıp maça katıldığında, kayıt olduğu tam zaman (saat ve dakika) sistem tarafından arka planda tutulsun.

3. Listeleme mantığı:

   - "As Kadro (14 Kişi)": Maça ilk yazılan 14 kişi buraya eklenecek.

   - "Yedekler Listesi": 15. kişiden itibaren yazılan herkes başvuru sırasına göre (Yedek 1, Yedek 2...) bu listede görünecek.

4. İptal Durumu: As kadrodaki bir kişi kendi isminin yanındaki "Maçtan Çık" butonuna basarsa listeden silinecek. Onun yerine Yedek 1 sırasındaki kişi otomatik olarak as kadronun 14. sırasına yükselecek. Yedek listesi de otomatik olarak yukarı kayacak.

5. Takım Seçimi: As kadroya giren ilk 14 kişiye isminin yanında "Siyah Takım" veya "Beyaz Takım" seçme butonu gösterilsin. Bir takımda 7 kişi dolduğunda o takımın butonu kilitlensin ve kalanlar mecburen boş takımı seçsin.

6. Yönetici Paneli: Sayfanın en altında sadece benim görebileceğim (veya basit bir butonla tetiklenen) "Haftayı Sıfırla" butonu olsun. Bu buton tüm listeyi temizleyip yeni hafta için hazır hale getirsin.

7. Tasarım modern, spor temalı (yeşil, koyu gri veya siyah tonlarında) ve tamamen mobil uyumlu olsun. Tarayıcıda (WhatsApp linkiyle girildiğinde) kusursuz çalışsın.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://team-rush.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8d350ff3-af6c-4faa-b3fb-255c380d2122).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
