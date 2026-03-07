# القبس - AlQabas MT5 Expert Advisor

## التثبيت

### 1. انسخ ملف الـ EA
انسخ ملف `AlQabas.mq5` إلى مجلد الـ Experts في MT5:
```
C:\Users\[اسمك]\AppData\Roaming\MetaQuotes\Terminal\[ID]\MQL5\Experts\
```

أو من داخل MT5:
- افتح **MetaEditor** (F4)
- اضغط **File > Open Data Folder**
- روح لمجلد `MQL5\Experts`
- الصق الملف هناك

### 2. Compile الـ EA
- افتح **MetaEditor** (F4)
- افتح ملف `AlQabas.mq5`
- اضغط **Compile** (F7)
- تأكد ما فيه أخطاء

### 3. السماح بـ WebRequest
- في MT5 روح لـ **Tools > Options > Expert Advisors**
- فعّل **Allow WebRequest for listed URL**
- أضف: `https://qabas.pro`
- اضغط OK

### 4. تشغيل الـ EA
- اسحب الـ EA على أي شارت (مثلاً BTCUSD)
- في نافذة الإعدادات:
  - **API Key**: حط مفتاح الـ API حقك
  - **Lot Size**: حجم الصفقة (مثلاً 0.1)
  - **Max Trades**: أقصى عدد صفقات مفتوحة
  - **Symbol Suffix**: لاحقة الرمز عند البروكر (مثلاً `m` لـ Exness)
- فعّل **Allow Algo Trading** ✅
- اضغط OK

## الإعدادات

| الإعداد | الوصف | القيمة الافتراضية |
|---|---|---|
| API Key | مفتاح الوصول للإشارات | (مطلوب) |
| Poll Seconds | فترة سحب الإشارات | 5 ثوانٍ |
| Interval | إطار الشموع | 5m |
| Lot Size | حجم الصفقة | 0.1 |
| Max Trades | أقصى صفقات مفتوحة | 3 |
| Strong Only | إشارات قوية فقط | false |
| Symbol Suffix | لاحقة الرمز | (فارغ) |
| Max Daily Loss | أقصى خسارة يومية | 0 (معطل) |
| Max Daily Trades | أقصى صفقات يومية | 0 (بلا حد) |

## لاحقة الرمز حسب البروكر

| البروكر | Suffix | مثال |
|---|---|---|
| Exness | m | BTCUSDm |
| XM | (فارغ) | BTCUSD |
| IC Markets | .a | BTCUSD.a |
| Pepperstone | (فارغ) | BTCUSD |

## استكشاف الأخطاء

- **"WebRequest not allowed"**: تأكد إنك أضفت الرابط في Tools > Options > Expert Advisors
- **"API Key is required"**: حط مفتاح الـ API في إعدادات الـ EA
- **"Symbol not found"**: تأكد من لاحقة الرمز (Suffix) الصحيحة لبروكرك
- **ما يفتح صفقات**: تأكد إن Algo Trading مفعّل (الزر الأخضر في الشريط العلوي)

---

# 🧠 QuantEngine EA — المحرك الكمي المؤسسي

EA مخصص لتنفيذ إشارات **المحرك الكمي AI** تلقائياً من صفحة `qabas.pro/quant`.

## كيف يعمل؟

1. تفتح صفحة **المحرك الكمي** على `qabas.pro/quant`
2. المحرك يحلل السوق عبر **11 طبقة تحليل** ويطلع إشارة شراء/بيع
3. تضغط زر **"تنفيذ شراء"** أو **"تنفيذ بيع"** على الموقع
4. الأمر يتحول لـ queue على السيرفر
5. الـ **QuantEngine EA** على MT5 يسحب الأمر وينفذه تلقائياً

## التثبيت

### 1. انسخ الملف
انسخ `QuantEngine.mq5` إلى:
```
C:\Users\[اسمك]\AppData\Roaming\MetaQuotes\Terminal\[ID]\MQL5\Experts\
```

### 2. Compile
- افتح **MetaEditor** (F4)
- افتح `QuantEngine.mq5`
- اضغط **Compile** (F7)

### 3. السماح بـ WebRequest
- في MT5: **Tools > Options > Expert Advisors**
- فعّل **Allow WebRequest for listed URL**
- أضف: `https://qabas.pro`

### 4. التشغيل
- اسحب **QuantEngine** على شارت BTCUSD أو ETHUSD
- أدخل **مفتاح API** حقك (من qabas.pro/profile)
- فعّل **Allow Algo Trading** ✅

## إعدادات QuantEngine EA

### إعدادات API
| الإعداد | الوصف | القيمة الافتراضية |
|---|---|---|
| API_BASE_URL | رابط المنصة | https://qabas.pro |
| USER_API_KEY | مفتاح المستخدم | (مطلوب) |

### إعدادات التداول
| الإعداد | الوصف | القيمة الافتراضية |
|---|---|---|
| DefaultLotSize | حجم اللوت الافتراضي | 0.1 |
| MaxLotSize | أقصى حجم لوت | 1.0 |
| MaxOpenTrades | أقصى صفقات مفتوحة | 3 |
| Slippage | الانزلاق السعري | 30 |
| MagicNumber | الرقم السحري | 202602 |
| PollSeconds | فترة سحب الأوامر (ثوان) | 3 |

### إعدادات الوقف المتحرك
| الإعداد | الوصف | القيمة الافتراضية |
|---|---|---|
| UseTrailing | تفعيل الوقف المتحرك | true |
| BreakevenATR | أمّن الدخول بعد (x ATR) | 1.5 |
| TrailingStartATR | ابدأ الوقف المتحرك بعد (x ATR) | 2.5 |
| TrailingDistATR | مسافة الوقف المتحرك (x ATR) | 1.0 |

### إعدادات إدارة المخاطر
| الإعداد | الوصف | القيمة الافتراضية |
|---|---|---|
| MaxDailyLossPct | أقصى خسارة يومية (%) | 5.0 |
| MaxDailyTrades | أقصى صفقات يومية | 10 |
| OnlyHighProb | إشارات 75%+ فقط | false |

## ميزات QuantEngine EA

- **تنفيذ تلقائي** من المحرك الكمي AI
- **وقف متحرك 3 مراحل**: Breakeven → Lock 50% → Trailing
- **كشف تلقائي** لرمز البروكر (BTCUSDm, BTCUSD.a, etc.)
- **حماية الخسارة اليومية** — يتوقف تلقائياً عند الوصول للحد
- **حد الصفقات اليومية** — ما يزيد عن العدد المحدد
- **MagicNumber مختلف** عن AlQabas EA (يمكن تشغيلهم معاً)

## الفرق بين AlQabas EA و QuantEngine EA

| | AlQabas EA | QuantEngine EA |
|---|---|---|
| المصدر | جميع إشارات المنصة | المحرك الكمي AI فقط |
| MagicNumber | 202601 | 202602 |
| التركيز | كريبتو + فوركس + أسهم | BTCUSD + ETHUSD |
| الوقف المتحرك | 3 مراحل | 3 مراحل |
| إدارة المخاطر | أساسية | متقدمة (خسارة يومية + حد صفقات) |
| التشغيل معاً | ✅ نعم | ✅ نعم |
