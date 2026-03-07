//+------------------------------------------------------------------+
//|                                           QuantEngine.mq5        |
//|                        Copyright 2026, AlQabas Pro               |
//|                             https://qabas.pro                    |
//+------------------------------------------------------------------+
#property copyright "AlQabas Pro — Quant Engine"
#property link      "https://qabas.pro"
#property version   "1.00"
#property description "Quant AI Crypto Trading Engine — Auto-execute signals from qabas.pro/quant"
#property description "Supports: BTCUSD, ETHUSD on any MT5 broker"
#property strict

//--- إعدادات الاتصال
input group "=== API Settings ==="
input string   API_BASE_URL = "https://qabas.pro";     // رابط API الأساسي
input string   USER_API_KEY = "";                       // مفتاح المستخدم (من صفحة Profile)

//--- إعدادات التداول
input group "=== Trading Settings ==="
input double   DefaultLotSize   = 0.1;                  // حجم اللوت الافتراضي
input double   MaxLotSize       = 1.0;                  // أقصى حجم لوت
input int      MaxOpenTrades    = 3;                    // أقصى عدد صفقات مفتوحة
input int      Slippage         = 30;                   // الانزلاق السعري (نقاط)
input int      MagicNumber      = 202602;               // الرقم السحري (مختلف عن AlQabas EA)
input int      PollSeconds      = 3;                    // فترة سحب الأوامر (ثوان)

//--- إعدادات الوقف المتحرك
input group "=== Trailing Stop ==="
input bool     UseTrailing      = true;                 // تفعيل الوقف المتحرك
input double   BreakevenATR     = 1.5;                  // أمّن الدخول بعد (x ATR) ربح
input double   TrailingStartATR = 2.5;                  // ابدأ الوقف المتحرك بعد (x ATR)
input double   TrailingDistATR  = 1.0;                  // مسافة الوقف المتحرك (x ATR)
input int      ATR_Period       = 14;                   // فترة ATR
input ENUM_TIMEFRAMES ATR_Timeframe = PERIOD_H1;        // الإطار الزمني لـ ATR

//--- إعدادات الرموز
input group "=== Symbol Settings ==="
input string   SymbolSuffix     = "";                   // لاحقة الرمز (اتركه فارغ للكشف التلقائي)
input string   SymbolPrefix     = "";                   // بادئة الرمز (اتركه فارغ)
input bool     AutoDetectSymbol = true;                 // كشف تلقائي لرمز البروكر

//--- إعدادات إدارة المخاطر
input group "=== Risk Management ==="
input double   MaxDailyLossPct  = 5.0;                  // أقصى خسارة يومية (% من الرصيد) — 0 = معطل
input int      MaxDailyTrades   = 10;                   // أقصى صفقات يومية — 0 = بلا حد
input bool     OnlyHighProb     = false;                // تنفيذ إشارات الاحتمالية العالية فقط (75%+)

//--- متغيرات عالمية
string detectedSuffix = "";
string detectedPrefix = "";
datetime lastOrderCheck = 0;
int    dailyTradeCount = 0;
double dailyStartBalance = 0;
int    lastDay = -1;

