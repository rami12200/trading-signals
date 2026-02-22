//+------------------------------------------------------------------+
//|                                              AlQabas.mq5         |
//|                        Copyright 2026, AlQabas Pro               |
//|                             https://qabas.pro                    |
//+------------------------------------------------------------------+
#property copyright "AlQabas Pro"
#property link      "https://qabas.pro"
#property version   "1.04"
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
input int      TrailingStopPoints = 50;                // مسافة الوقف المتحرك (نقاط)

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
//| وظيفة الوقف المتحرك (Trailing Stop)                              |
//+------------------------------------------------------------------+
void CheckTrailingStop()
{
   for(int i=OrdersTotal()-1; i>=0; i--)
   {
      ulong ticket = OrderGetTicket(i);
      if(OrderSelect(ticket))
      {
         // Check Magic Number only, to handle all symbols traded by this EA
         if(OrderGetInteger(ORDER_MAGIC) == MagicNumber)
         {
            string symbol = OrderGetString(ORDER_SYMBOL);
            double sl = OrderGetDouble(ORDER_SL);
            double tp = OrderGetDouble(ORDER_TP);
            
            // Use symbol-specific pricing
            double price = (OrderGetInteger(ORDER_TYPE) == ORDER_TYPE_BUY) ? SymbolInfoDouble(symbol, SYMBOL_BID) : SymbolInfoDouble(symbol, SYMBOL_ASK);
            double point = SymbolInfoDouble(symbol, SYMBOL_POINT);
            
            // Safety check for point
            if(point == 0) continue;
            
            double trailDist = TrailingStopPoints * point; 
            
            if(OrderGetInteger(ORDER_TYPE) == ORDER_TYPE_BUY)
            {
               if(price - sl > trailDist)
               {
                  double newSL = price - trailDist;
                  // Normalize double to avoid invalid stops
                  newSL = NormalizeDouble(newSL, (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS));
                  
                  if(newSL > sl)
                  {
                     MqlTradeRequest request;
                     MqlTradeResult result;
                     ZeroMemory(request);
                     ZeroMemory(result);
                     
                     request.action = TRADE_ACTION_SLTP;
                     request.order = ticket;
                     request.symbol = symbol;
                     request.sl = newSL;
                     request.tp = tp;
                     
                     if(!OrderSend(request, result))
                        Print("Failed to modify Buy Order ", ticket, " Error: ", GetLastError());
                  }
               }
            }
            else if(OrderGetInteger(ORDER_TYPE) == ORDER_TYPE_SELL)
            {
               if(sl - price > trailDist || sl == 0)
               {
                  double newSL = price + trailDist;
                  // Normalize double
                  newSL = NormalizeDouble(newSL, (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS));
                  
                  if(newSL < sl || sl == 0)
                  {
                     MqlTradeRequest request;
                     MqlTradeResult result;
                     ZeroMemory(request);
                     ZeroMemory(result);
                     
                     request.action = TRADE_ACTION_SLTP;
                     request.order = ticket;
                     request.symbol = symbol;
                     request.sl = newSL;
                     request.tp = tp;
                     
                     if(!OrderSend(request, result))
                        Print("Failed to modify Sell Order ", ticket, " Error: ", GetLastError());
                  }
               }
            }
         }
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
      
      if(orderId == "" || action == "") return;
      
      Print("Found pending order: ", orderId, " Action: ", action, " Symbol: ", symbol);
      
      // تحويل الرمز من Binance (BTCUSDT) إلى MT5 (BTCUSD)
      string baseSymbol = symbol;
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
         executed = ExecuteTrade(tradeSymbol, ORDER_TYPE_BUY, sl, tp);
      }
      else if(action == "SELL")
      {
         executed = ExecuteTrade(tradeSymbol, ORDER_TYPE_SELL, sl, tp);
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
bool ExecuteTrade(string symbol, ENUM_ORDER_TYPE type, double sl, double tp)
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
   
   request.action = TRADE_ACTION_DEAL;
   request.symbol = symbol;
   request.volume = LotSize;
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
