//+------------------------------------------------------------------+
//|                                              AlQabas.mq5         |
//|                        Copyright 2026, AlQabas Pro               |
//|                             https://qabas.pro                    |
//+------------------------------------------------------------------+
#property copyright "AlQabas Pro"
#property link      "https://qabas.pro"
#property version   "1.06"
#property description "AlQabas EA - Auto-detect broker symbols & execute trades"
#property strict

//--- إعدادات الاتصال بالخادم
input group "=== API Settings ==="
input string   API_BASE_URL = "https://qabas.pro";     // رابط API الأساسي
input string   USER_API_KEY = "";                      // مفتاح المستخدم (من صفحة Profile)
input string   EA_API_KEY   = "ts_ea_test_key_2026_rami12200"; // مفتاح EA (لا تغيره)

//--- إعدادات التداول
input group "=== Trading Settings ==="
input double   LotSize      = 0.1;                     // حجم اللوت
input int      MaxTrades    = 5;                       // أقصى عدد صفقات مفتوحة
input int      Slippage     = 30;                      // الانزلاق السعري (نقاط)
input int      MagicNumber  = 202601;                  // الرقم السحري للصفقات
input bool     UseTrailing  = true;                    // تفعيل الوقف المتحرك
input double   BreakevenATR = 1.5;                     // أمّن الدخول بعد (x ATR) ربح
input double   TrailingStartATR = 2.5;                 // ابدأ الوقف المتحرك بعد (x ATR) ربح
input double   TrailingDistATR = 1.0;                  // مسافة الوقف المتحرك (x ATR)
input int      ATR_Period = 14;                        // فترة ATR
input ENUM_TIMEFRAMES ATR_Timeframe = PERIOD_H1;      // الإطار الزمني لـ ATR

//--- إعدادات الرموز
input group "=== Symbol Settings ==="
input string   SymbolSuffix = "";                      // لاحقة الرمز (اتركه فارغ للكشف التلقائي)
input string   SymbolPrefix = "";                      // بادئة الرمز (اتركه فارغ للكشف التلقائي)
input bool     AutoDetectSymbol = true;                 // كشف تلقائي لرمز البروكر

//--- متغيرات عالمية
string currentSymbol;
string detectedSuffix = "";
string detectedPrefix = "";
datetime lastSignalCheck = 0;
datetime lastOrderCheck = 0;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   if(USER_API_KEY == "")
   {
      Alert("تنبيه: يجب إدخال مفتاح API الخاص بالمستخدم في إعدادات الـ EA!");
      return(INIT_PARAMETERS_INCORRECT);
   }

   currentSymbol = Symbol();
   Print("AlQabas EA initialized for: ", currentSymbol);
   Print("API Base URL: ", API_BASE_URL);
   
   // كشف تلقائي للاحقة والبادئة من الرمز الحالي
   if(AutoDetectSymbol)
   {
      DetectBrokerFormat();
   }
   else
   {
      detectedSuffix = SymbolSuffix;
      detectedPrefix = SymbolPrefix;
   }
   
   Print("Detected Prefix: [", detectedPrefix, "] Suffix: [", detectedSuffix, "]");
   
   // السماح بـ WebRequest
   if(!TerminalInfoInteger(TERMINAL_DLLS_ALLOWED))
   {
      Print("تنبيه: يرجى تفعيل Allow DLL imports");
   }
   
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   Print("EA deinitialized");
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
   // التحقق من أوامر التنفيذ المباشرة كل 2 ثانية (سريع للتجاوب)
   if(TimeCurrent() - lastOrderCheck >= 2)
   {
      CheckOrderQueue();
      lastOrderCheck = TimeCurrent();
   }
   
   // تفعيل Trailing Stop
   if(UseTrailing)
   {
      CheckTrailingStop();
   }
}