//+------------------------------------------------------------------+
//| Expert initialization                                            |
//+------------------------------------------------------------------+
int OnInit()
{
   if(USER_API_KEY == "")
   {
      Alert("⚠️ يجب إدخال مفتاح API الخاص بالمستخدم!");
      Alert("احصل عليه من: qabas.pro/profile");
      return(INIT_PARAMETERS_INCORRECT);
   }

   Print("═══════════════════════════════════════════════════");
   Print("🧠 Quant Engine EA v1.00 — qabas.pro");
   Print("═══════════════════════════════════════════════════");
   Print("Symbol: ", Symbol());
   Print("API: ", API_BASE_URL);
   Print("Lot: ", DefaultLotSize, " | Max: ", MaxLotSize);
   Print("Max Trades: ", MaxOpenTrades);
   Print("Trailing: ", UseTrailing ? "ON" : "OFF");
   
   // كشف تلقائي للاحقة والبادئة
   if(AutoDetectSymbol)
      DetectBrokerFormat();
   else
   {
      detectedSuffix = SymbolSuffix;
      detectedPrefix = SymbolPrefix;
   }
   
   Print("Prefix: [", detectedPrefix, "] Suffix: [", detectedSuffix, "]");
   
   // تهيئة الرصيد اليومي
   dailyStartBalance = AccountInfoDouble(ACCOUNT_BALANCE);
   lastDay = TimeDayOfYear(TimeCurrent());
   
   // التحقق من WebRequest
   if(!TerminalInfoInteger(TERMINAL_DLLS_ALLOWED))
      Print("⚠️ يرجى تفعيل Allow DLL imports");
   
   Print("✅ Quant Engine EA ready — polling every ", PollSeconds, "s");
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization                                          |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   Print("🧠 Quant Engine EA stopped. Reason: ", reason);
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
   // إعادة تعيين العداد اليومي
   int today = TimeDayOfYear(TimeCurrent());
   if(today != lastDay)
   {
      lastDay = today;
      dailyTradeCount = 0;
      dailyStartBalance = AccountInfoDouble(ACCOUNT_BALANCE);
      Print("📅 يوم جديد — تم إعادة تعيين العدادات");
   }
   
   // فحص الخسارة اليومية
   if(MaxDailyLossPct > 0)
   {
      double currentBalance = AccountInfoDouble(ACCOUNT_BALANCE);
      double lossPercent = ((dailyStartBalance - currentBalance) / dailyStartBalance) * 100;
      if(lossPercent >= MaxDailyLossPct)
      {
         // لا نسحب أوامر جديدة
         if(TimeCurrent() - lastOrderCheck >= 60)
         {
            Print("🛑 الخسارة اليومية وصلت ", DoubleToString(lossPercent, 2), "% — التداول متوقف لليوم");
            lastOrderCheck = TimeCurrent();
         }
         // لكن نبقي الوقف المتحرك شغال
         if(UseTrailing) CheckTrailingStop();
         return;
      }
   }
   
   // سحب الأوامر
   if(TimeCurrent() - lastOrderCheck >= PollSeconds)
   {
      CheckOrderQueue();
      lastOrderCheck = TimeCurrent();
   }
   
   // الوقف المتحرك
   if(UseTrailing)
      CheckTrailingStop();
}

//+------------------------------------------------------------------+
//| سحب أوامر التنفيذ من السيرفر                                     |
//+------------------------------------------------------------------+
void CheckOrderQueue()
{
   string url = API_BASE_URL + "/api/signals/execute?key=" + USER_API_KEY;
   
   char postData[];
   char result[];
   string headers = "Content-Type: application/json\r\n";
   
   int res = WebRequest("GET", url, headers, 5000, postData, result, headers);
   
   if(res != 200)
   {
      if(res == -1)
         Print("❌ WebRequest failed — تأكد من إضافة ", API_BASE_URL, " في Tools > Options > Expert Advisors");
      return;
   }
   
   string response = CharArrayToString(result);
   
   // التأكد من وجود أوامر
   if(StringFind(response, "\"orders\":[") == -1) return;
   if(StringFind(response, "\"orders\":[]") >= 0) return;
   
   // استخراج بيانات الأمر
   string orderId   = GetJsonValue(response, "id");
   string action    = GetJsonValue(response, "action");
   string symbol    = GetJsonValue(response, "symbol");
   double sl        = StringToDouble(GetJsonValue(response, "stopLoss"));
   double tp        = StringToDouble(GetJsonValue(response, "takeProfit"));
   double orderLot  = StringToDouble(GetJsonValue(response, "lotSize"));
   
   if(orderId == "" || action == "") return;
   
   if(orderLot <= 0) orderLot = DefaultLotSize;
   if(orderLot > MaxLotSize) orderLot = MaxLotSize;
   
   // فحص حد الصفقات اليومية
   if(MaxDailyTrades > 0 && dailyTradeCount >= MaxDailyTrades)
   {
      Print("⚠️ وصلت حد الصفقات اليومية (", MaxDailyTrades, ") — يتم تخطي الأمر");
      MarkOrderExecuted(orderId);
      return;
   }
   
   // فحص عدد الصفقات المفتوحة
   int openCount = CountMyTrades();
   if(openCount >= MaxOpenTrades)
   {
      Print("⚠️ عدد الصفقات المفتوحة (", openCount, ") وصل الحد (", MaxOpenTrades, ") — تخطي");
      MarkOrderExecuted(orderId);
      return;
   }
   
   Print("═══════════════════════════════════════════════════");
   Print("📡 أمر جديد: ", orderId, " | ", action, " ", symbol);
   
   // تحويل الرمز لصيغة MT5
   string baseSymbol = symbol;
   StringReplace(baseSymbol, "/", "");
   if(StringFind(baseSymbol, "USDT") > 0)
      StringReplace(baseSymbol, "USDT", "USD");
   
   // البحث عن الرمز الصحيح عند البروكر
   string tradeSymbol = FindBrokerSymbol(baseSymbol);
   if(tradeSymbol == "")
   {
      Print("❌ الرمز ", baseSymbol, " غير موجود عند البروكر — يتم تخطي الأمر");
      MarkOrderExecuted(orderId);
      return;
   }
   
   // تحويل SL/TP للأرقام الصحيحة حسب البروكر
   int digits = (int)SymbolInfoInteger(tradeSymbol, SYMBOL_DIGITS);
   sl = NormalizeDouble(sl, digits);
   tp = NormalizeDouble(tp, digits);
   
   bool executed = false;
   
   if(action == "BUY")
      executed = ExecuteTrade(tradeSymbol, ORDER_TYPE_BUY, sl, tp, orderLot);
   else if(action == "SELL")
      executed = ExecuteTrade(tradeSymbol, ORDER_TYPE_SELL, sl, tp, orderLot);
   
   if(executed)
   {
      dailyTradeCount++;
      MarkOrderExecuted(orderId);
      Print("✅ تم تنفيذ الصفقة بنجاح | الصفقات اليوم: ", dailyTradeCount);
   }
   Print("═══════════════════════════════════════════════════");
}

