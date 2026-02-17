//+------------------------------------------------------------------+
//|                                            TradeSignalsPro.mq5   |
//|                        Copyright 2026, TradeSignals Pro           |
//|                  https://trading-signals-livid.vercel.app         |
//+------------------------------------------------------------------+
#property copyright "TradeSignals Pro"
#property link      "https://trading-signals-livid.vercel.app"
#property version   "1.00"
#property description "Auto-trading EA - Receives signals from TradeSignals Pro API"
#property strict

#include <Trade\Trade.mqh>
#include <Trade\PositionInfo.mqh>

//+------------------------------------------------------------------+
//| Input Parameters                                                  |
//+------------------------------------------------------------------+
input group "=== API Settings ==="
input string   InpApiUrl       = "https://trading-signals-livid.vercel.app/api/signals/latest"; // Signal API URL
input string   InpApiKey       = "";                    // API Key (required)
input int      InpPollSeconds  = 5;                     // Poll interval (seconds)
input string   InpInterval     = "5m";                  // Candle interval (5m, 15m)

input group "=== Trading Settings ==="
input double   InpLotSize      = 0.1;                   // Lot size
input int      InpMaxTrades    = 3;                     // Max open trades
input int      InpSlippage     = 30;                    // Max slippage (points)
input bool     InpUseSignalSLTP = true;                 // Use SL/TP from signal
input double   InpManualSL     = 0;                     // Manual SL (points, 0=disabled)
input double   InpManualTP     = 0;                     // Manual TP (points, 0=disabled)

input group "=== Filter Settings ==="
input bool     InpStrongOnly   = false;                 // Only trade STRONG signals
input string   InpAllowedPairs = "";                    // Allowed pairs (empty=all, e.g. BTCUSD,ETHUSD)

input group "=== Symbol Mapping ==="
input string   InpSymbolSuffix = "";                    // Broker symbol suffix (e.g. m, .a, .raw)
input string   InpSymbolPrefix = "";                    // Broker symbol prefix (e.g. #)

input group "=== Risk Management ==="
input double   InpMaxDailyLoss = 0;                     // Max daily loss $ (0=disabled)
input int      InpMaxDailyTrades = 0;                   // Max trades per day (0=unlimited)

input group "=== Display ==="
input int      InpMagicNumber  = 202601;                // Magic number
input bool     InpShowPanel    = true;                  // Show info panel on chart

//+------------------------------------------------------------------+
//| Global Variables                                                  |
//+------------------------------------------------------------------+
CTrade         trade;
CPositionInfo  posInfo;
datetime       lastPollTime = 0;
int            dailyTradeCount = 0;
double         dailyPnL = 0;
datetime       currentDay = 0;
string         lastSignalId = "";
int            totalSignalsReceived = 0;
int            totalTradesOpened = 0;
int            totalErrors = 0;

//+------------------------------------------------------------------+
//| Signal Structure                                                  |
//+------------------------------------------------------------------+
struct Signal
{
   string symbol;       // Binance symbol (BTCUSDT)
   string mt5Symbol;    // MT5 symbol (BTCUSD)
   string action;       // BUY or SELL
   double price;
   double stopLoss;
   double takeProfit;
   string quality;      // STRONG, NORMAL, WEAK
   string reason;
   string timestamp;
};

//+------------------------------------------------------------------+
//| Expert initialization function                                    |
//+------------------------------------------------------------------+
int OnInit()
{
   if(InpApiKey == "")
   {
      Alert("TradeSignals Pro: API Key is required! Please set it in EA settings.");
      return INIT_PARAMETERS_INCORRECT;
   }
   
   // Setup trade object
   trade.SetExpertMagicNumber(InpMagicNumber);
   trade.SetDeviationInPoints(InpSlippage);
   trade.SetTypeFilling(ORDER_FILLING_IOC);
   
   // Allow WebRequest to our API
   Print("TradeSignals Pro EA v1.00 initialized");
   Print("API URL: ", InpApiUrl);
   Print("Poll interval: ", InpPollSeconds, " seconds");
   Print("Lot size: ", InpLotSize);
   Print("Max trades: ", InpMaxTrades);
   Print("Signal quality filter: ", InpStrongOnly ? "STRONG only" : "All");
   Print("Symbol suffix: '", InpSymbolSuffix, "'");
   Print("---");
   Print("IMPORTANT: Add this URL to Tools > Options > Expert Advisors > Allow WebRequest:");
   Print(InpApiUrl);
   
   // Set timer for polling
   EventSetTimer(InpPollSeconds);
   
   // Reset daily counters
   ResetDailyCounters();
   
   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                  |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   if(InpShowPanel) ObjectsDeleteAll(0, "TSP_");
   Print("TradeSignals Pro EA stopped. Reason: ", reason);
   Print("Stats: Signals=", totalSignalsReceived, " Trades=", totalTradesOpened, " Errors=", totalErrors);
}