//+------------------------------------------------------------------+
//| حساب ATR لرمز معين                                               |
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
//| وظيفة الوقف المتحرك — مرحلتين: Breakeven ثم Trailing             |
//| المرحلة 1: لما الربح يوصل BreakevenATR × ATR → وقف = سعر الدخول  |
//| المرحلة 2: لما الربح يوصل TrailingStartATR × ATR → وقف يتحرك     |
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
      
      // السعر الحالي حسب نوع الصفقة
      double price = (posType == POSITION_TYPE_BUY) 
                     ? SymbolInfoDouble(symbol, SYMBOL_BID) 
                     : SymbolInfoDouble(symbol, SYMBOL_ASK);
      
      // حساب ATR
      double atr = CalcATR(symbol, ATR_Timeframe, ATR_Period);
      if(atr <= 0) continue;
      
      // حساب المسافة من سعر الدخول
      double priceDist = 0;
      if(posType == POSITION_TYPE_BUY)
         priceDist = price - openPrice;
      else if(posType == POSITION_TYPE_SELL)
         priceDist = openPrice - price;
      else continue;
      
      // === المراحل الثلاث ===
      // المرحلة 1: Breakeven — أمّن الدخول (1.5x ATR)
      // المرحلة 2: Lock Profit — أقفل 50% من الربح (2.0x ATR)
      // المرحلة 3: Trailing — تابع السعر بمسافة 1.0x ATR (2.5x ATR+)
      
      double breakevenDist   = atr * BreakevenATR;       // 1.5 × ATR
      double lockProfitDist  = atr * 2.0;                // 2.0 × ATR — مرحلة جديدة
      double trailStartDist  = atr * TrailingStartATR;   // 2.5 × ATR
      double trailDist       = atr * TrailingDistATR;    // 1.0 × ATR
      trailDist = MathMax(trailDist, spread * 3);        // حد أدنى = 3x السبريد (أفضل من 10 نقاط ثابتة)
      
      double newSL = 0;
      string phase = "";
      
      if(posType == POSITION_TYPE_BUY)
      {
         if(priceDist >= trailStartDist)
         {
            // المرحلة 3: Trailing — الوقف يتحرك مع السعر
            newSL = NormalizeDouble(price - trailDist, digits);
            phase = "TRAIL";
            if(newSL <= sl && sl != 0) continue;
            if(newSL <= openPrice) continue;
         }
         else if(priceDist >= lockProfitDist)
         {
            // المرحلة 2: Lock Profit — أقفل 50% من الربح المحقق
            newSL = NormalizeDouble(openPrice + priceDist * 0.5, digits);
            phase = "LOCK50";
            if(newSL <= sl && sl != 0) continue;
            if(newSL <= openPrice) continue;
         }
         else if(priceDist >= breakevenDist)
         {
            // المرحلة 1: Breakeven — أمّن سعر الدخول + هامش صغير
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
            // المرحلة 3: Trailing
            newSL = NormalizeDouble(price + trailDist, digits);
            phase = "TRAIL";
            if(newSL >= sl && sl != 0) continue;
            if(newSL >= openPrice) continue;
         }
         else if(priceDist >= lockProfitDist)
         {
            // المرحلة 2: Lock Profit — أقفل 50% من الربح المحقق
            newSL = NormalizeDouble(openPrice - priceDist * 0.5, digits);
            phase = "LOCK50";
            if(newSL >= sl && sl != 0 && sl > 0) continue;
            if(newSL >= openPrice) continue;
         }
         else if(priceDist >= breakevenDist)
         {
            // المرحلة 1: Breakeven
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
         Print(phase, ": ", symbol, " ticket=", ticket,
               " open=", DoubleToString(openPrice, digits),
               " price=", DoubleToString(price, digits),
               " newSL=", DoubleToString(newSL, digits),
               " ATR=", DoubleToString(atr, digits),
               " profit=", DoubleToString(priceDist, digits));
      }
      else
      {
         Print("Failed to ", phase, " ", symbol, " ticket=", ticket, " Error: ", GetLastError());
      }
   }
}

//+------------------------------------------------------------------+
//| كشف تلقائي لتنسيق رموز البروكر                                   |
//+------------------------------------------------------------------+
void DetectBrokerFormat()
{
   // إذا المستخدم حدد يدوياً، نستخدم قيمه
   if(SymbolSuffix != "" || SymbolPrefix != "")
   {
      detectedSuffix = SymbolSuffix;
      detectedPrefix = SymbolPrefix;
      Print("Using manual prefix/suffix: [", detectedPrefix, "] / [", detectedSuffix, "]");
      return;
   }
   
   // نحلل الرمز الحالي على الشارت لاكتشاف البادئة واللاحقة
   // مثلاً: BTCUSDm → suffix = "m"
   //        .BTCUSDraw → prefix = "." suffix = "raw"
   //        BTCUSD → no suffix
   
   string sym = currentSymbol;
   
   // قائمة الرموز الأساسية المعروفة
   string baseSymbols[] = {
      "BTCUSD", "ETHUSD", "XRPUSD", "SOLUSD", "BNBUSD", "DOGEUSD", "ADAUSD",
      "XAUUSD", "XAGUSD", "EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD",
      "USDCHF", "NZDUSD", "GBPJPY", "EURJPY", "EURGBP"
   };
   
   for(int i = 0; i < ArraySize(baseSymbols); i++)
   {
      int pos = StringFind(sym, baseSymbols[i]);
      if(pos >= 0)
      {
         detectedPrefix = StringSubstr(sym, 0, pos);
         detectedSuffix = StringSubstr(sym, pos + StringLen(baseSymbols[i]));
         Print("Auto-detected from ", sym, ": base=", baseSymbols[i], " prefix=[", detectedPrefix, "] suffix=[", detectedSuffix, "]");
         return;
      }
   }
   
   Print("Could not auto-detect suffix from ", sym, ". Will try smart matching.");
}