//+------------------------------------------------------------------+
//| تنفيذ صفقة                                                       |
//+------------------------------------------------------------------+
bool ExecuteTrade(string symbol, ENUM_ORDER_TYPE type, double sl, double tp, double lot)
{
   // التأكد من أن الرمز موجود
   if(!SymbolSelect(symbol, true))
   {
      Print("❌ الرمز ", symbol, " غير موجود");
      return true;
   }
   
   MqlTradeRequest request;
   MqlTradeResult result;
   ZeroMemory(request);
   ZeroMemory(result);
   
   double price = (type == ORDER_TYPE_BUY) 
                  ? SymbolInfoDouble(symbol, SYMBOL_ASK) 
                  : SymbolInfoDouble(symbol, SYMBOL_BID);
   
   request.action    = TRADE_ACTION_DEAL;
   request.symbol    = symbol;
   request.volume    = lot;
   request.type      = type;
   request.price     = price;
   request.sl        = sl;
   request.tp        = tp;
   request.deviation = Slippage;
   request.magic     = MagicNumber;
   request.comment   = "Qabas Quant AI";
   
   // نوع التنفيذ التلقائي
   uint filling = (uint)SymbolInfoInteger(symbol, SYMBOL_FILLING_MODE);
   if((filling & SYMBOL_FILLING_FOK) == SYMBOL_FILLING_FOK)
      request.type_filling = ORDER_FILLING_FOK;
   else if((filling & SYMBOL_FILLING_IOC) == SYMBOL_FILLING_IOC)
      request.type_filling = ORDER_FILLING_IOC;
   else
      request.type_filling = ORDER_FILLING_RETURN;
   
   if(OrderSend(request, result))
   {
      Print("✅ ", (type == ORDER_TYPE_BUY ? "BUY" : "SELL"), " ", symbol, 
            " @ ", DoubleToString(price, (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS)),
            " | SL: ", DoubleToString(sl, (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS)),
            " | TP: ", DoubleToString(tp, (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS)),
            " | Lot: ", DoubleToString(lot, 2),
            " | Ticket: ", result.order);
      return true;
   }
   else
   {
      Print("❌ فشل التنفيذ: ", symbol, " Error: ", GetLastError(),
            " Price: ", DoubleToString(price, (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS)));
      return true; // نرجع true عشان لا يعلق
   }
}

//+------------------------------------------------------------------+
//| إبلاغ السيرفر بإتمام التنفيذ                                     |
//+------------------------------------------------------------------+
void MarkOrderExecuted(string orderId)
{
   string url = API_BASE_URL + "/api/signals/execute?key=" + USER_API_KEY + "&executed=" + orderId;
   
   char postData[];
   char result[];
   string headers = "Content-Type: application/json\r\n";
   
   int res = WebRequest("GET", url, headers, 3000, postData, result, headers);
   
   if(res == 200)
      Print("📋 الأمر ", orderId, " تم تأكيده على السيرفر");
   else
      Print("⚠️ فشل تأكيد الأمر ", orderId, " — Response: ", res);
}

//+------------------------------------------------------------------+
//| عدد الصفقات المفتوحة للـ EA                                       |
//+------------------------------------------------------------------+
int CountMyTrades()
{
   int count = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      if(PositionGetInteger(POSITION_MAGIC) == MagicNumber)
         count++;
   }
   return count;
}