//+------------------------------------------------------------------+
//| Timer function - polls API every N seconds                        |
//+------------------------------------------------------------------+
void OnTimer()
{
   // Reset daily counters at new day
   datetime today = StringToTime(TimeToString(TimeCurrent(), TIME_DATE));
   if(today != currentDay)
   {
      ResetDailyCounters();
      currentDay = today;
   }
   
   // Check daily limits
   if(InpMaxDailyLoss > 0 && dailyPnL <= -InpMaxDailyLoss)
   {
      if(InpShowPanel) UpdatePanel("Daily loss limit reached: $" + DoubleToString(dailyPnL, 2));
      return;
   }
   if(InpMaxDailyTrades > 0 && dailyTradeCount >= InpMaxDailyTrades)
   {
      if(InpShowPanel) UpdatePanel("Daily trade limit reached: " + IntegerToString(dailyTradeCount));
      return;
   }
   
   // Fetch and process signals
   FetchAndProcessSignals();
   
   // Update panel
   if(InpShowPanel) UpdatePanel("");
}

//+------------------------------------------------------------------+
//| OnTick - also update panel                                        |
//+------------------------------------------------------------------+
void OnTick()
{
   // Update daily PnL
   UpdateDailyPnL();
}

//+------------------------------------------------------------------+
//| Fetch signals from API and process them                           |
//+------------------------------------------------------------------+
void FetchAndProcessSignals()
{
   // Build URL with parameters
   string url = InpApiUrl + "?key=" + InpApiKey + "&interval=" + InpInterval;
   if(InpStrongOnly) url += "&quality=STRONG";
   
   // Prepare request
   char   postData[];
   char   result[];
   string headers = "User-Agent: TradeSignalsPro-EA/1.0\r\n";
   string resultHeaders;
   int    timeout = 10000; // 10 seconds
   
   // Send HTTP GET request
   ResetLastError();
   int res = WebRequest("GET", url, headers, timeout, postData, result, resultHeaders);
   
   if(res == -1)
   {
      int err = GetLastError();
      if(err == 4014)
      {
         Print("ERROR: WebRequest not allowed! Add this URL to Tools > Options > Expert Advisors > Allow WebRequest:");
         Print(InpApiUrl);
      }
      else
      {
         Print("HTTP request failed. Error: ", err);
      }
      totalErrors++;
      return;
   }
   
   if(res != 200)
   {
      Print("API returned HTTP ", res);
      totalErrors++;
      return;
   }
   
   // Parse JSON response
   string jsonStr = CharArrayToString(result);
   
   // Parse signals from JSON
   Signal signals[];
   int signalCount = ParseSignals(jsonStr, signals);
   
   if(signalCount <= 0) return;
   
   totalSignalsReceived += signalCount;
   
   // Process each signal
   for(int i = 0; i < signalCount; i++)
   {
      ProcessSignal(signals[i]);
   }
}

//+------------------------------------------------------------------+
//| Parse JSON response into Signal array                             |
//+------------------------------------------------------------------+
int ParseSignals(string json, Signal &signals[])
{
   // Check for success
   if(StringFind(json, "\"success\":true") < 0 && StringFind(json, "\"success\": true") < 0)
   {
      Print("API returned error: ", StringSubstr(json, 0, 200));
      return 0;
   }
   
   // Find signals array
   int signalsStart = StringFind(json, "\"signals\":[");
   if(signalsStart < 0) signalsStart = StringFind(json, "\"signals\": [");
   if(signalsStart < 0) return 0;
   
   // Count signals by counting "action" occurrences
   int count = 0;
   int searchPos = signalsStart;
   while(true)
   {
      searchPos = StringFind(json, "\"action\":", searchPos + 1);
      if(searchPos < 0) break;
      count++;
   }
   
   if(count == 0) return 0;
   
   ArrayResize(signals, count);
   
   // Parse each signal object
   int objStart = signalsStart;
   for(int i = 0; i < count; i++)
   {
      objStart = StringFind(json, "{", objStart + 1);
      if(objStart < 0) break;
      
      int objEnd = StringFind(json, "}", objStart);
      if(objEnd < 0) break;
      
      string obj = StringSubstr(json, objStart, objEnd - objStart + 1);
      
      signals[i].symbol     = ExtractJsonString(obj, "symbol");
      signals[i].mt5Symbol  = ExtractJsonString(obj, "mt5Symbol");
      signals[i].action     = ExtractJsonString(obj, "action");
      signals[i].price      = ExtractJsonDouble(obj, "price");
      signals[i].stopLoss   = ExtractJsonDouble(obj, "stopLoss");
      signals[i].takeProfit = ExtractJsonDouble(obj, "takeProfit");
      signals[i].quality    = ExtractJsonString(obj, "signalQuality");
      signals[i].reason     = ExtractJsonString(obj, "reason");
      signals[i].timestamp  = ExtractJsonString(obj, "timestamp");
      
      objStart = objEnd;
   }
   
   return count;
}

