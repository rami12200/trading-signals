//+------------------------------------------------------------------+
//|                                 Trading Signals EA Template       |
//|                        ربط منصة MT5 مع نظام الإشارات التداولية    |
//+------------------------------------------------------------------+
#property copyright "Trading Signals EA"
#property link      "https://yoursite.com"
#property version   "1.00"
#property strict

//--- إعدادات الاتصال بالخادم
input string   API_BASE_URL = "https://yoursite.com";  // رابط API الأساسي
input string   EA_API_KEY = "ts_ea_test_key_2026_rami12200"; // مفتاح EA الخاص
input string   USER_API_KEY = "qbs_90d65d20dc3f3f237407080a1266c149fa75eee066c87052"; // مفتاح المستخدم

//--- إعدادات التداول
input double   LotSize = 0.1;          // حجم اللوت
input int      Slippage = 3;           // slippage
input int      MagicNumber = 202612200; // رقم سحري

//--- متغيرات عالمية
string currentSymbol;
int lastSignalCheck = 0;
int orderQueueCheck = 0;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   currentSymbol = Symbol();
   Print("EA initialized for: ", currentSymbol);
   Print("API Base URL: ", API_BASE_URL);
   
   // تحويل رمز MT5 إلى تنسيق Binance (BTCUSD -> BTCUSDT)
   string binanceSymbol = StringSubstr(currentSymbol, 0, 6) + "T";
   Print("Binance Symbol: ", binanceSymbol);
   
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
   
   // التحقق من طلبات التنفيذ المعلقة كل 5 ثوان
   if(TimeCurrent() - orderQueueCheck >= 5)
   {
      CheckOrderQueue();
      orderQueueCheck = TimeCurrent();
   }
}

//+------------------------------------------------------------------+
//| الحصول على الإشارات من الخادم                                    |
//+------------------------------------------------------------------+
void CheckSignals()
{
   string url = API_BASE_URL + "/api/signals/latest?key=" + USER_API_KEY + "&symbol=" + currentSymbol;
   
   char data[];
   char result[];
   string headers = "Content-Type: application/json\r\n";
   
   int res = WebRequest("GET", url, headers, 5000, data, result, headers);
   
   if(res == 200) // نجاح
   {
      string response = CharArrayToString(result);
      Print("Signal Response: ", response);
      
      // تحليل JSON response هنا
      // يجب إضافة مكتبة JSON parsing أو معالجة النص يدوياً
      
      /* تنسيق الإجابة المتوقع:
      {
        "success": true,
        "count": 1,
        "signals": [
          {
            "symbol": "BTCUSDT",
            "mt5Symbol": "BTCUSD", 
            "action": "BUY",
            "price": 50000,
            "stopLoss": 49000,
            "takeProfit": 52000,
            "volume": 0.1,
            "signalQuality": "STRONG",
            "reason": "EMA تقاطع صاعد",
            "timestamp": "2024-01-01T12:00:00Z"
          }
        ]
      }
      */
   }
   else
   {
      Print("Error getting signals: ", res, " - ", GetLastError());
   }
}

//+------------------------------------------------------------------+
//| التحقق من طلبات التنفيذ المعلقة                                  |
//+------------------------------------------------------------------+
void CheckOrderQueue()
{
   string url = API_BASE_URL + "/api/signals/execute?key=" + EA_API_KEY;
   
   char data[];
   char result[];
   string headers = "Content-Type: application/json\r\n";
   
   int res = WebRequest("GET", url, headers, 5000, data, result, headers);
   
   if(res == 200)
   {
      string response = CharArrayToString(result);
      Print("Order Queue: ", response);
      
      // معالجة الأوامر المعلقة وتنفيذها
      /* تنسيق الإجابة المتوقع:
      {
        "success": true,
        "orders": [
          {
            "id": "order_123456",
            "symbol": "BTCUSDT",
            "mt5Symbol": "BTCUSD",
            "action": "BUY",
            "entry": 50000,
            "stopLoss": 49000,
            "takeProfit": 52000,
            "status": "PENDING"
          }
        ]
      }
      */
   }
   else
   {
      Print("Error checking order queue: ", res, " - ", GetLastError());
   }
}

//+------------------------------------------------------------------+
//| إرسال أمر تنفيذ إلى الخادم                                       |
//+------------------------------------------------------------------+
bool SendExecuteOrder(string symbol, string action, double entry, double sl, double tp)
{
   string url = API_BASE_URL + "/api/signals/execute";
   
   string jsonData = "{\"symbol\":\"" + symbol + "\"," +
                    "\"action\":\"" + action + "\"," +
                    "\"entry\":" + DoubleToString(entry, 2) + "," +
                    "\"stopLoss\":" + DoubleToString(sl, 2) + "," +
                    "\"takeProfit\":" + DoubleToString(tp, 2) + "}";
   
   char data[];
   StringToCharArray(jsonData, data);
   
   char result[];
   string headers = "Content-Type: application/json\r\n" +
                   "Authorization: Bearer " + EA_API_KEY + "\r\n";
   
   int res = WebRequest("POST", url, headers, 5000, data, result, headers);
   
   if(res == 200)
   {
      Print("Order executed successfully");
      return true;
   }
   else
   {
      Print("Error executing order: ", res, " - ", GetLastError());
      return false;
   }
}

//+------------------------------------------------------------------+
//| فتح صفقة في MT5                                                  |
//+------------------------------------------------------------------+
bool OpenTrade(string symbol, int cmd, double volume, double price, double sl, double tp, string comment="")
{
   MqlTradeRequest request = {0};
   MqlTradeResult result = {0};
   
   request.action = TRADE_ACTION_DEAL;
   request.symbol = symbol;
   request.volume = volume;
   request.type = (cmd == OP_BUY) ? ORDER_TYPE_BUY : ORDER_TYPE_SELL;
   request.price = price;
   request.sl = sl;
   request.tp = tp;
   request.deviation = Slippage;
   request.magic = MagicNumber;
   request.comment = comment;
   
   if(OrderSend(request, result))
   {
      Print("Trade opened: ", result.order);
      return true;
   }
   else
   {
      Print("Error opening trade: ", GetLastError());
      return false;
   }
}
//+------------------------------------------------------------------+