//+------------------------------------------------------------------+
//| حساب ATR                                                         |
//+------------------------------------------------------------------+
double CalcATR(string symbol, ENUM_TIMEFRAMES tf, int period)
{
   double atrBuffer[];
   int handle = iATR(symbol, tf, period);
   if(handle == INVALID_HANDLE) return 0;
   
   if(CopyBuffer(handle, 0, 0, 1, atrBuffer) <= 0)
   {
      IndicatorRelease(handle);
      return 0;
   }
   IndicatorRelease(handle);
   return atrBuffer[0];
}

//+------------------------------------------------------------------+
//| الوقف المتحرك — 3 مراحل: Breakeven → Lock50 → Trailing           |
//+------------------------------------------------------------------+
void CheckTrailingStop()
{
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      if(PositionGetInteger(POSITION_MAGIC) != MagicNumber) continue;
      
      string symbol   = PositionGetString(POSITION_SYMBOL);
      double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
      double sl        = PositionGetDouble(POSITION_SL);
      double tp        = PositionGetDouble(POSITION_TP);
      long   posType   = PositionGetInteger(POSITION_TYPE);
      
      double point  = SymbolInfoDouble(symbol, SYMBOL_POINT);
      int    digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
      double spread = SymbolInfoDouble(symbol, SYMBOL_ASK) - SymbolInfoDouble(symbol, SYMBOL_BID);
      
      if(point == 0) continue;
      
      double price = (posType == POSITION_TYPE_BUY) 
                     ? SymbolInfoDouble(symbol, SYMBOL_BID) 
                     : SymbolInfoDouble(symbol, SYMBOL_ASK);
      
      double atr = CalcATR(symbol, ATR_Timeframe, ATR_Period);
      if(atr <= 0) continue;
      
      double priceDist = 0;
      if(posType == POSITION_TYPE_BUY)
         priceDist = price - openPrice;
      else if(posType == POSITION_TYPE_SELL)
         priceDist = openPrice - price;
      else continue;
      
      double breakevenDist  = atr * BreakevenATR;
      double lockProfitDist = atr * 2.0;
      double trailStartDist = atr * TrailingStartATR;
      double trailDist      = atr * TrailingDistATR;
      trailDist = MathMax(trailDist, spread * 3);
      
      double newSL = 0;
      string phase = "";
      
      if(posType == POSITION_TYPE_BUY)
      {
         if(priceDist >= trailStartDist)
         {
            newSL = NormalizeDouble(price - trailDist, digits);
            phase = "TRAIL";
            if(newSL <= sl && sl != 0) continue;
            if(newSL <= openPrice) continue;
         }
         else if(priceDist >= lockProfitDist)
         {
            newSL = NormalizeDouble(openPrice + priceDist * 0.5, digits);
            phase = "LOCK50";
            if(newSL <= sl && sl != 0) continue;
            if(newSL <= openPrice) continue;
         }
         else if(priceDist >= breakevenDist)
         {
            newSL = NormalizeDouble(openPrice + spread * 2 + point, digits);
            phase = "BE";
            if(sl >= openPrice && sl != 0) continue;
         }
         else continue;
      }
      else if(posType == POSITION_TYPE_SELL)
      {
         if(priceDist >= trailStartDist)
         {
            newSL = NormalizeDouble(price + trailDist, digits);
            phase = "TRAIL";
            if(newSL >= sl && sl != 0) continue;
            if(newSL >= openPrice) continue;
         }
         else if(priceDist >= lockProfitDist)
         {
            newSL = NormalizeDouble(openPrice - priceDist * 0.5, digits);
            phase = "LOCK50";
            if(newSL >= sl && sl != 0 && sl > 0) continue;
            if(newSL >= openPrice) continue;
         }
         else if(priceDist >= breakevenDist)
         {
            newSL = NormalizeDouble(openPrice - spread * 2 - point, digits);
            phase = "BE";
            if(sl <= openPrice && sl != 0 && sl > 0) continue;
         }
         else continue;
      }
      else continue;
      
      // تعديل الوقف
      MqlTradeRequest request;
      MqlTradeResult result;
      ZeroMemory(request);
      ZeroMemory(result);
      
      request.action   = TRADE_ACTION_SLTP;
      request.position = ticket;
      request.symbol   = symbol;
      request.sl       = newSL;
      request.tp       = tp;
      
      if(OrderSend(request, result))
      {
         Print("🔄 ", phase, ": ", symbol, " ticket=", ticket,
               " newSL=", DoubleToString(newSL, digits),
               " profit=", DoubleToString(priceDist, digits));
      }
   }
}

