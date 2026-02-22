//+------------------------------------------------------------------+
//|                                            TradeSignalsPro.mq5   |
//|                        Copyright 2026, TradeSignals Pro          |
//|                             https://qabas.pro                    |
//+------------------------------------------------------------------+
#property copyright "TradeSignals Pro"
#property link      "https://qabas.pro"
#property version   "1.00"
#property description "Auto-trading EA - Receives signals from TradeSignals Pro API"
#property strict

//--- إعدادات الاتصال بالخادم
input group "=== API Settings ==="
input string   API_BASE_URL = "https://qabas.pro";     // رابط API الأساسي
input string   USER_API_KEY = "";                      // مفتاح المستخدم (من صفحة Profile)
input string   EA_API_KEY   = "ts_ea_v1_public_key";   // مفتاح EA (لا تغيره)

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
   // التحقق من الإشارات كل 10 ثوان
   if(TimeCurrent() - lastSignalCheck >= 10)
   {
      CheckSignals();
      lastSignalCheck = TimeCurrent();
   }
   
   // التحقق من أوامر التنفيذ المباشرة كل 5 ثوان
   if(TimeCurrent() - lastOrderCheck >= 5)
   {
      CheckOrderQueue();
      lastOrderCheck = TimeCurrent();
   }
}

//+------------------------------------------------------------------+
//| Helper: Get Binance Symbol                                       |
//+------------------------------------------------------------------+
string GetBinanceSymbol(string mt5Symbol)
{
   string cleanSymbol = mt5Symbol;
   
   // إزالة البادئة واللاحقة
   if(SymbolPrefix != "") StringReplace(cleanSymbol, SymbolPrefix, "");
   if(SymbolSuffix != "") StringReplace(cleanSymbol, SymbolSuffix, "");
   
   // تحويل BTCUSD إلى BTCUSDT
   if(StringSubstr(cleanSymbol, StringLen(cleanSymbol)-3) == "USD")
   {
      return cleanSymbol + "T";
   }
   
   return cleanSymbol;
}

//+------------------------------------------------------------------+
//| الحصول على الإشارات من الخادم                                    |
//+------------------------------------------------------------------+
void CheckSignals()
{
   string binanceSymbol = GetBinanceSymbol(currentSymbol);
   string url = API_BASE_URL + "/api/signals/latest?key=" + USER_API_KEY + "&symbol=" + binanceSymbol;
   
   char data[];
   char result[];
   string headers = "Content-Type: application/json\r\n";
   
   int res = WebRequest("GET", url, headers, 3000, data, result, headers);
   
   if(res == 200)
   {
      // هنا يتم معالجة الإشارات وتنفيذها
      // تبسيطاً للكود، سنعتمد على CheckOrderQueue للتنفيذ الفعلي
      // لأن السيرفر هو من يقرر متى ينفذ بناءً على الإشارات
   }
}

//+------------------------------------------------------------------+
//| التحقق من طلبات التنفيذ المعلقة                                  |
//+------------------------------------------------------------------+
void CheckOrderQueue()
{
   // نستخدم EA_API_KEY للتحقق من الأوامر التي يجب تنفيذها
   string url = API_BASE_URL + "/api/signals/execute?key=" + EA_API_KEY + "&user_key=" + USER_API_KEY;
   
   char data[];
   char result[];
   string headers = "Content-Type: application/json\r\n";
   
   int res = WebRequest("GET", url, headers, 3000, data, result, headers);
   
   if(res == 200)
   {
      string response = CharArrayToString(result);
      
      // في حالة وجود أوامر للتنفيذ، سيتم إرجاعها هنا
      // ملاحظة: MQL5 لا يحتوي على JSON parser مدمج قوي
      // لذا سنبحث عن نصوص محددة في الاستجابة
      
      if(StringFind(response, "\"action\":\"BUY\"") >= 0)
      {
         // تنفيذ شراء
         ExecuteTrade(ORDER_TYPE_BUY);
      }
      else if(StringFind(response, "\"action\":\"SELL\"") >= 0)
      {
         // تنفيذ بيع
         ExecuteTrade(ORDER_TYPE_SELL);
      }
   }
}

//+------------------------------------------------------------------+
//| تنفيذ صفقة                                                       |
//+------------------------------------------------------------------+
void ExecuteTrade(ENUM_ORDER_TYPE type)
{
   // التحقق من عدم وجود صفقات مفتوحة كثيرة
   if(OrdersTotal() >= MaxTrades) return;
   
   MqlTradeRequest request;
   MqlTradeResult result;
   ZeroMemory(request);
   ZeroMemory(result);
   
   request.action = TRADE_ACTION_DEAL;
   request.symbol = currentSymbol;
   request.volume = LotSize;
   request.type = type;
   request.price = (type == ORDER_TYPE_BUY) ? SymbolInfoDouble(currentSymbol, SYMBOL_ASK) : SymbolInfoDouble(currentSymbol, SYMBOL_BID);
   request.deviation = Slippage;
   request.magic = MagicNumber;
   request.comment = "Qabas.pro Signal";
   
   // إضافة وقف الخسارة وجني الأرباح (اختياري)
   // يمكن حسابها بناءً على السعر الحالي
   
   if(OrderSend(request, result))
   {
      Print("Trade executed: ", result.order);
   }
   else
   {
      Print("Error executing trade: ", GetLastError());
   }
}