//+------------------------------------------------------------------+
//| Extract string value from JSON                                    |
//+------------------------------------------------------------------+
string ExtractJsonString(string json, string key)
{
   string searchKey = "\"" + key + "\":\"";
   int start = StringFind(json, searchKey);
   if(start < 0)
   {
      searchKey = "\"" + key + "\": \"";
      start = StringFind(json, searchKey);
      if(start < 0) return "";
   }
   
   start += StringLen(searchKey);
   int end = StringFind(json, "\"", start);
   if(end < 0) return "";
   
   return StringSubstr(json, start, end - start);
}

//+------------------------------------------------------------------+
//| Extract double value from JSON                                    |
//+------------------------------------------------------------------+
double ExtractJsonDouble(string json, string key)
{
   string searchKey = "\"" + key + "\":";
   int start = StringFind(json, searchKey);
   if(start < 0)
   {
      searchKey = "\"" + key + "\": ";
      start = StringFind(json, searchKey);
      if(start < 0) return 0;
   }
   
   start += StringLen(searchKey);
   
   // Skip whitespace
   while(start < StringLen(json) && StringGetCharacter(json, start) == ' ') start++;
   
   // Find end of number
   int end = start;
   while(end < StringLen(json))
   {
      ushort ch = StringGetCharacter(json, end);
      if((ch >= '0' && ch <= '9') || ch == '.' || ch == '-')
         end++;
      else
         break;
   }
   
   if(end == start) return 0;
   
   return StringToDouble(StringSubstr(json, start, end - start));
}

//+------------------------------------------------------------------+
//| Process a single signal                                           |
//+------------------------------------------------------------------+
void ProcessSignal(Signal &sig)
{
   // Map to broker symbol
   string brokerSymbol = MapToBrokerSymbol(sig.mt5Symbol);
   
   // Check if symbol exists on broker
   if(!SymbolSelect(brokerSymbol, true))
   {
      // Try without suffix
      if(!SymbolSelect(sig.mt5Symbol, true))
      {
         Print("Symbol not found: ", brokerSymbol, " (", sig.mt5Symbol, ")");
         return;
      }
      brokerSymbol = sig.mt5Symbol;
   }
   
   // Check allowed pairs filter
   if(InpAllowedPairs != "")
   {
      if(StringFind(InpAllowedPairs, sig.mt5Symbol) < 0 && StringFind(InpAllowedPairs, brokerSymbol) < 0)
         return;
   }
   
   // Check if we already have a position on this symbol
   if(HasOpenPosition(brokerSymbol))
   {
      return; // Skip - already have a position
   }
   
   // Check max trades limit
   if(CountOpenPositions() >= InpMaxTrades)
   {
      return; // Skip - max trades reached
   }
   
   // Check signal quality filter
   if(InpStrongOnly && sig.quality != "STRONG")
      return;
   
   // Execute trade
   if(sig.action == "BUY")
      ExecuteBuy(brokerSymbol, sig);
   else if(sig.action == "SELL")
      ExecuteSell(brokerSymbol, sig);
}

//+------------------------------------------------------------------+
//| Map Binance symbol to broker symbol                               |
//+------------------------------------------------------------------+
string MapToBrokerSymbol(string mt5Symbol)
{
   return InpSymbolPrefix + mt5Symbol + InpSymbolSuffix;
}