//+------------------------------------------------------------------+
//| البحث عن الرمز الصحيح عند البروكر                                 |
//+------------------------------------------------------------------+
string FindBrokerSymbol(string baseSymbol)
{
   // 1. إذا عندنا prefix/suffix مكتشفة، نجرب أولاً
   if(detectedPrefix != "" || detectedSuffix != "")
   {
      string candidate = detectedPrefix + baseSymbol + detectedSuffix;
      if(SymbolSelect(candidate, true)) return candidate;
   }
   
   // 2. نجرب الرمز كما هو
   if(SymbolSelect(baseSymbol, true)) return baseSymbol;
   
   // 3. نجرب لواحق شائعة لكل البروكرات
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
         // نحفظ اللاحقة المكتشفة للاستخدام لاحقاً
         if(detectedSuffix == "") detectedSuffix = suffixes[i];
         Print("Found broker symbol: ", candidate, " (suffix: ", suffixes[i], ")");
         return candidate;
      }
   }
   
   // 4. نجرب بوادئ شائعة
   string prefixes[] = {".", "#", "_"};
   for(int p = 0; p < ArraySize(prefixes); p++)
   {
      string candidate = prefixes[p] + baseSymbol;
      if(SymbolSelect(candidate, true))
      {
         if(detectedPrefix == "") detectedPrefix = prefixes[p];
         Print("Found broker symbol: ", candidate, " (prefix: ", prefixes[p], ")");
         return candidate;
      }
      // بادئة + لاحقة
      for(int s = 0; s < ArraySize(suffixes); s++)
      {
         candidate = prefixes[p] + baseSymbol + suffixes[s];
         if(SymbolSelect(candidate, true))
         {
            if(detectedPrefix == "") detectedPrefix = prefixes[p];
            if(detectedSuffix == "") detectedSuffix = suffixes[s];
            Print("Found broker symbol: ", candidate);
            return candidate;
         }
      }
   }
   
   Print("Warning: Could not find broker symbol for ", baseSymbol);
   return "";
}

