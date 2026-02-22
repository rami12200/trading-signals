//+------------------------------------------------------------------+
//|                                              AlQabas.mq5         |
//|                        Copyright 2026, AlQabas Pro               |
//|                             https://qabas.pro                    |
//+------------------------------------------------------------------+
#property copyright "AlQabas Pro"
#property link      "https://qabas.pro"
#property version   "1.02" // Updated version
#property description "Auto-trading EA - Receives signals from TradeSignals Pro API"
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

//--- إعدادات الرموز
input group "=== Symbol Settings ==="
input string   SymbolSuffix = "";                      // لاحقة الرمز (مثلا .m أو .raw)
input string   SymbolPrefix = "";                      // بادئة الرمز

//--- متغيرات عالمية
string currentSymbol;
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
   Print("TradeSignals Pro EA initialized for: ", currentSymbol);
   Print("API Base URL: ", API_BASE_URL);
   
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
   // نستخدم EA_API_KEY للتحقق من الأوامر التي يجب تنفيذها
   string url = API_BASE_URL + "/api/signals/execute?key=" + USER_API_KEY; // Use User Key to get their orders
   
   char data[];
   char result[];
   string headers = "Content-Type: application/json\r\n";
   
   int res = WebRequest("GET", url, headers, 3000, data, result, headers);
   
   if(res == 200)
   {
      string response = CharArrayToString(result);
      
      // التأكد من وجود أوامر
      if(StringFind(response, "\"orders\":[") == -1) return;
      
      // استخراج بيانات أول أمر في القائمة
      // ملاحظة: هذا تحليل بسيط يفترض أن أول كائن هو الأمر المطلوب
      string orderId = GetJsonValue(response, "id");
      string action = GetJsonValue(response, "action");
      string symbol = GetJsonValue(response, "symbol");
      
      // التحقق من أن الأمر لنفس الزوج الحالي (اختياري، يمكن إزالته لتنفيذ كل الأزواج)
      // هنا سننفذ فقط إذا كان الرمز مطابقاً أو إذا كنا نريد تشغيل EA واحد لكل الأزواج
      // للتبسيط: سننفذ إذا كان الرمز مطابقاً للرمز الحالي (BTCUSD مثلاً)
      
      // تحويل رمز المنصة للتأكد
      string cleanCurrent = currentSymbol;
      if(SymbolSuffix != "") StringReplace(cleanCurrent, SymbolSuffix, "");
      
      // إذا وجدنا ID و Action صالحين
      if(orderId != "" && action != "")
      {
         Print("Found pending order: ", orderId, " Action: ", action, " Symbol: ", symbol);
         
         // استخدام الرمز القادم من السيرفر (مع مراعاة اللاحقة والبادئة)
         string tradeSymbol = symbol;
         // إذا كان الرمز القادم من السيرفر بتنسيق Binance (مثلاً ETHUSDT) ونحن نريد MT5 (ETHUSD)
         // السيرفر يرسل mt5Symbol عادة، لكن هنا نعتمد على symbol
         if(StringFind(tradeSymbol, "USDT") > 0) StringReplace(tradeSymbol, "USDT", "USD");
         
         // إضافة بادئة ولاحقة البروكر إذا وجدت
         tradeSymbol = SymbolPrefix + tradeSymbol + SymbolSuffix;
         
         bool executed = false;
         
         if(action == "BUY")
         {
            executed = ExecuteTrade(tradeSymbol, ORDER_TYPE_BUY);
         }
         else if(action == "SELL")
         {
            executed = ExecuteTrade(tradeSymbol, ORDER_TYPE_SELL);
         }
         
         // إذا تم التنفيذ بنجاح (أو حتى فشل ولكن حاولنا)، نبلغ السيرفر لإيقاف التكرار
         if(executed)
         {
            MarkOrderExecuted(orderId);
         }
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
bool ExecuteTrade(string symbol, ENUM_ORDER_TYPE type)
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
   request.deviation = Slippage;
   request.magic = MagicNumber;
   request.comment = "Qabas.pro Signal";
   
   // إضافة وقف الخسارة وجني الأرباح (اختياري - يمكن جلبه من الإشارة لاحقاً)
   
   if(OrderSend(request, result))
   {
      Print("Trade executed successfully: ", result.order, " on ", symbol);
      return true;
   }
   else
   {
      Print("Error executing trade on ", symbol, ": ", GetLastError());
      return true; 
   }
}
