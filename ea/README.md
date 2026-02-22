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