//+------------------------------------------------------------------+
//| Helper: Simple JSON Value Extractor                              |
//+------------------------------------------------------------------+
string GetJsonValue(string json, string key)
{
   string search = "\"" + key + "\":";
   int start = StringFind(json, search);
   if(start == -1) return "";
   
   start += StringLen(search);
   
   // تنظيف المسافات البادئة
   while(StringSubstr(json, start, 1) == " " || StringSubstr(json, start, 1) == ":") start++;
   
   // هل هي قيمة نصية؟
   if(StringSubstr(json, start, 1) == "\"")
   {
      start++; // تخطي علامة الاقتباس
      int end = StringFind(json, "\"", start);
      if(end == -1) return "";
      return StringSubstr(json, start, end - start);
   }
   else
   {
      // قيمة رقمية أو منطقية (تنتهي بفاصلة أو قوس إغلاق)
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
//| التحقق من طلبات التنفيذ المعلقة                                  |
//+------------------------------------------------------------------+
void CheckOrderQueue()
{
   string url = API_BASE_URL + "/api/signals/execute?key=" + USER_API_KEY;
   
   char data[];
   char result[];
   string headers = "Content-Type: application/json\r\n";
   
   int res = WebRequest("GET", url, headers, 3000, data, result, headers);
   
   if(res == 200)
   {
      string response = CharArrayToString(result);
      
      // التأكد من وجود أوامر
      if(StringFind(response, "\"orders\":[") == -1) return;
      if(StringFind(response, "\"orders\":[]") >= 0) return;
      
      // استخراج بيانات أول أمر في القائمة
      string orderId = GetJsonValue(response, "id");
      string action = GetJsonValue(response, "action");
      string symbol = GetJsonValue(response, "symbol");
      double sl = StringToDouble(GetJsonValue(response, "stopLoss"));
      double tp = StringToDouble(GetJsonValue(response, "takeProfit"));
      double orderLot = StringToDouble(GetJsonValue(response, "lotSize"));
      if(orderLot <= 0) orderLot = LotSize; // fallback to input LotSize
      
      if(orderId == "" || action == "") return;
      
      Print("Found pending order: ", orderId, " Action: ", action, " Symbol: ", symbol);
      
      // تحويل الرمز لصيغة MT5
      // Binance: BTCUSDT → BTCUSD
      // Twelve Data: XAU/USD → XAUUSD, EUR/USD → EURUSD
      string baseSymbol = symbol;
      StringReplace(baseSymbol, "/", "");  // شيل / من XAU/USD → XAUUSD
      if(StringFind(baseSymbol, "USDT") > 0) StringReplace(baseSymbol, "USDT", "USD");
      
      // البحث التلقائي عن الرمز الصحيح عند البروكر
      string tradeSymbol = FindBrokerSymbol(baseSymbol);
      if(tradeSymbol == "")
      {
         Print("Error: Cannot find symbol ", baseSymbol, " at this broker. Skipping order ", orderId);
         MarkOrderExecuted(orderId);
         return;
      }
      
      bool executed = false;
      
      if(action == "BUY")
      {
         executed = ExecuteTrade(tradeSymbol, ORDER_TYPE_BUY, sl, tp, orderLot);
      }
      else if(action == "SELL")
      {
         executed = ExecuteTrade(tradeSymbol, ORDER_TYPE_SELL, sl, tp, orderLot);
      }
      
      if(executed)
      {
         MarkOrderExecuted(orderId);
      }
   }
}

//+------------------------------------------------------------------+
//| إبلاغ السيرفر بإتمام التنفيذ                                     |
//+------------------------------------------------------------------+
void MarkOrderExecuted(string orderId)
{
   string url = API_BASE_URL + "/api/signals/execute?key=" + USER_API_KEY + "&executed=" + orderId;
   
   char data[];
   char result[];
   string headers = "Content-Type: application/json\r\n";
   
   int res = WebRequest("GET", url, headers, 3000, data, result, headers);
   
   if(res == 200)
   {
      Print("Order ", orderId, " marked as EXECUTED on server.");
   }
   else
   {
      Print("Failed to mark order as executed. Server response: ", res);
   }
}

//+------------------------------------------------------------------+
//| تنفيذ صفقة                                                       |
//+------------------------------------------------------------------+
bool ExecuteTrade(string symbol, ENUM_ORDER_TYPE type, double sl, double tp, double lot = 0)
{
   // التحقق من عدم وجود صفقات مفتوحة كثيرة
   if(OrdersTotal() >= MaxTrades) 
   {
      Print("Max trades reached. Skipping.");
      return true; // نرجع true لنلغي الأمر من السيرفر حتى لا يعلق
   }
   
   // التأكد من أن الرمز موجود في Market Watch
   if(!SymbolSelect(symbol, true))
   {
      Print("Error: Symbol ", symbol, " not found or cannot be selected.");
      return true; // نعتبره تم التنفيذ (فشل) لكي لا يعلق
   }
   
   MqlTradeRequest request;
   MqlTradeResult result;
   ZeroMemory(request);
   ZeroMemory(result);
   
   double tradeLot = (lot > 0) ? lot : LotSize;
   request.action = TRADE_ACTION_DEAL;
   request.symbol = symbol;
   request.volume = tradeLot;
   request.type = type;
   request.price = (type == ORDER_TYPE_BUY) ? SymbolInfoDouble(symbol, SYMBOL_ASK) : SymbolInfoDouble(symbol, SYMBOL_BID);
   request.sl = sl;
   request.tp = tp;
   request.deviation = Slippage;
   request.magic = MagicNumber;
   request.comment = "Qabas.pro Signal";
   
   // تحديد نوع التنفيذ تلقائياً لتجنب الخطأ 4756
   uint filling = (uint)SymbolInfoInteger(symbol, SYMBOL_FILLING_MODE);
   if((filling & SYMBOL_FILLING_FOK) == SYMBOL_FILLING_FOK)
      request.type_filling = ORDER_FILLING_FOK;
   else if((filling & SYMBOL_FILLING_IOC) == SYMBOL_FILLING_IOC)
      request.type_filling = ORDER_FILLING_IOC;
   else
      request.type_filling = ORDER_FILLING_RETURN;
   
   if(OrderSend(request, result))
   {
      Print("Trade executed successfully: ", result.order, " on ", symbol);
      return true;
   }
   else
   {
      Print("Error executing trade on ", symbol, ": ", GetLastError());
      return true; // Return true to prevent infinite retry loops for the same signal
   }
}