//+------------------------------------------------------------------+
//| Execute BUY order                                                 |
//+------------------------------------------------------------------+
void ExecuteBuy(string symbol, Signal &sig)
{
   double ask = SymbolInfoDouble(symbol, SYMBOL_ASK);
   if(ask == 0) { Print("Cannot get ASK price for ", symbol); return; }
   
   double sl = 0;
   double tp = 0;
   int digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
   double point = SymbolInfoDouble(symbol, SYMBOL_POINT);
   
   if(InpUseSignalSLTP && sig.stopLoss > 0 && sig.takeProfit > 0)
   {
      sl = NormalizeDouble(sig.stopLoss, digits);
      tp = NormalizeDouble(sig.takeProfit, digits);
   }
   else if(InpManualSL > 0 && InpManualTP > 0)
   {
      sl = NormalizeDouble(ask - InpManualSL * point, digits);
      tp = NormalizeDouble(ask + InpManualTP * point, digits);
   }
   
   // Validate SL/TP
   if(sl >= ask) { Print("Invalid SL for BUY: SL=", sl, " >= ASK=", ask); sl = 0; tp = 0; }
   if(tp > 0 && tp <= ask) { Print("Invalid TP for BUY: TP=", tp, " <= ASK=", ask); tp = 0; }
   
   string comment = "TSP|" + sig.quality + "|" + sig.mt5Symbol;
   
   if(trade.Buy(InpLotSize, symbol, ask, sl, tp, comment))
   {
      Print("✅ BUY ", symbol, " @ ", ask, " SL=", sl, " TP=", tp, " [", sig.quality, "] ", sig.reason);
      totalTradesOpened++;
      dailyTradeCount++;
   }
   else
   {
      Print("❌ BUY FAILED: ", symbol, " Error=", GetLastError(), " RetCode=", trade.ResultRetcode());
      totalErrors++;
   }
}

//+------------------------------------------------------------------+
//| Execute SELL order                                                |
//+------------------------------------------------------------------+
void ExecuteSell(string symbol, Signal &sig)
{
   double bid = SymbolInfoDouble(symbol, SYMBOL_BID);
   if(bid == 0) { Print("Cannot get BID price for ", symbol); return; }
   
   double sl = 0;
   double tp = 0;
   int digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
   double point = SymbolInfoDouble(symbol, SYMBOL_POINT);
   
   if(InpUseSignalSLTP && sig.stopLoss > 0 && sig.takeProfit > 0)
   {
      sl = NormalizeDouble(sig.stopLoss, digits);
      tp = NormalizeDouble(sig.takeProfit, digits);
   }
   else if(InpManualSL > 0 && InpManualTP > 0)
   {
      sl = NormalizeDouble(bid + InpManualSL * point, digits);
      tp = NormalizeDouble(bid - InpManualTP * point, digits);
   }
   
   // Validate SL/TP
   if(sl > 0 && sl <= bid) { Print("Invalid SL for SELL: SL=", sl, " <= BID=", bid); sl = 0; tp = 0; }
   if(tp >= bid) { Print("Invalid TP for SELL: TP=", tp, " >= BID=", bid); tp = 0; }
   
   string comment = "TSP|" + sig.quality + "|" + sig.mt5Symbol;
   
   if(trade.Sell(InpLotSize, symbol, bid, sl, tp, comment))
   {
      Print("✅ SELL ", symbol, " @ ", bid, " SL=", sl, " TP=", tp, " [", sig.quality, "] ", sig.reason);
      totalTradesOpened++;
      dailyTradeCount++;
   }
   else
   {
      Print("❌ SELL FAILED: ", symbol, " Error=", GetLastError(), " RetCode=", trade.ResultRetcode());
      totalErrors++;
   }
}

//+------------------------------------------------------------------+
//| Check if we have an open position on symbol                       |
//+------------------------------------------------------------------+
bool HasOpenPosition(string symbol)
{
   for(int i = 0; i < PositionsTotal(); i++)
   {
      if(posInfo.SelectByIndex(i))
      {
         if(posInfo.Symbol() == symbol && posInfo.Magic() == InpMagicNumber)
            return true;
      }
   }
   return false;
}

//+------------------------------------------------------------------+
//| Count total open positions by this EA                             |
//+------------------------------------------------------------------+
int CountOpenPositions()
{
   int count = 0;
   for(int i = 0; i < PositionsTotal(); i++)
   {
      if(posInfo.SelectByIndex(i))
      {
         if(posInfo.Magic() == InpMagicNumber)
            count++;
      }
   }
   return count;
}

//+------------------------------------------------------------------+
//| Update daily PnL from closed positions                            |
//+------------------------------------------------------------------+
void UpdateDailyPnL()
{
   dailyPnL = 0;
   datetime dayStart = StringToTime(TimeToString(TimeCurrent(), TIME_DATE));
   
   // Check history for today's closed trades
   if(HistorySelect(dayStart, TimeCurrent()))
   {
      for(int i = 0; i < HistoryDealsTotal(); i++)
      {
         ulong ticket = HistoryDealGetTicket(i);
         if(ticket > 0)
         {
            if(HistoryDealGetInteger(ticket, DEAL_MAGIC) == InpMagicNumber)
            {
               dailyPnL += HistoryDealGetDouble(ticket, DEAL_PROFIT)
                         + HistoryDealGetDouble(ticket, DEAL_SWAP)
                         + HistoryDealGetDouble(ticket, DEAL_COMMISSION);
            }
         }
      }
   }
   
   // Add unrealized PnL from open positions
   for(int i = 0; i < PositionsTotal(); i++)
   {
      if(posInfo.SelectByIndex(i))
      {
         if(posInfo.Magic() == InpMagicNumber)
            dailyPnL += posInfo.Profit() + posInfo.Swap() + posInfo.Commission();
      }
   }
}