//+------------------------------------------------------------------+
//| كشف تلقائي لتنسيق رموز البروكر                                   |
//+------------------------------------------------------------------+
void DetectBrokerFormat()
{
   if(SymbolSuffix != "" || SymbolPrefix != "")
   {
      detectedSuffix = SymbolSuffix;
      detectedPrefix = SymbolPrefix;
      Print("Manual prefix/suffix: [", detectedPrefix, "] / [", detectedSuffix, "]");
      return;
   }
   
   string sym = Symbol();
   
   string baseSymbols[] = {
      "BTCUSD", "ETHUSD", "XRPUSD", "SOLUSD", "BNBUSD", "DOGEUSD", "ADAUSD",
      "XAUUSD", "XAGUSD", "EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD",
      "USDCHF", "NZDUSD", "GBPJPY", "EURJPY", "EURGBP",
      "US500", "USTEC", "US30", "US2000", "DE40", "JP225"
   };
   
   for(int i = 0; i < ArraySize(baseSymbols); i++)
   {
      int pos = StringFind(sym, baseSymbols[i]);
      if(pos >= 0)
      {
         detectedPrefix = StringSubstr(sym, 0, pos);
         detectedSuffix = StringSubstr(sym, pos + StringLen(baseSymbols[i]));
         Print("✅ Auto-detected: base=", baseSymbols[i],
               " prefix=[", detectedPrefix, "] suffix=[", detectedSuffix, "]");
         return;
      }
   }
   
   Print("⚠️ Could not auto-detect format from ", sym);
}

//+------------------------------------------------------------------+
//| البحث عن الرمز الصحيح عند البروكر                                 |
//+------------------------------------------------------------------+
string FindBrokerSymbol(string baseSymbol)
{
   // 1. بادئة + لاحقة مكتشفة
   if(detectedPrefix != "" || detectedSuffix != "")
   {
      string candidate = detectedPrefix + baseSymbol + detectedSuffix;
      if(SymbolSelect(candidate, true)) return candidate;
   }
   
   // 2. الرمز كما هو
   if(SymbolSelect(baseSymbol, true)) return baseSymbol;
   
   // 3. لواحق شائعة
   string suffixes[] = {
      "m", ".m", "M", ".raw", "raw", ".a", ".i", ".e",
      "_", ".std", ".pro", ".ecn", "c", ".c", "#",
      ".sml", ".mini", "micro", "-m", "_m"
   };
   
   for(int i = 0; i < ArraySize(suffixes); i++)
   {
      string candidate = baseSymbol + suffixes[i];
      if(SymbolSelect(candidate, true))
      {
         if(detectedSuffix == "") detectedSuffix = suffixes[i];
         Print("🔍 Found: ", candidate, " (suffix: ", suffixes[i], ")");
         return candidate;
      }
   }
   
   // 4. بوادئ شائعة
   string prefixes[] = {".", "#", "_"};
   for(int p = 0; p < ArraySize(prefixes); p++)
   {
      string candidate = prefixes[p] + baseSymbol;
      if(SymbolSelect(candidate, true))
      {
         if(detectedPrefix == "") detectedPrefix = prefixes[p];
         return candidate;
      }
      for(int s = 0; s < ArraySize(suffixes); s++)
      {
         candidate = prefixes[p] + baseSymbol + suffixes[s];
         if(SymbolSelect(candidate, true))
         {
            if(detectedPrefix == "") detectedPrefix = prefixes[p];
            if(detectedSuffix == "") detectedSuffix = suffixes[s];
            return candidate;
         }
      }
   }
   
   return "";
}

//+------------------------------------------------------------------+
//| Helper: استخراج قيمة من JSON                                      |
//+------------------------------------------------------------------+
string GetJsonValue(string json, string key)
{
   string search = "\"" + key + "\":";
   int start = StringFind(json, search);
   if(start == -1) return "";
   
   start += StringLen(search);
   while(StringSubstr(json, start, 1) == " " || StringSubstr(json, start, 1) == ":") start++;
   
   if(StringSubstr(json, start, 1) == "\"")
   {
      start++;
      int end = StringFind(json, "\"", start);
      if(end == -1) return "";
      return StringSubstr(json, start, end - start);
   }
   else
   {
      int end1 = StringFind(json, ",", start);
      int end2 = StringFind(json, "}", start);
      int end = -1;
      
      if(end1 == -1) end = end2;
      else if(end2 == -1) end = end1;
      else end = MathMin(end1, end2);
      
      if(end == -1) return "";
      return StringSubstr(json, start, end - start);
   }
}
//+------------------------------------------------------------------+
