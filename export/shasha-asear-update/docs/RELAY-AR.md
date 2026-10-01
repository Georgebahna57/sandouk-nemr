# مزامنة MT5 للموبايل والتلفزيون (رابط GitHub)

## الفكرة

1. **كمبيوتر المحل**: MT5 + `ShopPriceBridge` + `start-board.bat` + **`relay-publish`** يرفع `shop-board.json` للسحابة.
2. **التلفزيون / الهاتف / رابط GitHub**: يقرأ نفس الملف من `relay-config.json` → أسعار **نفس الوسيط**.

## إعداد Supabase (مرة واحدة)

1. من [Supabase](https://supabase.com) → مشروعك (يمكن نفس مشروع صناديق).
2. SQL Editor → شغّل `supabase/shop-board-storage.sql`.
3. Storage → تأكد أن bucket **`shop-board`** عام (Public).

## على كمبيوتر المحل

1. انسخ `relay.json.example` → `relay.json`.
2. عبّي:
   - `uploadUrl`: `https://PROJECT.supabase.co/storage/v1/object/shop-board/prices.json`
   - `apiKey`: **Service role key** (من Project Settings → API — لا ترفعه على GitHub).
3. شغّل **`start-board.bat`** (يفتح الشاشة المحلية + المزامنة تلقائياً).
4. تأكد MT5 والمؤشر **ShopPriceBridge** شغالين.

## للموبايل والتلفزيون (GitHub Pages)

1. انسخ `relay-config.json.example` → `relay-config.json`.
2. ضع **`feedUrl`** العام (نفس الملف بعد الرفع):
   `https://PROJECT.supabase.co/storage/v1/object/public/shop-board/prices.json`
3. `allowMarketFallback`: **`false`** حتى لا يعود لـ Binance إذا انقطع المحل.
4. ارفع `relay-config.json` على GitHub → بعد النشر، الأسفل يظهر **MT5 · موبايل/تلفزيون**.

## التلفزيون

- افتح رابط GitHub أو ثبّت التطبيق (PWA).
- من **Settings** اختر حجم الشاشة (32 / 41 / 50 بوصة).
- **Fullscreen** لملء الشاشة.

## الهاتف

- نفس الرابط أو APK — يقرأ `relay-config.json` تلقائياً.
- يمكن لصق `feedUrl` يدوياً في الإعدادات إن لزم.

## مطابقة MT5 حرفياً

في الإعدادات ضع خصم/علاوة = **0** لكل المعادن.