//+------------------------------------------------------------------+
//| Reset daily counters                                              |
//+------------------------------------------------------------------+
void ResetDailyCounters()
{
   dailyTradeCount = 0;
   dailyPnL = 0;
   currentDay = StringToTime(TimeToString(TimeCurrent(), TIME_DATE));
}

//+------------------------------------------------------------------+
//| Update info panel on chart                                        |
//+------------------------------------------------------------------+
void UpdatePanel(string statusMsg)
{
   int x = 10;
   int y = 30;
   int lineHeight = 18;
   color textColor = clrWhite;
   color headerColor = clrDodgerBlue;
   color profitColor = dailyPnL >= 0 ? clrLime : clrRed;
   
   CreateLabel("TSP_Header", x, y, "━━ TradeSignals Pro EA ━━", headerColor, 10);
   y += lineHeight + 5;
   
   CreateLabel("TSP_Status", x, y, "Status: " + (statusMsg != "" ? statusMsg : "Active ✓"), 
               statusMsg != "" ? clrOrange : clrLime, 9);
   y += lineHeight;
   
   CreateLabel("TSP_Interval", x, y, "Interval: " + InpInterval + " | Poll: " + IntegerToString(InpPollSeconds) + "s", textColor, 9);
   y += lineHeight;
   
   CreateLabel("TSP_Quality", x, y, "Filter: " + (InpStrongOnly ? "STRONG only" : "All signals"), textColor, 9);
   y += lineHeight;
   
   CreateLabel("TSP_Sep1", x, y, "─────────────────────", clrGray, 9);
   y += lineHeight;
   
   CreateLabel("TSP_Positions", x, y, "Open: " + IntegerToString(CountOpenPositions()) + "/" + IntegerToString(InpMaxTrades), textColor, 9);
   y += lineHeight;
   
   CreateLabel("TSP_DayTrades", x, y, "Today trades: " + IntegerToString(dailyTradeCount) + 
               (InpMaxDailyTrades > 0 ? "/" + IntegerToString(InpMaxDailyTrades) : ""), textColor, 9);
   y += lineHeight;
   
   CreateLabel("TSP_DayPnL", x, y, "Today P&L: $" + DoubleToString(dailyPnL, 2), profitColor, 9);
   y += lineHeight;
   
   CreateLabel("TSP_Sep2", x, y, "─────────────────────", clrGray, 9);
   y += lineHeight;
   
   CreateLabel("TSP_Signals", x, y, "Signals received: " + IntegerToString(totalSignalsReceived), textColor, 9);
   y += lineHeight;
   
   CreateLabel("TSP_Trades", x, y, "Trades opened: " + IntegerToString(totalTradesOpened), textColor, 9);
   y += lineHeight;
   
   CreateLabel("TSP_Errors", x, y, "Errors: " + IntegerToString(totalErrors), totalErrors > 0 ? clrOrange : textColor, 9);
   y += lineHeight;
   
   CreateLabel("TSP_Time", x, y, "Last poll: " + TimeToString(TimeCurrent(), TIME_MINUTES), clrGray, 8);
   
   ChartRedraw();
}

//+------------------------------------------------------------------+
//| Create or update a label on chart                                 |
//+------------------------------------------------------------------+
void CreateLabel(string name, int x, int y, string text, color clr, int fontSize)
{
   if(ObjectFind(0, name) < 0)
   {
      ObjectCreate(0, name, OBJ_LABEL, 0, 0, 0);
      ObjectSetInteger(0, name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(0, name, OBJPROP_ANCHOR, ANCHOR_LEFT_UPPER);
      ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(0, name, OBJPROP_HIDDEN, true);
   }
   
   ObjectSetInteger(0, name, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(0, name, OBJPROP_YDISTANCE, y);
   ObjectSetString(0, name, OBJPROP_TEXT, text);
   ObjectSetInteger(0, name, OBJPROP_COLOR, clr);
   ObjectSetInteger(0, name, OBJPROP_FONTSIZE, fontSize);
   ObjectSetString(0, name, OBJPROP_FONT, "Consolas");
}
//+------------------------------------------------------------------+
