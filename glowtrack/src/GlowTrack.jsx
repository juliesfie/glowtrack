import { useState, useRef, useEffect, useCallback } from "react";

// ─── STORAGE HELPERS ──────────────────────────────────────────────────────────
const STORAGE_VERSION = "v1";

async function storageSave(key, value) {
  try { await window.storage.set(key, JSON.stringify(value)); } catch(e) { console.error("save err", e); }
}
async function storageLoad(key) {
  try {
    const r = await window.storage.get(key);
    return r ? JSON.parse(r.value) : null;
  } catch(e) { return null; }
}
async function storageDelete(key) {
  try { await window.storage.delete(key); } catch(e) {}
}

// User key helpers
const uk = (username, suffix) => `glowtrack:${STORAGE_VERSION}:${username.toLowerCase().trim()}:${suffix}`;
const UK_PROFILE    = u => uk(u,"profile");
const UK_DAYS       = u => uk(u,"days");
const UK_WATER      = u => uk(u,"water");
const UK_RECIPES    = u => uk(u,"recipes");
const UK_CUSTOM     = u => uk(u,"customFoods");
const UK_DEFICIT    = u => uk(u,"manualDeficit");
const UK_API_KEY    = () => "glowtrack:v1:__apikey__"; // shared across users on this device
const UK_AI_USAGE   = u => uk(u,"aiUsage"); // {date, count}
const UK_USERS      = () => "glowtrack:v1:__users__"; // {username:{hash,email,gender,createdAt}}
const UK_SUB        = u => uk(u,"subscription"); // {plan,startDate,trialEnd,status,cancelledAt}
const UK_FRIENDS    = u => uk(u,"friends");       // [{username, relation:"friend"|"partner", addedAt}]
const UK_SHARE      = u => uk(u,"shareSettings"); // {shareAnalysis, shareCycle, shareRecipes, shareFertility}
const UK_SHARED_RECIPES = u => uk(u,"sharedRecipes"); // recipes others shared with this user
const UK_REQUESTS   = u => uk(u,"friendRequests"); // [{from, at}]
const UK_PUBLIC_FEED = () => "glowtrack:v1:__feed__"; // global public recipe feed


// ─── CORRECT FOOD DATABASE ────────────────────────────────────────────────────
const FOOD_DB = [
  // MORE NUTRITION – Protein Shakes & Powders
  { id:1, name:"More Nutrition Total Protein Vanilla", cal:108, p:24, c:2.4, f:1.2, fi:0.5, unit:"g", unitLabel:"30g Scoop", cat:"More Nutrition", inflammatory:false, endo_ok:true },
  { id:2, name:"More Nutrition Total Protein Chocolate", cal:110, p:23.5, c:3.1, f:1.4, fi:0.8, unit:"g", unitLabel:"30g Scoop", cat:"More Nutrition", inflammatory:false, endo_ok:true },
  { id:3, name:"More Nutrition Total Protein Strawberry", cal:107, p:23.8, c:2.8, f:1.1, fi:0.6, unit:"g", unitLabel:"30g Scoop", cat:"More Nutrition", inflammatory:false, endo_ok:true },
  { id:4, name:"More Nutrition Total Protein Caramel", cal:109, p:24, c:2.6, f:1.3, fi:0.5, unit:"g", unitLabel:"30g Scoop", cat:"More Nutrition", inflammatory:false, endo_ok:true },
  { id:5, name:"More Nutrition Total Protein Cookies & Cream", cal:112, p:23.2, c:3.5, f:1.5, fi:0.7, unit:"g", unitLabel:"30g Scoop", cat:"More Nutrition", inflammatory:false, endo_ok:true },
  { id:6, name:"More Nutrition Whey Isolate 90 Vanilla", cal:96, p:25.2, c:1.0, f:0.4, fi:0, unit:"g", unitLabel:"27g Scoop", cat:"More Nutrition", inflammatory:false, endo_ok:true },
  { id:7, name:"More Nutrition Whey Isolate 90 Chocolate", cal:98, p:24.8, c:1.5, f:0.5, fi:0.2, unit:"g", unitLabel:"27g Scoop", cat:"More Nutrition", inflammatory:false, endo_ok:true },
  { id:8, name:"More Nutrition Clear Whey Peach-Mango", cal:88, p:20.3, c:1.8, f:0.1, fi:0, unit:"g", unitLabel:"25g Scoop", cat:"More Nutrition", inflammatory:false, endo_ok:true },
  { id:9, name:"More Nutrition Clear Whey Lemon", cal:88, p:20.3, c:1.8, f:0.1, fi:0, unit:"g", unitLabel:"25g Scoop", cat:"More Nutrition", inflammatory:false, endo_ok:true },
  { id:10, name:"More Nutrition Clear Whey Raspberry", cal:88, p:20.3, c:1.8, f:0.1, fi:0, unit:"g", unitLabel:"25g Scoop", cat:"More Nutrition", inflammatory:false, endo_ok:true },
  // MORE NUTRITION – Milkiccinos (fertig gemischt mit 300ml Wasser)
  { id:11, name:"More Nutrition Milkiccino Cappuccino (Portion)", cal:135, p:27, c:4.5, f:1.8, fi:0.5, unit:"g", unitLabel:"38g Portion", cat:"More Nutrition", inflammatory:false, endo_ok:true },
  { id:12, name:"More Nutrition Milkiccino Vanilla Latte (Portion)", cal:132, p:26.5, c:4.2, f:1.6, fi:0.4, unit:"g", unitLabel:"38g Portion", cat:"More Nutrition", inflammatory:false, endo_ok:true },
  { id:13, name:"More Nutrition Milkiccino Choco Coffee (Portion)", cal:138, p:26.8, c:5.0, f:1.9, fi:0.8, unit:"g", unitLabel:"38g Portion", cat:"More Nutrition", inflammatory:false, endo_ok:true },
  { id:14, name:"More Nutrition Milkiccino Salted Caramel (Portion)", cal:133, p:27, c:4.3, f:1.7, fi:0.4, unit:"g", unitLabel:"38g Portion", cat:"More Nutrition", inflammatory:false, endo_ok:true },
  // MORE NUTRITION – Iced Coffee RTD (330ml Flasche)
  { id:15, name:"More Nutrition Iced Coffee Vanilla (330ml)", cal:90, p:20, c:2.0, f:0.5, fi:0, unit:"ml", unitLabel:"330ml Flasche", cat:"More Nutrition", inflammatory:false, endo_ok:true },
  { id:16, name:"More Nutrition Iced Coffee Cappuccino (330ml)", cal:95, p:20.5, c:2.5, f:0.6, fi:0, unit:"ml", unitLabel:"330ml Flasche", cat:"More Nutrition", inflammatory:false, endo_ok:true },
  { id:17, name:"More Nutrition Iced Coffee Chocolate (330ml)", cal:100, p:20, c:3.5, f:0.8, fi:0.5, unit:"ml", unitLabel:"330ml Flasche", cat:"More Nutrition", inflammatory:false, endo_ok:true },
  { id:18, name:"More Nutrition Iced Coffee Caramel (330ml)", cal:92, p:20, c:2.2, f:0.5, fi:0, unit:"ml", unitLabel:"330ml Flasche", cat:"More Nutrition", inflammatory:false, endo_ok:true },
  // MORE NUTRITION – High Protein Pudding
  { id:19, name:"More Nutrition High Protein Pudding Vanilla", cal:94, p:15.2, c:5.1, f:1.3, fi:0.2, unit:"g", unitLabel:"100g", cat:"More Nutrition", inflammatory:false, endo_ok:true },
  { id:20, name:"More Nutrition High Protein Pudding Chocolate", cal:97, p:15.0, c:5.8, f:1.5, fi:0.5, unit:"g", unitLabel:"100g", cat:"More Nutrition", inflammatory:false, endo_ok:true },
  { id:21, name:"More Nutrition High Protein Pudding Stracciatella", cal:96, p:15.1, c:5.5, f:1.4, fi:0.3, unit:"g", unitLabel:"100g", cat:"More Nutrition", inflammatory:false, endo_ok:true },
  { id:22, name:"More Nutrition Protein Bar Chocolate", cal:197, p:20.1, c:19.4, f:5.2, fi:2.3, unit:"g", unitLabel:"60g Bar", cat:"More Nutrition", inflammatory:false, endo_ok:true },
  { id:23, name:"More Nutrition Protein Bar Peanut", cal:203, p:20.5, c:18.0, f:6.1, fi:2.0, unit:"g", unitLabel:"60g Bar", cat:"More Nutrition", inflammatory:false, endo_ok:true },
  { id:24, name:"More Nutrition Zero Syrup Vanilla", cal:4, p:0, c:0.6, f:0, fi:0, unit:"ml", unitLabel:"15ml", cat:"More Nutrition", inflammatory:false, endo_ok:true },
  { id:25, name:"More Nutrition Zero Syrup Caramel", cal:4, p:0, c:0.6, f:0, fi:0, unit:"ml", unitLabel:"15ml", cat:"More Nutrition", inflammatory:false, endo_ok:true },
  { id:26, name:"More Nutrition Zero Syrup Chocolate", cal:5, p:0, c:0.8, f:0, fi:0, unit:"ml", unitLabel:"15ml", cat:"More Nutrition", inflammatory:false, endo_ok:true },
  { id:27, name:"More Nutrition Creatine Monohydrate", cal:0, p:0, c:0, f:0, fi:0, unit:"g", unitLabel:"5g", cat:"More Nutrition", inflammatory:false, endo_ok:true },
  { id:28, name:"More Nutrition Omega 3", cal:9, p:0, c:0, f:1.0, fi:0, unit:"g", unitLabel:"1 Kapsel", cat:"More Nutrition", inflammatory:false, endo_ok:true },
  // SUPPLEMENTE
  { id:29, name:"Vitamin A 800mcg", cal:0, p:0, c:0, f:0, fi:0, unit:"g", unitLabel:"1 Kapsel", cat:"Supplemente", inflammatory:false, endo_ok:true },
  { id:30, name:"Vitamin B-Komplex", cal:0, p:0, c:0, f:0, fi:0, unit:"g", unitLabel:"1 Kapsel", cat:"Supplemente", inflammatory:false, endo_ok:true },
  { id:31, name:"Vitamin B12 1000mcg", cal:0, p:0, c:0, f:0, fi:0, unit:"g", unitLabel:"1 Tablette", cat:"Supplemente", inflammatory:false, endo_ok:true },
  { id:32, name:"Vitamin C 1000mg", cal:0, p:0, c:0, f:0, fi:0, unit:"g", unitLabel:"1 Tablette", cat:"Supplemente", inflammatory:false, endo_ok:true },
  { id:33, name:"Vitamin D3 4000 IE", cal:0, p:0, c:0, f:0, fi:0, unit:"ml", unitLabel:"1 Tropfen", cat:"Supplemente", inflammatory:false, endo_ok:true },
  { id:34, name:"Vitamin E 400 IE", cal:0, p:0, c:0, f:0, fi:0, unit:"g", unitLabel:"1 Kapsel", cat:"Supplemente", inflammatory:false, endo_ok:true },
  { id:35, name:"Magnesium Glycinat 400mg", cal:0, p:0, c:0, f:0, fi:0, unit:"g", unitLabel:"1 Kapsel", cat:"Supplemente", inflammatory:false, endo_ok:true },
  { id:36, name:"Omega-3 Fischöl EPA/DHA", cal:9, p:0, c:0, f:1.0, fi:0, unit:"g", unitLabel:"1 Kapsel", cat:"Supplemente", inflammatory:false, endo_ok:true },
  { id:37, name:"Zink 25mg", cal:0, p:0, c:0, f:0, fi:0, unit:"g", unitLabel:"1 Tablette", cat:"Supplemente", inflammatory:false, endo_ok:true },
  { id:38, name:"Eisen Bisglycinat 25mg", cal:0, p:0, c:0, f:0, fi:0, unit:"g", unitLabel:"1 Kapsel", cat:"Supplemente", inflammatory:false, endo_ok:true },
  { id:39, name:"Folsäure 400mcg", cal:0, p:0, c:0, f:0, fi:0, unit:"g", unitLabel:"1 Tablette", cat:"Supplemente", inflammatory:false, endo_ok:true },
  { id:40, name:"Kurkuma Extrakt 500mg", cal:0, p:0, c:0, f:0, fi:0, unit:"g", unitLabel:"1 Kapsel", cat:"Supplemente", inflammatory:false, endo_ok:true },
  // MEHLSORTEN
  { id:41, name:"Weizenmehl Type 405", cal:356, p:10.6, c:74.0, f:1.0, fi:2.7, unit:"g", unitLabel:"100g", cat:"Mehl & Getreide", inflammatory:true, endo_ok:false, warn:"Weizenmehl 405 ist stark verarbeitet – kann Entzündungen fördern. Bei Endometriose möglichst ersetzen." },
  { id:42, name:"Weizenmehl Type 550", cal:340, p:11.5, c:70.0, f:1.2, fi:3.2, unit:"g", unitLabel:"100g", cat:"Mehl & Getreide", inflammatory:true, endo_ok:false, warn:"Weißmehl fördert Entzündungen – durch Dinkel oder Vollkorn ersetzen." },
  { id:43, name:"Dinkelmehl Type 630", cal:327, p:13.3, c:62.0, f:2.5, fi:5.5, unit:"g", unitLabel:"100g", cat:"Mehl & Getreide", inflammatory:false, endo_ok:true },
  { id:44, name:"Dinkelmehl Vollkorn", cal:313, p:14.0, c:57.0, f:2.9, fi:10.7, unit:"g", unitLabel:"100g", cat:"Mehl & Getreide", inflammatory:false, endo_ok:true },
  { id:45, name:"Roggenmehl Type 997", cal:321, p:9.6, c:67.0, f:1.7, fi:9.4, unit:"g", unitLabel:"100g", cat:"Mehl & Getreide", inflammatory:false, endo_ok:true },
  { id:46, name:"Vollkornweizenmehl", cal:310, p:13.2, c:60.0, f:2.5, fi:10.7, unit:"g", unitLabel:"100g", cat:"Mehl & Getreide", inflammatory:false, endo_ok:true },
  { id:47, name:"Hafermehl (glutenfrei)", cal:372, p:13.5, c:59.0, f:7.1, fi:10.6, unit:"g", unitLabel:"100g", cat:"Mehl & Getreide", inflammatory:false, endo_ok:true },
  { id:48, name:"Mandelmehl (entölt)", cal:290, p:51.0, c:4.3, f:8.5, fi:14.0, unit:"g", unitLabel:"100g", cat:"Mehl & Getreide", inflammatory:false, endo_ok:true },
  { id:49, name:"Kokosmehl", cal:387, p:19.3, c:21.8, f:14.6, fi:38.5, unit:"g", unitLabel:"100g", cat:"Mehl & Getreide", inflammatory:false, endo_ok:true },
  { id:50, name:"Buchweizenmehl", cal:340, p:12.6, c:70.0, f:3.1, fi:10.0, unit:"g", unitLabel:"100g", cat:"Mehl & Getreide", inflammatory:false, endo_ok:true },
  { id:51, name:"Flohsamenschalen", cal:218, p:2.7, c:1.8, f:0.9, fi:79.0, unit:"g", unitLabel:"100g", cat:"Mehl & Getreide", inflammatory:false, endo_ok:true },
  { id:52, name:"Flohsamenschalenpulver", cal:195, p:2.4, c:1.3, f:0.7, fi:82.0, unit:"g", unitLabel:"100g", cat:"Mehl & Getreide", inflammatory:false, endo_ok:true },
  { id:53, name:"Haferflocken zart", cal:364, p:13.5, c:58.7, f:6.9, fi:9.7, unit:"g", unitLabel:"100g", cat:"Mehl & Getreide", inflammatory:false, endo_ok:true },
  { id:54, name:"Haferflocken kernig", cal:366, p:13.9, c:57.9, f:7.2, fi:10.3, unit:"g", unitLabel:"100g", cat:"Mehl & Getreide", inflammatory:false, endo_ok:true },
  // FLEISCH & FISCH (korrekte Werte)
  { id:55, name:"Hähnchenbrustfilet (roh)", cal:105, p:23.1, c:0, f:1.2, fi:0, unit:"g", unitLabel:"100g", cat:"Fleisch & Fisch", inflammatory:false, endo_ok:true },
  { id:56, name:"Putenbrust (roh)", cal:99, p:23.5, c:0, f:0.6, fi:0, unit:"g", unitLabel:"100g", cat:"Fleisch & Fisch", inflammatory:false, endo_ok:true },
  { id:57, name:"Rinderhack 20% Fett", cal:262, p:17.2, c:0, f:21.5, fi:0, unit:"g", unitLabel:"100g", cat:"Fleisch & Fisch", inflammatory:true, endo_ok:false, warn:"Rotes Fleisch fördert Entzündungen – bei Endometriose Menge reduzieren." },
  { id:58, name:"Rinderhack 5% Fett", cal:136, p:21.4, c:0, f:5.4, fi:0, unit:"g", unitLabel:"100g", cat:"Fleisch & Fisch", inflammatory:true, endo_ok:false, warn:"Rotes Fleisch: bei Endometriose Konsum einschränken." },
  { id:59, name:"Lachsfilet (frisch)", cal:142, p:19.9, c:0, f:6.3, fi:0, unit:"g", unitLabel:"100g", cat:"Fleisch & Fisch", inflammatory:false, endo_ok:true },
  { id:60, name:"Thunfisch Dose in Wasser", cal:116, p:25.5, c:0, f:1.0, fi:0, unit:"g", unitLabel:"100g", cat:"Fleisch & Fisch", inflammatory:false, endo_ok:true },
  { id:61, name:"Thunfisch Dose in Öl", cal:189, p:25.0, c:0, f:9.9, fi:0, unit:"g", unitLabel:"100g", cat:"Fleisch & Fisch", inflammatory:false, endo_ok:true },
  { id:62, name:"Garnelen (TK, roh)", cal:71, p:15.2, c:0, f:0.9, fi:0, unit:"g", unitLabel:"100g", cat:"Fleisch & Fisch", inflammatory:false, endo_ok:true },
  // MILCHPRODUKTE (korrekte Werte)
  { id:63, name:"Griechischer Joghurt 0%", cal:57, p:10.3, c:3.6, f:0.2, fi:0, unit:"g", unitLabel:"100g", cat:"Milchprodukte", inflammatory:false, endo_ok:true },
  { id:64, name:"Griechischer Joghurt 2%", cal:73, p:8.2, c:3.8, f:2.0, fi:0, unit:"g", unitLabel:"100g", cat:"Milchprodukte", inflammatory:false, endo_ok:true },
  { id:65, name:"Magerquark", cal:61, p:12.1, c:3.2, f:0.3, fi:0, unit:"g", unitLabel:"100g", cat:"Milchprodukte", inflammatory:false, endo_ok:true },
  { id:66, name:"Skyr Natur", cal:63, p:11.0, c:4.0, f:0.2, fi:0, unit:"g", unitLabel:"100g", cat:"Milchprodukte", inflammatory:false, endo_ok:true },
  { id:67, name:"Hüttenkäse", cal:85, p:11.1, c:3.4, f:2.4, fi:0, unit:"g", unitLabel:"100g", cat:"Milchprodukte", inflammatory:false, endo_ok:true },
  { id:68, name:"Vollmilch 3,5%", cal:64, p:3.3, c:4.7, f:3.5, fi:0, unit:"ml", unitLabel:"100ml", cat:"Milchprodukte", inflammatory:false, endo_ok:true },
  { id:69, name:"Fettarme Milch 1,5%", cal:46, p:3.4, c:4.8, f:1.5, fi:0, unit:"ml", unitLabel:"100ml", cat:"Milchprodukte", inflammatory:false, endo_ok:true },
  { id:70, name:"Creme Fraiche (30%)", cal:292, p:2.4, c:2.8, f:30.0, fi:0, unit:"g", unitLabel:"100g", cat:"Milchprodukte", inflammatory:false, endo_ok:true },
  { id:71, name:"Feta (45% F.i.Tr.)", cal:261, p:15.6, c:0.7, f:21.3, fi:0, unit:"g", unitLabel:"100g", cat:"Milchprodukte", inflammatory:false, endo_ok:true },
  { id:72, name:"Mozzarella (light)", cal:170, p:18.5, c:1.0, f:10.5, fi:0, unit:"g", unitLabel:"100g", cat:"Milchprodukte", inflammatory:false, endo_ok:true },
  { id:73, name:"Parmesan gerieben", cal:392, p:32.4, c:0, f:28.6, fi:0, unit:"g", unitLabel:"100g", cat:"Milchprodukte", inflammatory:false, endo_ok:true },
  { id:74, name:"Ei (Größe M, 55g)", cal:77, p:6.4, c:0.3, f:5.3, fi:0, unit:"g", unitLabel:"1 Ei (55g)", cat:"Milchprodukte", inflammatory:false, endo_ok:true },
  { id:75, name:"Eiweiß flüssig", cal:47, p:10.9, c:0.7, f:0.1, fi:0, unit:"ml", unitLabel:"100ml", cat:"Milchprodukte", inflammatory:false, endo_ok:true },
  // PFLANZENDRINKS (korrekte Werte)
  { id:76, name:"Haferdrink ungesüßt (OATLY)", cal:45, p:1.0, c:6.5, f:1.5, fi:0.8, unit:"ml", unitLabel:"100ml", cat:"Pflanzendrinks", inflammatory:false, endo_ok:true },
  { id:77, name:"Mandeldrink ungesüßt", cal:17, p:0.6, c:0.8, f:1.4, fi:0.4, unit:"ml", unitLabel:"100ml", cat:"Pflanzendrinks", inflammatory:false, endo_ok:true },
  { id:78, name:"Sojadrink Natur", cal:39, p:3.6, c:2.3, f:1.9, fi:0.4, unit:"ml", unitLabel:"100ml", cat:"Pflanzendrinks", inflammatory:false, endo_ok:true },
  { id:79, name:"Kokosdrink ungesüßt", cal:21, p:0.2, c:2.8, f:1.0, fi:0, unit:"ml", unitLabel:"100ml", cat:"Pflanzendrinks", inflammatory:false, endo_ok:true },
  // GEMÜSE (korrekte Werte)
  { id:80, name:"Brokkoli", cal:25, p:2.8, c:2.7, f:0.4, fi:3.3, unit:"g", unitLabel:"100g", cat:"Gemüse", inflammatory:false, endo_ok:true },
  { id:81, name:"Spinat frisch", cal:17, p:2.5, c:0.6, f:0.4, fi:2.6, unit:"g", unitLabel:"100g", cat:"Gemüse", inflammatory:false, endo_ok:true },
  { id:82, name:"Süßkartoffel", cal:86, p:1.6, c:19.7, f:0.1, fi:2.5, unit:"g", unitLabel:"100g", cat:"Gemüse", inflammatory:false, endo_ok:true },
  { id:83, name:"Kartoffeln", cal:69, p:1.9, c:15.4, f:0.1, fi:2.1, unit:"g", unitLabel:"100g", cat:"Gemüse", inflammatory:false, endo_ok:true },
  { id:84, name:"Zucchini", cal:17, p:1.2, c:2.5, f:0.3, fi:1.1, unit:"g", unitLabel:"100g", cat:"Gemüse", inflammatory:false, endo_ok:true },
  { id:85, name:"Paprika rot", cal:31, p:1.0, c:5.4, f:0.3, fi:2.1, unit:"g", unitLabel:"100g", cat:"Gemüse", inflammatory:false, endo_ok:true },
  { id:86, name:"Tomate", cal:17, p:0.9, c:2.6, f:0.2, fi:1.2, unit:"g", unitLabel:"100g", cat:"Gemüse", inflammatory:false, endo_ok:true },
  { id:87, name:"Gurke", cal:12, p:0.6, c:1.6, f:0.1, fi:0.6, unit:"g", unitLabel:"100g", cat:"Gemüse", inflammatory:false, endo_ok:true },
  { id:88, name:"Karotte", cal:35, p:0.9, c:6.7, f:0.2, fi:3.1, unit:"g", unitLabel:"100g", cat:"Gemüse", inflammatory:false, endo_ok:true },
  { id:89, name:"Avocado", cal:160, p:2.0, c:1.8, f:14.7, fi:6.7, unit:"g", unitLabel:"100g", cat:"Gemüse", inflammatory:false, endo_ok:true },
  { id:90, name:"Champignons", cal:15, p:2.7, c:0.3, f:0.2, fi:1.7, unit:"g", unitLabel:"100g", cat:"Gemüse", inflammatory:false, endo_ok:true },
  { id:91, name:"Weißkohl", cal:24, p:1.3, c:3.4, f:0.2, fi:2.9, unit:"g", unitLabel:"100g", cat:"Gemüse", inflammatory:false, endo_ok:true, warn:"Weißkohl: stark blähend – in der Lutealphase vermeiden." },
  { id:92, name:"Zwiebel", cal:38, p:1.2, c:7.9, f:0.1, fi:1.7, unit:"g", unitLabel:"100g", cat:"Gemüse", inflammatory:false, endo_ok:true, warn:"Zwiebeln: können Blähungen fördern – in der Lutealphase weniger verwenden." },
  // OBST
  { id:93, name:"Banane", cal:89, p:1.1, c:22.8, f:0.3, fi:2.6, unit:"g", unitLabel:"100g", cat:"Obst", inflammatory:false, endo_ok:true },
  { id:94, name:"Apfel", cal:52, p:0.3, c:13.8, f:0.2, fi:2.4, unit:"g", unitLabel:"100g", cat:"Obst", inflammatory:false, endo_ok:true },
  { id:95, name:"Blaubeeren", cal:57, p:0.7, c:14.5, f:0.3, fi:2.4, unit:"g", unitLabel:"100g", cat:"Obst", inflammatory:false, endo_ok:true },
  { id:96, name:"Erdbeeren", cal:32, p:0.7, c:7.7, f:0.3, fi:2.0, unit:"g", unitLabel:"100g", cat:"Obst", inflammatory:false, endo_ok:true },
  { id:97, name:"Himbeeren", cal:52, p:1.2, c:11.9, f:0.7, fi:6.7, unit:"g", unitLabel:"100g", cat:"Obst", inflammatory:false, endo_ok:true },
  { id:98, name:"Mango", cal:60, p:0.8, c:15.0, f:0.4, fi:1.8, unit:"g", unitLabel:"100g", cat:"Obst", inflammatory:false, endo_ok:true },
  { id:99, name:"Orange", cal:47, p:0.9, c:11.2, f:0.1, fi:2.2, unit:"g", unitLabel:"100g", cat:"Obst", inflammatory:false, endo_ok:true },
  // GETREIDE & REIS
  { id:100, name:"Basmati Reis roh", cal:357, p:7.0, c:79.5, f:0.6, fi:0.5, unit:"g", unitLabel:"100g", cat:"Getreide & Reis", inflammatory:false, endo_ok:true },
  { id:306, name:"Basmati Reis gekocht", cal:130, p:2.7, c:28.2, f:0.3, fi:0.4, unit:"g", unitLabel:"100g", cat:"Getreide & Reis", inflammatory:false, endo_ok:true },
  { id:307, name:"Vollkornreis gekocht", cal:112, p:2.6, c:23.5, f:0.9, fi:1.8, unit:"g", unitLabel:"100g", cat:"Getreide & Reis", inflammatory:false, endo_ok:true },
  { id:308, name:"Jasminreis gekocht", cal:129, p:2.7, c:28.6, f:0.3, fi:0.4, unit:"g", unitLabel:"100g", cat:"Getreide & Reis", inflammatory:false, endo_ok:true },
  { id:309, name:"Parboiled Reis gekocht", cal:135, p:2.9, c:29.5, f:0.3, fi:0.5, unit:"g", unitLabel:"100g", cat:"Getreide & Reis", inflammatory:false, endo_ok:true },
  { id:310, name:"Quinoa gekocht", cal:120, p:4.4, c:21.3, f:1.9, fi:2.8, unit:"g", unitLabel:"100g", cat:"Getreide & Reis", inflammatory:false, endo_ok:true },
  { id:311, name:"Hirse gekocht", cal:119, p:3.5, c:23.7, f:1.0, fi:1.3, unit:"g", unitLabel:"100g", cat:"Getreide & Reis", inflammatory:false, endo_ok:true },
  { id:312, name:"Buchweizen gekocht", cal:92, p:3.4, c:19.9, f:0.6, fi:2.7, unit:"g", unitLabel:"100g", cat:"Getreide & Reis", inflammatory:false, endo_ok:true },
  { id:313, name:"Couscous gekocht", cal:112, p:3.8, c:23.2, f:0.2, fi:1.4, unit:"g", unitLabel:"100g", cat:"Getreide & Reis", inflammatory:false, endo_ok:true },
  { id:314, name:"Vollkorn-Nudeln gekocht", cal:124, p:5.3, c:24.0, f:1.0, fi:3.4, unit:"g", unitLabel:"100g", cat:"Getreide & Reis", inflammatory:false, endo_ok:true },
  { id:315, name:"Nudeln weiß gekocht", cal:131, p:4.5, c:26.2, f:0.5, fi:1.2, unit:"g", unitLabel:"100g", cat:"Getreide & Reis", inflammatory:false, endo_ok:true },
  { id:101, name:"Quinoa roh", cal:368, p:14.1, c:57.2, f:6.1, fi:7.0, unit:"g", unitLabel:"100g", cat:"Getreide & Reis", inflammatory:false, endo_ok:true },
  { id:102, name:"Vollkorn-Nudeln roh", cal:329, p:13.4, c:62.0, f:2.7, fi:8.0, unit:"g", unitLabel:"100g", cat:"Getreide & Reis", inflammatory:false, endo_ok:true },
  { id:103, name:"Nudeln weiß roh", cal:353, p:12.5, c:72.2, f:1.5, fi:2.5, unit:"g", unitLabel:"100g", cat:"Getreide & Reis", inflammatory:false, endo_ok:true },
  // HÜLSENFRÜCHTE
  { id:104, name:"Linsen rot roh", cal:318, p:26.0, c:52.0, f:1.1, fi:15.6, unit:"g", unitLabel:"100g", cat:"Hülsenfrüchte", inflammatory:false, endo_ok:true, warn:"Linsen: blähend – in der Lutealphase einschränken." },
  { id:105, name:"Kichererbsen (Dose, abgetropft)", cal:119, p:8.0, c:16.0, f:2.6, fi:5.4, unit:"g", unitLabel:"100g", cat:"Hülsenfrüchte", inflammatory:false, endo_ok:true, warn:"Hülsenfrüchte: blähend – in der Lutealphase mäßig." },
  // NÜSSE & SAMEN
  { id:106, name:"Mandeln", cal:576, p:21.3, c:4.3, f:49.4, fi:12.8, unit:"g", unitLabel:"100g", cat:"Nüsse & Samen", inflammatory:false, endo_ok:true },
  { id:107, name:"Walnüsse", cal:654, p:15.2, c:2.5, f:65.2, fi:6.7, unit:"g", unitLabel:"100g", cat:"Nüsse & Samen", inflammatory:false, endo_ok:true },
  { id:108, name:"Kürbiskerne", cal:446, p:24.5, c:13.5, f:35.5, fi:6.0, unit:"g", unitLabel:"100g", cat:"Nüsse & Samen", inflammatory:false, endo_ok:true },
  { id:109, name:"Chiasamen", cal:490, p:16.5, c:7.7, f:30.7, fi:34.4, unit:"g", unitLabel:"100g", cat:"Nüsse & Samen", inflammatory:false, endo_ok:true },
  { id:110, name:"Leinsamen", cal:495, p:18.3, c:3.8, f:38.6, fi:27.3, unit:"g", unitLabel:"100g", cat:"Nüsse & Samen", inflammatory:false, endo_ok:true },
  { id:111, name:"Erdnussbutter (natur)", cal:588, p:25.0, c:13.0, f:50.0, fi:5.9, unit:"g", unitLabel:"100g", cat:"Nüsse & Samen", inflammatory:false, endo_ok:true },
  { id:112, name:"Mandelmus", cal:614, p:22.1, c:6.1, f:55.5, fi:12.8, unit:"g", unitLabel:"100g", cat:"Nüsse & Samen", inflammatory:false, endo_ok:true },
  // FETTE & ÖLE
  { id:113, name:"Olivenöl extra vergine", cal:884, p:0, c:0, f:100, fi:0, unit:"ml", unitLabel:"100ml", cat:"Fette & Öle", inflammatory:false, endo_ok:true },
  { id:114, name:"Butter", cal:717, p:0.9, c:0.1, f:81.1, fi:0, unit:"g", unitLabel:"100g", cat:"Fette & Öle", inflammatory:false, endo_ok:true },
  { id:115, name:"Kokosöl", cal:862, p:0, c:0, f:99.1, fi:0, unit:"g", unitLabel:"100g", cat:"Fette & Öle", inflammatory:false, endo_ok:true },
  // BROT
  { id:116, name:"Vollkornbrot", cal:211, p:9.0, c:36.8, f:2.6, fi:9.0, unit:"g", unitLabel:"100g", cat:"Brot & Backwaren", inflammatory:false, endo_ok:true },
  { id:117, name:"Toastbrot weiß", cal:266, p:9.5, c:50.0, f:2.8, fi:2.4, unit:"g", unitLabel:"100g", cat:"Brot & Backwaren", inflammatory:true, endo_ok:false, warn:"Toastbrot: hoher GI – bei Endometriose durch Vollkorn ersetzen." },
  { id:118, name:"Knäckebrot Vollkorn", cal:321, p:11.0, c:59.0, f:3.0, fi:16.5, unit:"g", unitLabel:"100g", cat:"Brot & Backwaren", inflammatory:false, endo_ok:true },
  // ENERGYDRINKS & SOFTDRINKS
  { id:119, name:"Red Bull Original (250ml)", cal:113, p:0, c:27.5, f:0, fi:0, unit:"ml", unitLabel:"250ml Dose", cat:"Drinks & Energy", inflammatory:true, endo_ok:false, warn:"Red Bull: hoher Zuckergehalt und Koffein – bei Endometriose & Lutealphase vermeiden." },
  { id:120, name:"Red Bull Sugar Free (250ml)", cal:7, p:0.8, c:0.3, f:0, fi:0, unit:"ml", unitLabel:"250ml Dose", cat:"Drinks & Energy", inflammatory:false, endo_ok:true },
  { id:121, name:"Red Bull Zero (250ml)", cal:5, p:0.8, c:0.3, f:0, fi:0, unit:"ml", unitLabel:"250ml Dose", cat:"Drinks & Energy", inflammatory:false, endo_ok:true },
  { id:122, name:"Red Bull Tropical (250ml)", cal:115, p:0, c:28.0, f:0, fi:0, unit:"ml", unitLabel:"250ml Dose", cat:"Drinks & Energy", inflammatory:true, endo_ok:false, warn:"Zuckerhaltiger Energydrink – bei Endometriose & Lutealphase meiden." },
  { id:123, name:"Red Bull Watermelon (250ml)", cal:113, p:0, c:27.5, f:0, fi:0, unit:"ml", unitLabel:"250ml Dose", cat:"Drinks & Energy", inflammatory:true, endo_ok:false },
  { id:124, name:"Monster Energy Original (500ml)", cal:225, p:0, c:55.0, f:0, fi:0, unit:"ml", unitLabel:"500ml Dose", cat:"Drinks & Energy", inflammatory:true, endo_ok:false, warn:"Monster Energy: sehr hoher Zucker- und Koffeingehalt – generell und besonders bei Endometriose meiden." },
  { id:125, name:"Monster Energy Ultra White (500ml)", cal:25, p:0, c:3.5, f:0, fi:0, unit:"ml", unitLabel:"500ml Dose", cat:"Drinks & Energy", inflammatory:false, endo_ok:true },
  { id:126, name:"Monster Energy Zero Sugar (500ml)", cal:20, p:0, c:3.0, f:0, fi:0, unit:"ml", unitLabel:"500ml Dose", cat:"Drinks & Energy", inflammatory:false, endo_ok:true },
  { id:127, name:"Monster Juiced Mango Loco (500ml)", cal:230, p:0, c:56.0, f:0, fi:0, unit:"ml", unitLabel:"500ml Dose", cat:"Drinks & Energy", inflammatory:true, endo_ok:false, warn:"Sehr hoher Zuckergehalt." },
  { id:128, name:"Coca-Cola (330ml)", cal:139, p:0, c:35.0, f:0, fi:0, unit:"ml", unitLabel:"330ml Dose", cat:"Drinks & Energy", inflammatory:true, endo_ok:false, warn:"Hoher Zuckergehalt – Blähungen möglich durch Kohlensäure." },
  { id:129, name:"Coca-Cola Zero (330ml)", cal:1, p:0, c:0.1, f:0, fi:0, unit:"ml", unitLabel:"330ml Dose", cat:"Drinks & Energy", inflammatory:false, endo_ok:true },
  { id:130, name:"Fanta Orange (330ml)", cal:144, p:0, c:35.6, f:0, fi:0, unit:"ml", unitLabel:"330ml Dose", cat:"Drinks & Energy", inflammatory:true, endo_ok:false },
  { id:131, name:"Orangensaft (frisch)", cal:45, p:0.7, c:10.4, f:0.2, fi:0.2, unit:"ml", unitLabel:"100ml", cat:"Drinks & Energy", inflammatory:false, endo_ok:true },
  { id:132, name:"Kaffee schwarz", cal:2, p:0.3, c:0, f:0, fi:0, unit:"ml", unitLabel:"100ml", cat:"Drinks & Energy", inflammatory:false, endo_ok:true },
  { id:133, name:"Espresso (30ml)", cal:2, p:0.1, c:0.3, f:0, fi:0, unit:"ml", unitLabel:"30ml Shot", cat:"Drinks & Energy", inflammatory:false, endo_ok:true },
  // SCHOKOLADE & SÜSSES
  { id:134, name:"Dunkle Schokolade 85%", cal:598, p:9.0, c:22.0, f:52.0, fi:11.0, unit:"g", unitLabel:"100g", cat:"Süßes & Snacks", inflammatory:false, endo_ok:true },
  { id:135, name:"Dunkle Schokolade 70%", cal:577, p:8.4, c:30.0, f:47.0, fi:8.0, unit:"g", unitLabel:"100g", cat:"Süßes & Snacks", inflammatory:false, endo_ok:true },
  { id:136, name:"Milchschokolade (Milka)", cal:535, p:7.0, c:60.0, f:30.0, fi:1.9, unit:"g", unitLabel:"100g", cat:"Süßes & Snacks", inflammatory:true, endo_ok:false, warn:"Milchschokolade: Zucker & gesättigte Fette fördern Entzündungen." },
  { id:137, name:"Milchschokolade mit Nuss (Milka)", cal:553, p:7.5, c:56.0, f:33.5, fi:2.1, unit:"g", unitLabel:"100g", cat:"Süßes & Snacks", inflammatory:true, endo_ok:false },
  { id:138, name:"Lindt Lindor Vollmilch (1 Kugel)", cal:73, p:0.7, c:6.6, f:4.9, fi:0.1, unit:"g", unitLabel:"12.5g Kugel", cat:"Süßes & Snacks", inflammatory:true, endo_ok:false },
  { id:139, name:"Weißer Zucker", cal:400, p:0, c:100, f:0, fi:0, unit:"g", unitLabel:"100g", cat:"Süßes & Snacks", inflammatory:true, endo_ok:false, warn:"Zucker ist stark entzündungsfördernd – bei Endometriose möglichst meiden." },
  { id:140, name:"Honig", cal:304, p:0.3, c:80.3, f:0, fi:0.2, unit:"g", unitLabel:"100g", cat:"Süßes & Snacks", inflammatory:false, endo_ok:true },
  { id:141, name:"Ahornsirup", cal:260, p:0, c:67.0, f:0.1, fi:0, unit:"ml", unitLabel:"100ml", cat:"Süßes & Snacks", inflammatory:false, endo_ok:true },
  { id:142, name:"Erythrit", cal:0, p:0, c:100, f:0, fi:0, unit:"g", unitLabel:"100g", cat:"Süßes & Snacks", inflammatory:false, endo_ok:true },
  // GEWÜRZE
  { id:143, name:"Kurkuma gemahlen", cal:312, p:9.7, c:67.1, f:3.3, fi:22.7, unit:"g", unitLabel:"100g", cat:"Gewürze & Saucen", inflammatory:false, endo_ok:true },
  { id:144, name:"Ingwer frisch", cal:80, p:1.8, c:17.8, f:0.8, fi:2.0, unit:"g", unitLabel:"100g", cat:"Gewürze & Saucen", inflammatory:false, endo_ok:true },
  { id:145, name:"Zimt gemahlen", cal:261, p:3.9, c:79.8, f:1.2, fi:53.1, unit:"g", unitLabel:"100g", cat:"Gewürze & Saucen", inflammatory:false, endo_ok:true },
  { id:146, name:"Tomatenpaste", cal:78, p:4.1, c:14.1, f:0.5, fi:2.4, unit:"g", unitLabel:"100g", cat:"Gewürze & Saucen", inflammatory:false, endo_ok:true },
  { id:147, name:"Tahini (Sesammus)", cal:570, p:17.0, c:26.2, f:48.1, fi:9.3, unit:"g", unitLabel:"100g", cat:"Gewürze & Saucen", inflammatory:false, endo_ok:true },
  { id:148, name:"Kokosmilch (Dose)", cal:230, p:2.3, c:5.5, f:23.8, fi:0.2, unit:"ml", unitLabel:"100ml", cat:"Gewürze & Saucen", inflammatory:false, endo_ok:true },

  // PFLANZENMILCH (alle Sorten)
  { id:149, name:"Mandelmilch ungesüßt", cal:17, p:0.6, c:0.8, f:1.4, fi:0.4, unit:"ml", unitLabel:"100ml", cat:"Pflanzenmilch", inflammatory:false, endo_ok:true },
  { id:150, name:"Mandelmilch gesüßt", cal:30, p:0.6, c:4.5, f:1.2, fi:0.4, unit:"ml", unitLabel:"100ml", cat:"Pflanzenmilch", inflammatory:false, endo_ok:true },
  { id:151, name:"Hafermilch ungesüßt (OATLY)", cal:45, p:1.0, c:6.5, f:1.5, fi:0.8, unit:"ml", unitLabel:"100ml", cat:"Pflanzenmilch", inflammatory:false, endo_ok:true },
  { id:152, name:"Hafermilch Barista (OATLY)", cal:60, p:1.0, c:9.0, f:2.0, fi:0.8, unit:"ml", unitLabel:"100ml", cat:"Pflanzenmilch", inflammatory:false, endo_ok:true },
  { id:153, name:"Hafermilch (ALPRO)", cal:46, p:1.0, c:6.6, f:1.6, fi:0.8, unit:"ml", unitLabel:"100ml", cat:"Pflanzenmilch", inflammatory:false, endo_ok:true },
  { id:154, name:"Hafermilch (BILLA Eigenmarke)", cal:42, p:0.9, c:6.3, f:1.4, fi:0.7, unit:"ml", unitLabel:"100ml", cat:"Pflanzenmilch", inflammatory:false, endo_ok:true },
  { id:155, name:"Hafermilch (HOFER)", cal:44, p:0.9, c:6.5, f:1.5, fi:0.7, unit:"ml", unitLabel:"100ml", cat:"Pflanzenmilch", inflammatory:false, endo_ok:true },
  { id:156, name:"Kokosmilch-Drink ungesüßt", cal:21, p:0.2, c:2.8, f:1.0, fi:0, unit:"ml", unitLabel:"100ml", cat:"Pflanzenmilch", inflammatory:false, endo_ok:true },
  { id:157, name:"Kokosmilch-Drink gesüßt", cal:35, p:0.2, c:5.5, f:1.2, fi:0, unit:"ml", unitLabel:"100ml", cat:"Pflanzenmilch", inflammatory:false, endo_ok:true },
  { id:158, name:"Reismilch ungesüßt", cal:47, p:0.1, c:9.7, f:1.0, fi:0.3, unit:"ml", unitLabel:"100ml", cat:"Pflanzenmilch", inflammatory:false, endo_ok:true },
  { id:159, name:"Reismilch gesüßt", cal:55, p:0.1, c:11.5, f:1.0, fi:0.3, unit:"ml", unitLabel:"100ml", cat:"Pflanzenmilch", inflammatory:false, endo_ok:true },
  { id:160, name:"Sojamilch Natur (ALPRO)", cal:39, p:3.6, c:2.3, f:1.9, fi:0.4, unit:"ml", unitLabel:"100ml", cat:"Pflanzenmilch", inflammatory:false, endo_ok:true },
  { id:161, name:"Sojamilch ungesüßt", cal:33, p:3.3, c:0.9, f:1.8, fi:0.4, unit:"ml", unitLabel:"100ml", cat:"Pflanzenmilch", inflammatory:false, endo_ok:true },
  { id:162, name:"Cashewmilch ungesüßt", cal:19, p:0.5, c:1.3, f:1.3, fi:0.2, unit:"ml", unitLabel:"100ml", cat:"Pflanzenmilch", inflammatory:false, endo_ok:true },
  { id:163, name:"Erbsenmilch (VOLVIC)", cal:35, p:3.2, c:2.8, f:1.5, fi:0, unit:"ml", unitLabel:"100ml", cat:"Pflanzenmilch", inflammatory:false, endo_ok:true },
  { id:164, name:"Dinkelmilch", cal:48, p:1.6, c:7.8, f:1.2, fi:0.5, unit:"ml", unitLabel:"100ml", cat:"Pflanzenmilch", inflammatory:false, endo_ok:true },
  { id:165, name:"Hanfmilch ungesüßt", cal:33, p:2.0, c:1.4, f:2.4, fi:0.4, unit:"ml", unitLabel:"100ml", cat:"Pflanzenmilch", inflammatory:false, endo_ok:true },
  { id:166, name:"Macadamiamilch ungesüßt", cal:21, p:0.4, c:0.8, f:1.8, fi:0.1, unit:"ml", unitLabel:"100ml", cat:"Pflanzenmilch", inflammatory:false, endo_ok:true },
  { id:167, name:"Lupinenmilch", cal:39, p:3.3, c:1.5, f:2.2, fi:0.8, unit:"ml", unitLabel:"100ml", cat:"Pflanzenmilch", inflammatory:false, endo_ok:true },
  { id:168, name:"Haselnussmilch ungesüßt", cal:24, p:0.4, c:1.5, f:1.8, fi:0.4, unit:"ml", unitLabel:"100ml", cat:"Pflanzenmilch", inflammatory:false, endo_ok:true },

  // JOGHURT & QUARK (alle Varianten)
  { id:169, name:"Naturjoghurt 3,6% (BILLA)", cal:68, p:3.5, c:4.9, f:3.6, fi:0, unit:"g", unitLabel:"100g", cat:"Joghurt & Quark", inflammatory:false, endo_ok:true },
  { id:170, name:"Naturjoghurt 1,8%", cal:55, p:3.6, c:5.0, f:1.8, fi:0, unit:"g", unitLabel:"100g", cat:"Joghurt & Quark", inflammatory:false, endo_ok:true },
  { id:171, name:"Naturjoghurt 0,1%", cal:44, p:4.5, c:5.2, f:0.1, fi:0, unit:"g", unitLabel:"100g", cat:"Joghurt & Quark", inflammatory:false, endo_ok:true },
  { id:172, name:"Griechischer Joghurt 0% (CHOBANI)", cal:58, p:10.4, c:3.6, f:0.2, fi:0, unit:"g", unitLabel:"100g", cat:"Joghurt & Quark", inflammatory:false, endo_ok:true },
  { id:173, name:"Griechischer Joghurt 5% (FAGE)", cal:97, p:9.0, c:3.8, f:5.0, fi:0, unit:"g", unitLabel:"100g", cat:"Joghurt & Quark", inflammatory:false, endo_ok:true },
  { id:174, name:"Skyr Vanilla (LIDL)", cal:74, p:9.8, c:7.5, f:0.2, fi:0, unit:"g", unitLabel:"100g", cat:"Joghurt & Quark", inflammatory:false, endo_ok:true },
  { id:175, name:"Skyr Erdbeere (HOFER)", cal:77, p:9.5, c:7.8, f:0.2, fi:0.1, unit:"g", unitLabel:"100g", cat:"Joghurt & Quark", inflammatory:false, endo_ok:true },
  { id:176, name:"Magerquark (BILLA)", cal:61, p:12.1, c:3.2, f:0.3, fi:0, unit:"g", unitLabel:"100g", cat:"Joghurt & Quark", inflammatory:false, endo_ok:true },
  { id:177, name:"Speisequark 20% F.i.Tr.", cal:102, p:10.5, c:4.1, f:4.8, fi:0, unit:"g", unitLabel:"100g", cat:"Joghurt & Quark", inflammatory:false, endo_ok:true },
  { id:178, name:"Speisequark 40% F.i.Tr.", cal:154, p:9.8, c:3.8, f:11.0, fi:0, unit:"g", unitLabel:"100g", cat:"Joghurt & Quark", inflammatory:false, endo_ok:true },
  { id:179, name:"Soja-Joghurt natur (ALPRO)", cal:62, p:3.9, c:5.0, f:2.6, fi:0.3, unit:"g", unitLabel:"100g", cat:"Joghurt & Quark", inflammatory:false, endo_ok:true },
  { id:180, name:"Kokosjoghurt natur", cal:85, p:0.7, c:6.5, f:6.0, fi:0.2, unit:"g", unitLabel:"100g", cat:"Joghurt & Quark", inflammatory:false, endo_ok:true },
  { id:181, name:"Hafermilch-Joghurt natur", cal:55, p:1.5, c:7.5, f:1.8, fi:0.6, unit:"g", unitLabel:"100g", cat:"Joghurt & Quark", inflammatory:false, endo_ok:true },
  { id:182, name:"Mandel-Joghurt natur", cal:53, p:1.0, c:4.5, f:3.0, fi:0.5, unit:"g", unitLabel:"100g", cat:"Joghurt & Quark", inflammatory:false, endo_ok:true },
  { id:183, name:"Ricotta", cal:137, p:9.1, c:3.0, f:10.0, fi:0, unit:"g", unitLabel:"100g", cat:"Joghurt & Quark", inflammatory:false, endo_ok:true },

  // KÄSE (alle relevanten Sorten)
  { id:184, name:"Camembert (45% F.i.Tr.)", cal:297, p:17.9, c:0, f:25.5, fi:0, unit:"g", unitLabel:"100g", cat:"Käse", inflammatory:false, endo_ok:true },
  { id:185, name:"Brie", cal:334, p:18.0, c:0.5, f:29.0, fi:0, unit:"g", unitLabel:"100g", cat:"Käse", inflammatory:false, endo_ok:true },
  { id:186, name:"Cheddar", cal:403, p:25.0, c:0.1, f:33.1, fi:0, unit:"g", unitLabel:"100g", cat:"Käse", inflammatory:false, endo_ok:true },
  { id:187, name:"Emmentaler", cal:393, p:28.6, c:0, f:30.0, fi:0, unit:"g", unitLabel:"100g", cat:"Käse", inflammatory:false, endo_ok:true },
  { id:188, name:"Gouda (48% F.i.Tr.)", cal:356, p:25.0, c:0, f:27.8, fi:0, unit:"g", unitLabel:"100g", cat:"Käse", inflammatory:false, endo_ok:true },
  { id:189, name:"Mozzarella (normale)", cal:254, p:18.3, c:2.7, f:19.5, fi:0, unit:"g", unitLabel:"100g", cat:"Käse", inflammatory:false, endo_ok:true },
  { id:190, name:"Feta (BILLA)", cal:261, p:15.6, c:0.7, f:21.3, fi:0, unit:"g", unitLabel:"100g", cat:"Käse", inflammatory:false, endo_ok:true },
  { id:191, name:"Frischkäse (Philadelphia)", cal:248, p:5.3, c:4.0, f:23.5, fi:0, unit:"g", unitLabel:"100g", cat:"Käse", inflammatory:false, endo_ok:true },
  { id:192, name:"Frischkäse light", cal:124, p:7.0, c:4.5, f:9.0, fi:0, unit:"g", unitLabel:"100g", cat:"Käse", inflammatory:false, endo_ok:true },
  { id:193, name:"Veganer Käse (Scheiben)", cal:285, p:4.0, c:8.5, f:26.0, fi:0.5, unit:"g", unitLabel:"100g", cat:"Käse", inflammatory:false, endo_ok:true },

  // AUFSCHNITT & WURST
  { id:194, name:"Hähnchenbrustaufschnitt", cal:99, p:21.0, c:0.5, f:1.5, fi:0, unit:"g", unitLabel:"100g", cat:"Aufschnitt & Wurst", inflammatory:false, endo_ok:true },
  { id:195, name:"Putenbrustaufschnitt", cal:97, p:22.5, c:0.5, f:0.7, fi:0, unit:"g", unitLabel:"100g", cat:"Aufschnitt & Wurst", inflammatory:false, endo_ok:true },
  { id:196, name:"Schinken (gekocht, mager)", cal:110, p:20.0, c:1.0, f:2.8, fi:0, unit:"g", unitLabel:"100g", cat:"Aufschnitt & Wurst", inflammatory:false, endo_ok:true },
  { id:197, name:"Salami", cal:425, p:20.5, c:1.5, f:37.8, fi:0, unit:"g", unitLabel:"100g", cat:"Aufschnitt & Wurst", inflammatory:true, endo_ok:false, warn:"Verarbeitetes Fleisch kann Entzündungen fördern." },
  { id:198, name:"Leberkäse (HOFER)", cal:287, p:14.0, c:5.2, f:24.0, fi:0, unit:"g", unitLabel:"100g", cat:"Aufschnitt & Wurst", inflammatory:true, endo_ok:false },
  { id:199, name:"Veganer Aufschnitt (HOFER)", cal:135, p:10.5, c:5.0, f:8.0, fi:2.5, unit:"g", unitLabel:"100g", cat:"Aufschnitt & Wurst", inflammatory:false, endo_ok:true },
  { id:200, name:"Tofu natur", cal:76, p:8.2, c:0.8, f:4.2, fi:0.3, unit:"g", unitLabel:"100g", cat:"Aufschnitt & Wurst", inflammatory:false, endo_ok:true },
  { id:201, name:"Räuchertofu", cal:163, p:16.0, c:3.6, f:9.4, fi:0.5, unit:"g", unitLabel:"100g", cat:"Aufschnitt & Wurst", inflammatory:false, endo_ok:true },
  { id:202, name:"Tempeh", cal:193, p:19.0, c:9.4, f:10.8, fi:4.1, unit:"g", unitLabel:"100g", cat:"Aufschnitt & Wurst", inflammatory:false, endo_ok:true },

  // TIEFKÜHLPRODUKTE
  { id:203, name:"TK Spinat (BILLA)", cal:20, p:2.8, c:0.8, f:0.5, fi:3.0, unit:"g", unitLabel:"100g", cat:"Tiefkühlprodukte", inflammatory:false, endo_ok:true },
  { id:204, name:"TK Erbsen (HOFER)", cal:81, p:5.4, c:14.5, f:0.4, fi:5.5, unit:"g", unitLabel:"100g", cat:"Tiefkühlprodukte", inflammatory:false, endo_ok:true, warn:"Erbsen: leicht blähend in der Lutealphase." },
  { id:205, name:"TK Brokkoli (LIDL)", cal:25, p:2.8, c:2.5, f:0.4, fi:3.3, unit:"g", unitLabel:"100g", cat:"Tiefkühlprodukte", inflammatory:false, endo_ok:true },
  { id:206, name:"TK Blaubeeren (HOFER)", cal:54, p:0.7, c:13.5, f:0.3, fi:2.4, unit:"g", unitLabel:"100g", cat:"Tiefkühlprodukte", inflammatory:false, endo_ok:true },
  { id:207, name:"TK Himbeeren (BILLA)", cal:52, p:1.2, c:11.9, f:0.7, fi:6.7, unit:"g", unitLabel:"100g", cat:"Tiefkühlprodukte", inflammatory:false, endo_ok:true },
  { id:208, name:"TK Mango (LIDL)", cal:60, p:0.8, c:15.0, f:0.4, fi:1.8, unit:"g", unitLabel:"100g", cat:"Tiefkühlprodukte", inflammatory:false, endo_ok:true },
  { id:209, name:"TK Gemüsemix (BILLA)", cal:42, p:2.8, c:6.5, f:0.5, fi:3.5, unit:"g", unitLabel:"100g", cat:"Tiefkühlprodukte", inflammatory:false, endo_ok:true },
  { id:210, name:"TK Edamame (HOFER)", cal:122, p:11.0, c:10.0, f:5.0, fi:5.0, unit:"g", unitLabel:"100g", cat:"Tiefkühlprodukte", inflammatory:false, endo_ok:true, warn:"Edamame: mild blähend in der Lutealphase." },
  { id:211, name:"TK Lachs (LIDL / HOFER)", cal:142, p:19.9, c:0, f:6.3, fi:0, unit:"g", unitLabel:"100g", cat:"Tiefkühlprodukte", inflammatory:false, endo_ok:true },
  { id:212, name:"TK Garnelen (BILLA)", cal:71, p:15.2, c:0, f:0.9, fi:0, unit:"g", unitLabel:"100g", cat:"Tiefkühlprodukte", inflammatory:false, endo_ok:true },
  { id:213, name:"TK Hähnchenbrust (HOFER)", cal:105, p:23.1, c:0, f:1.2, fi:0, unit:"g", unitLabel:"100g", cat:"Tiefkühlprodukte", inflammatory:false, endo_ok:true },

  // KONSERVEN & GLÄSER
  { id:214, name:"Tomaten (Dose, ganz)", cal:18, p:0.9, c:3.5, f:0.2, fi:1.2, unit:"g", unitLabel:"100g", cat:"Konserven & Gläser", inflammatory:false, endo_ok:true },
  { id:215, name:"Tomaten (Dose, stückig)", cal:18, p:0.9, c:3.5, f:0.2, fi:1.2, unit:"g", unitLabel:"100g", cat:"Konserven & Gläser", inflammatory:false, endo_ok:true },
  { id:216, name:"Kichererbsen (Dose, BILLA)", cal:119, p:8.0, c:16.0, f:2.6, fi:5.4, unit:"g", unitLabel:"100g", cat:"Konserven & Gläser", inflammatory:false, endo_ok:true, warn:"Hülsenfrüchte: blähend in der Lutealphase." },
  { id:217, name:"Kidneybohnen (Dose)", cal:127, p:8.7, c:22.0, f:0.5, fi:8.5, unit:"g", unitLabel:"100g", cat:"Konserven & Gläser", inflammatory:false, endo_ok:true, warn:"Hülsenfrüchte: blähend in der Lutealphase." },
  { id:218, name:"Linsen (Dose)", cal:95, p:7.5, c:12.5, f:0.5, fi:5.5, unit:"g", unitLabel:"100g", cat:"Konserven & Gläser", inflammatory:false, endo_ok:true, warn:"Linsen: blähend in der Lutealphase." },
  { id:219, name:"Mais (Dose, HOFER)", cal:86, p:3.2, c:18.6, f:1.2, fi:2.4, unit:"g", unitLabel:"100g", cat:"Konserven & Gläser", inflammatory:false, endo_ok:true },
  { id:220, name:"Thunfisch Dose in Wasser (BILLA)", cal:116, p:25.5, c:0, f:1.0, fi:0, unit:"g", unitLabel:"100g", cat:"Konserven & Gläser", inflammatory:false, endo_ok:true },
  { id:221, name:"Sardinen in Olivenöl (LIDL)", cal:208, p:23.0, c:0, f:13.0, fi:0, unit:"g", unitLabel:"100g", cat:"Konserven & Gläser", inflammatory:false, endo_ok:true },
  { id:222, name:"Tomatensugo Barilla", cal:48, p:1.9, c:8.5, f:0.9, fi:1.4, unit:"g", unitLabel:"100g", cat:"Konserven & Gläser", inflammatory:false, endo_ok:true },
  { id:223, name:"Pesto Rosso", cal:235, p:3.5, c:15.0, f:18.0, fi:2.0, unit:"g", unitLabel:"100g", cat:"Konserven & Gläser", inflammatory:false, endo_ok:true },
  { id:224, name:"Pesto Verde (Basilikum)", cal:285, p:5.0, c:5.0, f:27.5, fi:1.5, unit:"g", unitLabel:"100g", cat:"Konserven & Gläser", inflammatory:false, endo_ok:true },
  { id:225, name:"Kokosmilch (Dose, Vollmilch)", cal:230, p:2.3, c:5.5, f:23.8, fi:0.2, unit:"ml", unitLabel:"100ml", cat:"Konserven & Gläser", inflammatory:false, endo_ok:true },
  { id:226, name:"Kokosmilch (Dose, light)", cal:79, p:1.0, c:4.5, f:6.0, fi:0.1, unit:"ml", unitLabel:"100ml", cat:"Konserven & Gläser", inflammatory:false, endo_ok:true },

  // TEES & HEISSGETRÄNKE
  { id:227, name:"Grüner Tee (gebrüht)", cal:1, p:0, c:0.1, f:0, fi:0, unit:"ml", unitLabel:"100ml", cat:"Tees & Heißgetränke", inflammatory:false, endo_ok:true },
  { id:228, name:"Ingwer-Tee (gebrüht)", cal:2, p:0, c:0.4, f:0, fi:0, unit:"ml", unitLabel:"100ml", cat:"Tees & Heißgetränke", inflammatory:false, endo_ok:true },
  { id:229, name:"Kamillentee (gebrüht)", cal:1, p:0, c:0.1, f:0, fi:0, unit:"ml", unitLabel:"100ml", cat:"Tees & Heißgetränke", inflammatory:false, endo_ok:true },
  { id:230, name:"Pfefferminztee (gebrüht)", cal:1, p:0.1, c:0.1, f:0, fi:0, unit:"ml", unitLabel:"100ml", cat:"Tees & Heißgetränke", inflammatory:false, endo_ok:true },
  { id:231, name:"Schwarztee (gebrüht)", cal:1, p:0, c:0.1, f:0, fi:0, unit:"ml", unitLabel:"100ml", cat:"Tees & Heißgetränke", inflammatory:false, endo_ok:true },
  { id:232, name:"Chai Latte (fertig, gezuckert)", cal:60, p:1.5, c:10.5, f:1.4, fi:0.1, unit:"ml", unitLabel:"100ml", cat:"Tees & Heißgetränke", inflammatory:false, endo_ok:true },
  { id:233, name:"Matcha Latte (mit Haferdrink)", cal:48, p:1.2, c:6.5, f:1.6, fi:0.8, unit:"ml", unitLabel:"100ml", cat:"Tees & Heißgetränke", inflammatory:false, endo_ok:true },
  { id:234, name:"Kakao ungesüßt (Pulver)", cal:228, p:19.6, c:11.5, f:11.1, fi:33.2, unit:"g", unitLabel:"100g", cat:"Tees & Heißgetränke", inflammatory:false, endo_ok:true },
  { id:235, name:"Ovomaltine Pulver", cal:386, p:11.0, c:69.0, f:7.8, fi:5.5, unit:"g", unitLabel:"100g", cat:"Tees & Heißgetränke", inflammatory:false, endo_ok:true },
  { id:236, name:"Latte Macchiato (Vollmilch)", cal:60, p:3.2, c:6.0, f:2.5, fi:0, unit:"ml", unitLabel:"100ml", cat:"Tees & Heißgetränke", inflammatory:false, endo_ok:true },
  { id:237, name:"Cappuccino (Vollmilch)", cal:55, p:3.0, c:5.5, f:2.2, fi:0, unit:"ml", unitLabel:"100ml", cat:"Tees & Heißgetränke", inflammatory:false, endo_ok:true },

  // AUFSTRICHE & DIPS
  { id:238, name:"Hummus natur", cal:166, p:7.9, c:14.3, f:9.6, fi:6.0, unit:"g", unitLabel:"100g", cat:"Aufstriche & Dips", inflammatory:false, endo_ok:true },
  { id:239, name:"Erdnussbutter crunchy", cal:588, p:25.0, c:13.0, f:50.0, fi:5.9, unit:"g", unitLabel:"100g", cat:"Aufstriche & Dips", inflammatory:false, endo_ok:true },
  { id:240, name:"Mandelmus weiß", cal:614, p:22.1, c:6.1, f:55.5, fi:12.8, unit:"g", unitLabel:"100g", cat:"Aufstriche & Dips", inflammatory:false, endo_ok:true },
  { id:241, name:"Cashewmus", cal:574, p:17.5, c:26.7, f:46.4, fi:3.3, unit:"g", unitLabel:"100g", cat:"Aufstriche & Dips", inflammatory:false, endo_ok:true },
  { id:242, name:"Avocado-Aufstrich / Guacamole", cal:160, p:1.9, c:2.5, f:14.8, fi:6.5, unit:"g", unitLabel:"100g", cat:"Aufstriche & Dips", inflammatory:false, endo_ok:true },
  { id:243, name:"Frischkäse Kräuter", cal:195, p:6.0, c:3.5, f:17.5, fi:0.2, unit:"g", unitLabel:"100g", cat:"Aufstriche & Dips", inflammatory:false, endo_ok:true },
  { id:244, name:"Ketchup (Heinz)", cal:112, p:1.5, c:26.0, f:0.2, fi:0.5, unit:"g", unitLabel:"100g", cat:"Aufstriche & Dips", inflammatory:true, endo_ok:false, warn:"Ketchup enthält viel Zucker – bei Endometriose sparsam verwenden." },
  { id:245, name:"Senf mittelscharf", cal:81, p:5.3, c:6.0, f:3.6, fi:3.8, unit:"g", unitLabel:"100g", cat:"Aufstriche & Dips", inflammatory:false, endo_ok:true },
  { id:246, name:"Mayonnaise (vollfett)", cal:680, p:1.2, c:2.5, f:74.0, fi:0, unit:"g", unitLabel:"100g", cat:"Aufstriche & Dips", inflammatory:true, endo_ok:false, warn:"Viel gesättigte Fette – in Maßen konsumieren." },
  { id:247, name:"Salatdressing Caesar", cal:310, p:2.2, c:5.5, f:31.0, fi:0, unit:"ml", unitLabel:"100ml", cat:"Aufstriche & Dips", inflammatory:true, endo_ok:false },
  { id:248, name:"Balsamico Essig", cal:88, p:0.5, c:17.0, f:0, fi:0, unit:"ml", unitLabel:"100ml", cat:"Aufstriche & Dips", inflammatory:false, endo_ok:true },
  { id:249, name:"Apfelessig", cal:22, p:0, c:0.9, f:0, fi:0, unit:"ml", unitLabel:"100ml", cat:"Aufstriche & Dips", inflammatory:false, endo_ok:true },

  // PROTEIN-SNACKS & BARS (Supermarkt)
  { id:250, name:"BILLA Protein Joghurt Vanille", cal:78, p:12.0, c:5.0, f:0.5, fi:0, unit:"g", unitLabel:"100g", cat:"Protein-Snacks", inflammatory:false, endo_ok:true },
  { id:251, name:"BILLA Protein Joghurt Erdbeere", cal:79, p:11.8, c:5.5, f:0.5, fi:0.1, unit:"g", unitLabel:"100g", cat:"Protein-Snacks", inflammatory:false, endo_ok:true },
  { id:252, name:"LIDL Protein Pudding Schokolade", cal:88, p:13.0, c:6.0, f:1.0, fi:0.5, unit:"g", unitLabel:"100g", cat:"Protein-Snacks", inflammatory:false, endo_ok:true },
  { id:253, name:"HOFER Protein Riegel Cookies", cal:195, p:20.5, c:18.0, f:5.0, fi:1.8, unit:"g", unitLabel:"55g Bar", cat:"Protein-Snacks", inflammatory:false, endo_ok:true },
  { id:254, name:"Fulfil Protein Bar Chocolate", cal:198, p:21.0, c:21.0, f:4.5, fi:7.0, unit:"g", unitLabel:"55g Bar", cat:"Protein-Snacks", inflammatory:false, endo_ok:true },
  { id:255, name:"Quest Bar Schokolade Brownie", cal:180, p:21.0, c:26.0, f:7.0, fi:14.0, unit:"g", unitLabel:"60g Bar", cat:"Protein-Snacks", inflammatory:false, endo_ok:true },
  { id:256, name:"Skyr Drink (HOFER)", cal:65, p:9.5, c:5.5, f:0.2, fi:0, unit:"ml", unitLabel:"100ml", cat:"Protein-Snacks", inflammatory:false, endo_ok:true },
  { id:257, name:"Joghurt-Drink Müllermilch Vanille", cal:68, p:3.3, c:10.8, f:1.5, fi:0, unit:"ml", unitLabel:"100ml", cat:"Protein-Snacks", inflammatory:false, endo_ok:true },

  // BACKEN & KOCHEN
  { id:258, name:"Backpulver", cal:53, p:0, c:12.5, f:0, fi:0, unit:"g", unitLabel:"100g", cat:"Backen & Kochen", inflammatory:false, endo_ok:true },
  { id:259, name:"Natron", cal:0, p:0, c:0, f:0, fi:0, unit:"g", unitLabel:"100g", cat:"Backen & Kochen", inflammatory:false, endo_ok:true },
  { id:260, name:"Vanilleextrakt (flüssig)", cal:288, p:0.1, c:12.7, f:0.1, fi:0, unit:"ml", unitLabel:"100ml", cat:"Backen & Kochen", inflammatory:false, endo_ok:true },
  { id:261, name:"Xanthan Gum", cal:333, p:0, c:83.0, f:0, fi:83.0, unit:"g", unitLabel:"100g", cat:"Backen & Kochen", inflammatory:false, endo_ok:true },
  { id:262, name:"Gelatine (Blätter)", cal:335, p:83.8, c:0, f:0.3, fi:0, unit:"g", unitLabel:"100g", cat:"Backen & Kochen", inflammatory:false, endo_ok:true },
  { id:263, name:"Agar Agar Pulver", cal:306, p:6.2, c:73.0, f:0.3, fi:73.0, unit:"g", unitLabel:"100g", cat:"Backen & Kochen", inflammatory:false, endo_ok:true },
  { id:264, name:"Stärke (Speisestärke)", cal:345, p:0.3, c:84.7, f:0.1, fi:0.9, unit:"g", unitLabel:"100g", cat:"Backen & Kochen", inflammatory:false, endo_ok:true },
  { id:265, name:"Paniermehl", cal:365, p:11.5, c:72.5, f:2.5, fi:3.5, unit:"g", unitLabel:"100g", cat:"Backen & Kochen", inflammatory:false, endo_ok:true },

  // ALKOHOL
  { id:266, name:"Rotwein (trocken)", cal:85, p:0.1, c:2.6, f:0, fi:0, unit:"ml", unitLabel:"100ml", cat:"Alkohol", inflammatory:true, endo_ok:false, warn:"Alkohol fördert Entzündungen – bei Endometriose vermeiden, besonders in der Luteal- und Menstruationsphase." },
  { id:267, name:"Weißwein (trocken)", cal:82, p:0.1, c:2.6, f:0, fi:0, unit:"ml", unitLabel:"100ml", cat:"Alkohol", inflammatory:true, endo_ok:false, warn:"Alkohol: entzündungsfördernd – bei Endometriose meiden." },
  { id:268, name:"Sekt / Prosecco", cal:80, p:0.3, c:2.3, f:0, fi:0, unit:"ml", unitLabel:"100ml", cat:"Alkohol", inflammatory:true, endo_ok:false, warn:"Alkohol: entzündungsfördernd + Kohlensäure = Blähungen." },
  { id:269, name:"Bier (0,5l)", cal:215, p:1.8, c:17.0, f:0, fi:0, unit:"ml", unitLabel:"500ml", cat:"Alkohol", inflammatory:true, endo_ok:false, warn:"Bier: Alkohol + Gluten + Kohlensäure – bei Endometriose meiden." },
  { id:270, name:"Bier alkoholfrei (0,5l)", cal:100, p:0.8, c:20.0, f:0, fi:0, unit:"ml", unitLabel:"500ml", cat:"Alkohol", inflammatory:false, endo_ok:true },
  { id:271, name:"Vodka (40ml Shot)", cal:88, p:0, c:0, f:0, fi:0, unit:"ml", unitLabel:"40ml Shot", cat:"Alkohol", inflammatory:true, endo_ok:false, warn:"Hochprozentiger Alkohol: stark entzündungsfördernd." },
  { id:272, name:"Gin (40ml Shot)", cal:88, p:0, c:0, f:0, fi:0, unit:"ml", unitLabel:"40ml Shot", cat:"Alkohol", inflammatory:true, endo_ok:false },

  // FERTIGGERICHTE & FAST FOOD (Supermarkt)
  { id:273, name:"HOFER Tiefkühlpizza Margherita", cal:237, p:9.5, c:35.0, f:7.0, fi:2.2, unit:"g", unitLabel:"100g", cat:"Fertiggerichte", inflammatory:true, endo_ok:false, warn:"Fertigpizza: Weißmehl, gesättigte Fette – gelegentlich ok." },
  { id:274, name:"BILLA Bio Linsensoup (Glas)", cal:55, p:3.5, c:7.5, f:0.8, fi:2.5, unit:"g", unitLabel:"100g", cat:"Fertiggerichte", inflammatory:false, endo_ok:true, warn:"Linsensuppe: blähend in der Lutealphase." },
  { id:275, name:"LIDL Chicken Nuggets (TK)", cal:243, p:13.5, c:20.0, f:11.5, fi:0.8, unit:"g", unitLabel:"100g", cat:"Fertiggerichte", inflammatory:true, endo_ok:false },
  { id:276, name:"Instantnudeln (Ramen)", cal:436, p:10.2, c:63.0, f:16.0, fi:1.7, unit:"g", unitLabel:"100g", cat:"Fertiggerichte", inflammatory:true, endo_ok:false, warn:"Viel Salz und gesättigte Fette – gelegentlich." },
  { id:277, name:"Overnight Oats vorbereitet", cal:145, p:7.5, c:21.5, f:3.8, fi:3.5, unit:"g", unitLabel:"100g", cat:"Fertiggerichte", inflammatory:false, endo_ok:true },

  // WEITERE BASIC-LEBENSMITTEL
  { id:278, name:"Olivenöl (HOFER/BILLA)", cal:884, p:0, c:0, f:100, fi:0, unit:"ml", unitLabel:"100ml", cat:"Fette & Öle", inflammatory:false, endo_ok:true },
  { id:279, name:"Kokosöl nativ", cal:862, p:0, c:0, f:99.1, fi:0, unit:"g", unitLabel:"100g", cat:"Fette & Öle", inflammatory:false, endo_ok:true },
  { id:280, name:"Leinöl kaltgepresst", cal:884, p:0, c:0, f:100, fi:0, unit:"ml", unitLabel:"100ml", cat:"Fette & Öle", inflammatory:false, endo_ok:true },
  { id:281, name:"Mandelöl", cal:884, p:0, c:0, f:100, fi:0, unit:"ml", unitLabel:"100ml", cat:"Fette & Öle", inflammatory:false, endo_ok:true },
  { id:282, name:"Wasser (still)", cal:0, p:0, c:0, f:0, fi:0, unit:"ml", unitLabel:"100ml", cat:"Drinks & Energy", inflammatory:false, endo_ok:true },
  { id:283, name:"Wasser (mit Kohlensäure)", cal:0, p:0, c:0, f:0, fi:0, unit:"ml", unitLabel:"100ml", cat:"Drinks & Energy", inflammatory:false, endo_ok:true, warn:"Kohlensäure kann Blähungen verursachen – in der Lutealphase reduzieren." },
  { id:284, name:"Kokoswasser (natur)", cal:19, p:0.7, c:3.7, f:0.2, fi:1.1, unit:"ml", unitLabel:"100ml", cat:"Drinks & Energy", inflammatory:false, endo_ok:true },
  { id:285, name:"Kombucha (natur)", cal:13, p:0, c:3.0, f:0, fi:0, unit:"ml", unitLabel:"100ml", cat:"Drinks & Energy", inflammatory:false, endo_ok:true },
  { id:286, name:"Protein Wasser (Weider)", cal:33, p:7.5, c:0.5, f:0, fi:0, unit:"ml", unitLabel:"100ml", cat:"Drinks & Energy", inflammatory:false, endo_ok:true },
  { id:287, name:"Apfelsaft naturtrüb", cal:46, p:0.1, c:11.0, f:0.1, fi:0.1, unit:"ml", unitLabel:"100ml", cat:"Drinks & Energy", inflammatory:false, endo_ok:true },
  { id:288, name:"Smoothie Grün (selbstgemacht)", cal:65, p:2.0, c:11.5, f:1.5, fi:2.5, unit:"ml", unitLabel:"100ml", cat:"Drinks & Energy", inflammatory:false, endo_ok:true },

  // SONSTIGES GEMÜSE & OBST (fehlende)
  { id:289, name:"Aubergine", cal:25, p:1.0, c:3.5, f:0.2, fi:3.4, unit:"g", unitLabel:"100g", cat:"Gemüse", inflammatory:false, endo_ok:true },
  { id:290, name:"Fenchel", cal:31, p:1.2, c:4.2, f:0.2, fi:3.1, unit:"g", unitLabel:"100g", cat:"Gemüse", inflammatory:false, endo_ok:true },
  { id:291, name:"Lauch (Porree)", cal:25, p:1.5, c:3.3, f:0.3, fi:2.2, unit:"g", unitLabel:"100g", cat:"Gemüse", inflammatory:false, endo_ok:true, warn:"Lauch: blähend – in der Lutealphase einschränken." },
  { id:292, name:"Rote Bete", cal:43, p:1.6, c:9.6, f:0.1, fi:2.8, unit:"g", unitLabel:"100g", cat:"Gemüse", inflammatory:false, endo_ok:true },
  { id:293, name:"Rosenkohl", cal:43, p:3.4, c:5.5, f:0.5, fi:3.8, unit:"g", unitLabel:"100g", cat:"Gemüse", inflammatory:false, endo_ok:true, warn:"Rosenkohl: stark blähend – in der Lutealphase meiden." },
  { id:294, name:"Artischocke", cal:53, p:2.9, c:10.5, f:0.2, fi:8.6, unit:"g", unitLabel:"100g", cat:"Gemüse", inflammatory:false, endo_ok:true },
  { id:295, name:"Spargel (weiß)", cal:18, p:2.2, c:1.2, f:0.1, fi:1.8, unit:"g", unitLabel:"100g", cat:"Gemüse", inflammatory:false, endo_ok:true },
  { id:296, name:"Spargel (grün)", cal:21, p:2.4, c:1.8, f:0.2, fi:2.1, unit:"g", unitLabel:"100g", cat:"Gemüse", inflammatory:false, endo_ok:true },
  { id:297, name:"Maiskölbchen (Dose)", cal:23, p:2.1, c:2.9, f:0.2, fi:3.5, unit:"g", unitLabel:"100g", cat:"Gemüse", inflammatory:false, endo_ok:true },
  { id:298, name:"Kresse", cal:32, p:2.6, c:4.4, f:0.7, fi:1.1, unit:"g", unitLabel:"100g", cat:"Gemüse", inflammatory:false, endo_ok:true },
  { id:299, name:"Wasabi-Erbsen", cal:420, p:14.5, c:59.0, f:14.0, fi:10.5, unit:"g", unitLabel:"100g", cat:"Süßes & Snacks", inflammatory:false, endo_ok:true },
  { id:300, name:"Granatapfelkerne", cal:83, p:1.7, c:18.7, f:1.2, fi:4.0, unit:"g", unitLabel:"100g", cat:"Obst", inflammatory:false, endo_ok:true },
  { id:301, name:"Datteln (getrocknet)", cal:277, p:1.8, c:74.0, f:0.2, fi:6.7, unit:"g", unitLabel:"100g", cat:"Obst", inflammatory:false, endo_ok:true },
  { id:302, name:"Aprikosen (getrocknet)", cal:241, p:3.4, c:62.6, f:0.5, fi:7.3, unit:"g", unitLabel:"100g", cat:"Obst", inflammatory:false, endo_ok:true },
  { id:303, name:"Feigen (getrocknet)", cal:249, p:3.5, c:63.0, f:0.9, fi:9.8, unit:"g", unitLabel:"100g", cat:"Obst", inflammatory:false, endo_ok:true },
  { id:304, name:"Goji Beeren (getrocknet)", cal:321, p:14.3, c:77.1, f:0.4, fi:13.0, unit:"g", unitLabel:"100g", cat:"Obst", inflammatory:false, endo_ok:true },
  { id:305, name:"Acai Pulver", cal:534, p:8.1, c:52.2, f:32.5, fi:44.2, unit:"g", unitLabel:"100g", cat:"Obst", inflammatory:false, endo_ok:true },
  // MORE NUTRITION – Chunky Flavors (Peanut Butter)
  { id:316, name:"More Nutrition Chunky Peanut Vanilla", cal:375, p:33.0, c:20.0, f:16.5, fi:4.5, unit:"g", unitLabel:"100g", cat:"More Nutrition", inflammatory:false, endo_ok:true },
  { id:317, name:"More Nutrition Chunky Peanut Chocolate", cal:388, p:32.0, c:22.5, f:17.0, fi:5.2, unit:"g", unitLabel:"100g", cat:"More Nutrition", inflammatory:false, endo_ok:true },
  { id:318, name:"More Nutrition Chunky Peanut Caramel", cal:380, p:32.5, c:21.0, f:16.8, fi:4.8, unit:"g", unitLabel:"100g", cat:"More Nutrition", inflammatory:false, endo_ok:true },
  { id:319, name:"More Nutrition Chunky Peanut Strawberry", cal:372, p:32.0, c:20.5, f:16.2, fi:4.6, unit:"g", unitLabel:"100g", cat:"More Nutrition", inflammatory:false, endo_ok:true },
  { id:320, name:"More Nutrition Chunky Peanut Cookies & Cream", cal:385, p:31.8, c:23.0, f:16.5, fi:4.9, unit:"g", unitLabel:"100g", cat:"More Nutrition", inflammatory:false, endo_ok:true },
  { id:321, name:"More Nutrition Chunky Peanut Blueberry Muffin", cal:378, p:32.2, c:21.5, f:16.3, fi:4.7, unit:"g", unitLabel:"100g", cat:"More Nutrition", inflammatory:false, endo_ok:true },
  { id:322, name:"More Nutrition Chunky Peanut Cinnamon Roll", cal:381, p:32.0, c:22.0, f:16.5, fi:4.5, unit:"g", unitLabel:"100g", cat:"More Nutrition", inflammatory:false, endo_ok:true },
  // MORE NUTRITION – Saucen / Toppings
  { id:323, name:"More Nutrition Protein Sauce Chocolate", cal:46, p:5.8, c:3.5, f:0.8, fi:0.3, unit:"ml", unitLabel:"15ml Portion", cat:"More Nutrition", inflammatory:false, endo_ok:true },
  { id:324, name:"More Nutrition Protein Sauce Vanilla", cal:44, p:5.5, c:3.2, f:0.7, fi:0.2, unit:"ml", unitLabel:"15ml Portion", cat:"More Nutrition", inflammatory:false, endo_ok:true },
  { id:325, name:"More Nutrition Protein Sauce Caramel", cal:45, p:5.6, c:3.4, f:0.7, fi:0.2, unit:"ml", unitLabel:"15ml Portion", cat:"More Nutrition", inflammatory:false, endo_ok:true },
  { id:326, name:"More Nutrition Protein Sauce Strawberry", cal:43, p:5.4, c:3.3, f:0.6, fi:0.2, unit:"ml", unitLabel:"15ml Portion", cat:"More Nutrition", inflammatory:false, endo_ok:true },
  { id:327, name:"More Nutrition Zero Sauce BBQ", cal:18, p:0.5, c:3.5, f:0.1, fi:0.3, unit:"ml", unitLabel:"15ml Portion", cat:"More Nutrition", inflammatory:false, endo_ok:true },
  { id:328, name:"More Nutrition Zero Sauce Sweet Chili", cal:16, p:0.3, c:3.8, f:0.1, fi:0.2, unit:"ml", unitLabel:"15ml Portion", cat:"More Nutrition", inflammatory:false, endo_ok:true },
  { id:329, name:"More Nutrition Zero Sauce Ketchup", cal:14, p:0.4, c:3.0, f:0.1, fi:0.2, unit:"ml", unitLabel:"15ml Portion", cat:"More Nutrition", inflammatory:false, endo_ok:true },
  { id:330, name:"More Nutrition Zero Sauce Curry", cal:15, p:0.4, c:3.2, f:0.1, fi:0.3, unit:"ml", unitLabel:"15ml Portion", cat:"More Nutrition", inflammatory:false, endo_ok:true },
  { id:331, name:"More Nutrition Zero Sauce Mayo Style", cal:20, p:0.3, c:1.5, f:1.2, fi:0, unit:"ml", unitLabel:"15ml Portion", cat:"More Nutrition", inflammatory:false, endo_ok:true },
  // MORE NUTRITION – Protein Shakes RTD
  { id:332, name:"More Nutrition Protein Shake Vanilla (330ml)", cal:132, p:29.5, c:4.2, f:1.8, fi:0.5, unit:"ml", unitLabel:"330ml Flasche", cat:"More Nutrition", inflammatory:false, endo_ok:true },
  { id:333, name:"More Nutrition Protein Shake Chocolate (330ml)", cal:140, p:29.0, c:5.5, f:2.0, fi:1.0, unit:"ml", unitLabel:"330ml Flasche", cat:"More Nutrition", inflammatory:false, endo_ok:true },
  { id:334, name:"More Nutrition Protein Shake Strawberry (330ml)", cal:130, p:29.0, c:4.0, f:1.7, fi:0.5, unit:"ml", unitLabel:"330ml Flasche", cat:"More Nutrition", inflammatory:false, endo_ok:true },
  { id:335, name:"More Nutrition Protein Shake Caramel (330ml)", cal:134, p:29.2, c:4.5, f:1.8, fi:0.4, unit:"ml", unitLabel:"330ml Flasche", cat:"More Nutrition", inflammatory:false, endo_ok:true },
  // MORE NUTRITION – weitere Produkte
  { id:336, name:"More Nutrition Oats & Protein Vanilla", cal:357, p:28.0, c:49.5, f:5.5, fi:6.5, unit:"g", unitLabel:"100g", cat:"More Nutrition", inflammatory:false, endo_ok:true },
  { id:337, name:"More Nutrition Oats & Protein Chocolate", cal:362, p:27.5, c:51.0, f:5.8, fi:6.8, unit:"g", unitLabel:"100g", cat:"More Nutrition", inflammatory:false, endo_ok:true },
  { id:338, name:"More Nutrition Vegan Protein Vanilla", cal:370, p:75.0, c:7.5, f:4.5, fi:2.5, unit:"g", unitLabel:"100g", cat:"More Nutrition", inflammatory:false, endo_ok:true },
  { id:339, name:"More Nutrition Vegan Protein Chocolate", cal:375, p:74.0, c:9.0, f:5.0, fi:3.0, unit:"g", unitLabel:"100g", cat:"More Nutrition", inflammatory:false, endo_ok:true },
  { id:340, name:"More Nutrition Collagen Protein", cal:356, p:86.5, c:1.2, f:0.3, fi:0, unit:"g", unitLabel:"100g", cat:"More Nutrition", inflammatory:false, endo_ok:true },
  { id:341, name:"More Nutrition L-Glutamin", cal:0, p:0, c:0, f:0, fi:0, unit:"g", unitLabel:"5g Portion", cat:"More Nutrition", inflammatory:false, endo_ok:true },
  { id:342, name:"More Nutrition Beta-Alanin", cal:0, p:0, c:0, f:0, fi:0, unit:"g", unitLabel:"3g Portion", cat:"More Nutrition", inflammatory:false, endo_ok:true },
  { id:343, name:"More Nutrition BCAA Powder Lemon", cal:18, p:4.0, c:0.2, f:0, fi:0, unit:"g", unitLabel:"10g Portion", cat:"More Nutrition", inflammatory:false, endo_ok:true },
  { id:344, name:"More Nutrition Pre-Workout", cal:10, p:0.5, c:1.5, f:0, fi:0, unit:"g", unitLabel:"10g Portion", cat:"More Nutrition", inflammatory:false, endo_ok:true },
  { id:345, name:"More Nutrition Protein Pancake Mix", cal:355, p:36.0, c:38.5, f:5.5, fi:3.0, unit:"g", unitLabel:"100g", cat:"More Nutrition", inflammatory:false, endo_ok:true },
  { id:346, name:"More Nutrition Protein Brownie", cal:330, p:30.0, c:32.0, f:8.5, fi:5.5, unit:"g", unitLabel:"75g Stück", cat:"More Nutrition", inflammatory:false, endo_ok:true },
  // EIER mit Stückangabe
  { id:347, name:"Ei Größe S (45g)", cal:62, p:5.2, c:0.3, f:4.3, fi:0, unit:"Stück", unitLabel:"1 Stück (45g)", cat:"Milchprodukte", inflammatory:false, endo_ok:true },
  { id:348, name:"Ei Größe M (55g)", cal:77, p:6.4, c:0.3, f:5.3, fi:0, unit:"Stück", unitLabel:"1 Stück (55g)", cat:"Milchprodukte", inflammatory:false, endo_ok:true },
  { id:349, name:"Ei Größe L (63g)", cal:88, p:7.3, c:0.4, f:6.1, fi:0, unit:"Stück", unitLabel:"1 Stück (63g)", cat:"Milchprodukte", inflammatory:false, endo_ok:true },
  { id:350, name:"Ei Größe XL (73g)", cal:102, p:8.5, c:0.4, f:7.1, fi:0, unit:"Stück", unitLabel:"1 Stück (73g)", cat:"Milchprodukte", inflammatory:false, endo_ok:true },
  { id:351, name:"Eiweiß (1 Stück M)", cal:17, p:3.6, c:0.2, f:0.1, fi:0, unit:"Stück", unitLabel:"1 Eiweiß (30g)", cat:"Milchprodukte", inflammatory:false, endo_ok:true },
  { id:352, name:"Eigelb (1 Stück M)", cal:60, p:2.7, c:0.1, f:5.3, fi:0, unit:"Stück", unitLabel:"1 Eigelb (17g)", cat:"Milchprodukte", inflammatory:false, endo_ok:true },
];

const PHASE_INFO = {
  menstruation:{ name:"Menstruation", emoji:"🌸", days:"Tag 1–5", color:"#e8758a", bg:"#fdeef1", mood:"Erschöpft, sensitiv", energy:"Niedrig", tip:"Fokus auf eisenreiche Lebensmittel (Spinat, Linsen), Magnesium & wärmende Speisen. Blähungsauslöser meiden.", sport:"Sanftes Yoga, Spaziergang", nutrients:["Eisen","Magnesium","Vitamin C"], fertile:false },
  follicular:{ name:"Follikelphase", emoji:"🌿", days:"Tag 6–13", color:"#6db87a", bg:"#edf7ef", mood:"Energiegeladen, kreativ!", energy:"Hoch", tip:"Leichte, proteinreiche Kost. Leinsamen & Phytoöstrogene sind ideal.", sport:"HIIT, Krafttraining", nutrients:["Protein","Zink","Phytoöstrogene"], fertile:false },
  ovulation:{ name:"Ovulation", emoji:"☀️", days:"Tag 14–16", color:"#e8a83a", bg:"#fdf6e3", mood:"Selbstbewusst, offen", energy:"Peak!", tip:"Anti-entzündliche Foods: Lachs, Avocado, Blaubeeren, Kurkuma.", sport:"Intensive Workouts, Laufen", nutrients:["Omega-3","Antioxidantien","Vitamin E"], fertile:true },
  luteal:{ name:"Lutealphase", emoji:"🌙", days:"Tag 17–28", color:"#8b6db8", bg:"#f3eef9", mood:"Sensitiv, Heißhunger möglich", energy:"Abnehmend", tip:"Magnesium (Kürbiskerne, dunkle Schokolade) reduziert Krämpfe. Zucker & Weißmehl meiden. Blähungsauslöser einschränken.", sport:"Yoga, Pilates, Spaziergang", nutrients:["Magnesium","Vitamin B6","Calcium"], fertile:false },
};

function getFertilityInfo(lastPeriod, cycleLen, days) {
  // If period is being actively tracked, use the most recent period start from days log
  if (days) {
    const periodDays = Object.entries(days)
      .filter(([, d]) => d?.period?.isPeriod)
      .map(([date]) => date)
      .sort();
    if (periodDays.length > 0) {
      // Find the start of the current/most recent period streak
      const sortedDesc = [...periodDays].sort().reverse();
      let streak = sortedDesc[0];
      for (let i = 1; i < sortedDesc.length; i++) {
        const prev = new Date(sortedDesc[i-1]);
        const curr = new Date(sortedDesc[i]);
        const gap = Math.floor((prev - curr) / 86400000);
        if (gap <= 2) { streak = sortedDesc[i]; } else break;
      }
      lastPeriod = streak;
    }
  }
  if (!lastPeriod) return { status:"unknown", daysUntil:null, window:[], isFertile:false, isPeakFertile:false, dayOfCycle:0, ovulationDay:14, fertileStart:9, fertileEnd:15, daysUntilFertile:9, daysUntilOvulation:14, cycleLen:28 };
  const cl = cycleLen || 28;
  const lp = new Date(lastPeriod);
  const today = new Date();
  const dayOfCycle = Math.max(0, Math.floor((today - lp) / 86400000)) % cl;
  // Fertile window: typically 5 days before ovulation + ovulation day (day 14 in 28-day cycle)
  const ovulationDay = Math.round(cl * 0.5);
  const fertileStart = ovulationDay - 5;
  const fertileEnd = ovulationDay + 1;
  const isFertile = dayOfCycle >= fertileStart && dayOfCycle <= fertileEnd;
  const isPeakFertile = dayOfCycle === ovulationDay || dayOfCycle === ovulationDay - 1;
  let daysUntilFertile = null;
  if (!isFertile) {
    daysUntilFertile = dayOfCycle < fertileStart ? fertileStart - dayOfCycle : (cl - dayOfCycle) + fertileStart;
  }
  const daysUntilOvulation = dayOfCycle < ovulationDay ? ovulationDay - dayOfCycle : (cl - dayOfCycle) + ovulationDay;
  return { isFertile, isPeakFertile, dayOfCycle, ovulationDay, fertileStart, fertileEnd, daysUntilFertile, daysUntilOvulation, cycleLen:cl };
}

const PERIOD_COLORS = ["Hellrot","Dunkelrot","Rotbraun","Braun","Rosa","Orange"];
const PERIOD_FLOW = ["Sehr leicht","Leicht","Mittel","Stark","Sehr stark"];
const PERIOD_CONSISTENCY = ["Flüssig","Normal","Klumpig","Dicke Klumpen"];
const DISCHARGE_TYPES = ["Kein","Weißlich","Cremig","Wässrig","Klar/Glasig","Gelblich","Bräunlich"];
const SKIN_STATES = ["Super","Gut","Okay","Unrein","Ausbruch"];
const HAIR_STATES = ["Glänzend","Normal","Fettig","Trocken","Haarausfall"];
const MOOD_OPTIONS = ["😊 Gut","😐 Neutral","😢 Traurig","😡 Reizbar","😰 Ängstlich","🥰 Liebevoll","😴 Erschöpft","💪 Motiviert"];

const CATS = [...new Set(FOOD_DB.map(f => f.cat))];
// Note: "Eigene Lebensmittel" gets added dynamically from customFoods in AddMealModal

function getCyclePhase(lastPeriod, cycleLen, days) {
  // Check if today or recent days have active period tracking
  const today = getToday();
  if (days) {
    const todayD = days[today];
    if (todayD?.period?.isPeriod) return "menstruation";
    // Check last 2 days for period
    for (let i = 1; i <= 2; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      if (days[key]?.period?.isPeriod) return "menstruation";
    }
  }
  if (!lastPeriod) return "follicular";
  const diff = Math.floor((Date.now() - new Date(lastPeriod)) / 86400000) % (cycleLen || 28);
  if (diff < 5) return "menstruation";
  if (diff < 13) return "follicular";
  if (diff < 17) return "ovulation";
  return "luteal";
}
function calcTDEE(w,h,age,act,goal){
  const bmr=10*Number(w)+6.25*Number(h)-5*(Number(age)||25)-161;
  const m={sedentary:1.2,light:1.375,moderate:1.55,active:1.725,extreme:1.9};
  return Math.round(bmr*(m[act]||1.375))+(goal==="lose"?-400:goal==="gain"?300:0);
}
function getToday(){ return new Date().toISOString().split("T")[0]; }
const r2=(v)=>+Math.round(v*100)/100;

function CircRing({value,max,size=165,sw=13,color="#f2a8cc",bg="#fce4f0",children}){
  const r=(size-sw)/2,circ=2*Math.PI*r,off=circ*(1-Math.min(value/max,1));
  return(
    <div style={{position:"relative",width:size,height:size,flexShrink:0}}>
      <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={bg} strokeWidth={sw}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={sw}
          strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round"
          style={{transition:"stroke-dashoffset 0.6s ease"}}/>
      </svg>
      <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>{children}</div>
    </div>
  );
}
function Bar({value,max,color}){
  return <div style={{background:"#fce4f0",borderRadius:999,height:5,overflow:"hidden",flex:1}}>
    <div style={{width:`${Math.min((value/max)*100,100)}%`,height:"100%",background:color,borderRadius:999,transition:"width 0.5s ease"}}/>
  </div>;
}
function Label({children}){
  return <label style={{fontSize:11,color:"#b07a9e",fontWeight:700,textTransform:"uppercase",letterSpacing:0.5}}>{children}</label>;
}
function Input({value,onChange,type="text",placeholder=""}){
  return <input type={type} value={value} onChange={onChange} placeholder={placeholder}
    style={{display:"block",width:"100%",marginTop:4,padding:"10px 14px",border:"1.5px solid #fce4f0",borderRadius:12,fontSize:14,color:"#5c3d52",outline:"none",background:"#fdf7f4",boxSizing:"border-box"}}/>;
}
function Card({children,style={}}){
  return <div style={{background:"white",borderRadius:18,padding:16,marginBottom:12,boxShadow:"0 2px 12px rgba(242,168,204,0.1)",...style}}>{children}</div>;
}
function PinkBtn({children,onClick,disabled=false,small=false}){
  return <button onClick={onClick} disabled={disabled}
    style={{padding:small?"7px 16px":"13px",background:disabled?"#fce4f0":"linear-gradient(135deg,#f2a8cc,#e8758a)",border:"none",borderRadius:small?99:14,fontSize:small?13:15,fontWeight:700,color:disabled?"#c4a0b8":"white",cursor:disabled?"default":"pointer",width:small?"auto":"100%"}}>{children}</button>;
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
// ─── AUTH SCREEN ─────────────────────────────────────────────────────────────
function AuthScreen({onLogin}){
  const [mode,setMode]=useState("login");
  const [step,setStep]=useState(1); // register: 1=credentials, 2=gender
  const [username,setUsername]=useState("");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [confirm,setConfirm]=useState("");
  const [gender,setGender]=useState(""); // "female" | "male"
  const [agreeTerms,setAgreeTerms]=useState(false);
  const [agreeData,setAgreeData]=useState(false);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(false);
  const [showLegal,setShowLegal]=useState(null); // "privacy"|"terms"|"imprint"

  async function hashPw(pw){
    const buf=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(pw));
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
  }

  function validateEmail(e){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

  async function handleRegisterStep1(){
    setError("");
    const u=username.trim().toLowerCase();
    if(!u||u.length<3){setError("Benutzername mind. 3 Zeichen.");return;}
    if(!/^[a-z0-9_]+$/.test(u)){setError("Nur Buchstaben, Zahlen und _ erlaubt.");return;}
    if(!validateEmail(email)){setError("Bitte gültige E-Mail-Adresse eingeben.");return;}
    if(password.length<8){setError("Passwort mind. 8 Zeichen.");return;}
    if(password!==confirm){setError("Passwörter stimmen nicht überein.");return;}
    if(!agreeTerms||!agreeData){setError("Bitte stimme den AGB und der Datenschutzerklärung zu.");return;}
    setLoading(true);
    try{
      const users=(await storageLoad(UK_USERS()))||{};
      if(users[u]){setError("Dieser Benutzername ist bereits vergeben.");setLoading(false);return;}
      // Check email uniqueness
      const emailTaken=Object.values(users).some(v=>v.email===email.toLowerCase().trim());
      if(emailTaken){setError("Diese E-Mail-Adresse ist bereits registriert.");setLoading(false);return;}
      setStep(2);
    }catch(e){setError("Fehler. Bitte erneut versuchen.");}
    setLoading(false);
  }

  async function handleRegisterStep2(){
    setError("");
    if(!gender){setError("Bitte wähle eine Option.");return;}
    setLoading(true);
    try{
      const u=username.trim().toLowerCase();
      const hash=await hashPw(password);
      const users=(await storageLoad(UK_USERS()))||{};
      users[u]={hash,email:email.toLowerCase().trim(),gender,createdAt:Date.now(),dataConsent:agreeData};
      await storageSave(UK_USERS(),users);
      // Set up trial subscription
      const trialEnd=new Date();trialEnd.setDate(trialEnd.getDate()+3);
      await storageSave(UK_SUB(u),{plan:"trial",status:"trial",startDate:Date.now(),trialEnd:trialEnd.toISOString()});
      onLogin(u,gender);
    }catch(e){setError("Fehler beim Registrieren.");}
    setLoading(false);
  }

  async function handleLogin(){
    setError("");
    const u=username.trim().toLowerCase();
    if(!u||!password){setError("Bitte alle Felder ausfüllen.");return;}
    setLoading(true);
    try{
      const users=(await storageLoad(UK_USERS()))||{};
      if(!users[u]){setError("Benutzername nicht gefunden.");setLoading(false);return;}
      const hash=await hashPw(password);
      const userData=users[u];
      const storedHash=typeof userData==="string"?userData:userData.hash;
      if(storedHash!==hash){setError("Falsches Passwort.");setLoading(false);return;}
      const g=typeof userData==="object"?userData.gender:"female";
      onLogin(u,g||"female");
    }catch(e){setError("Fehler beim Login.");}
    setLoading(false);
  }

  if(showLegal) return <LegalScreen type={showLegal} onClose={()=>setShowLegal(null)}/>;

  return(
    <div style={{minHeight:"100vh",background:"linear-gradient(160deg,#1a0a12 0%,#2d1022 50%,#1a0a12 100%)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"'DM Sans',sans-serif"}}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
      {/* Background decoration */}
      <div style={{position:"fixed",inset:0,overflow:"hidden",pointerEvents:"none"}}>
        <div style={{position:"absolute",top:-100,right:-100,width:400,height:400,borderRadius:"50%",background:"radial-gradient(circle,rgba(242,168,204,0.15) 0%,transparent 70%)"}}/>
        <div style={{position:"absolute",bottom:-150,left:-100,width:500,height:500,borderRadius:"50%",background:"radial-gradient(circle,rgba(139,109,184,0.12) 0%,transparent 70%)"}}/>
      </div>

      <div style={{width:"100%",maxWidth:420,position:"relative",zIndex:1}}>
        {/* Logo */}
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{fontSize:52,marginBottom:10,filter:"drop-shadow(0 0 20px rgba(242,168,204,0.5))"}}>🌸</div>
          <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:34,color:"white",margin:"0 0 6px",letterSpacing:-0.5}}>GlowTrack</h1>
          <p style={{color:"rgba(255,255,255,0.5)",margin:0,fontSize:14,fontWeight:300}}>Wellness · Zyklus · Ernährung</p>
        </div>

        <div style={{background:"rgba(255,255,255,0.06)",backdropFilter:"blur(20px)",borderRadius:24,padding:28,border:"1px solid rgba(255,255,255,0.1)"}}>
          {/* Tab toggle */}
          <div style={{display:"flex",background:"rgba(255,255,255,0.06)",borderRadius:12,padding:3,marginBottom:24}}>
            {[["login","Anmelden"],["register","Registrieren"]].map(([m,l])=>(
              <button key={m} onClick={()=>{setMode(m);setError("");setStep(1);}}
                style={{flex:1,padding:"9px",border:"none",borderRadius:10,background:mode===m?"rgba(242,168,204,0.2)":"transparent",fontWeight:700,fontSize:14,color:mode===m?"#f2a8cc":"rgba(255,255,255,0.4)",cursor:"pointer",transition:"all 0.2s"}}>
                {l}
              </button>
            ))}
          </div>

          {/* LOGIN */}
          {mode==="login"&&(
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              {[["Benutzername","text",username,setUsername,"z.B. sophie"],["Passwort","password",password,setPassword,"••••••••"]].map(([l,t,v,sv,ph])=>(
                <div key={l}>
                  <label style={{fontSize:11,color:"rgba(255,255,255,0.5)",fontWeight:700,textTransform:"uppercase",letterSpacing:0.8}}>{l}</label>
                  <input type={t} value={v} onChange={e=>sv(e.target.value)} placeholder={ph}
                    onKeyDown={e=>e.key==="Enter"&&handleLogin()}
                    style={{display:"block",width:"100%",marginTop:5,padding:"12px 16px",border:"1px solid rgba(255,255,255,0.12)",borderRadius:12,fontSize:15,color:"white",outline:"none",background:"rgba(255,255,255,0.07)",boxSizing:"border-box",fontFamily:"inherit"}}/>
                </div>
              ))}
              {error&&<div style={{background:"rgba(232,117,138,0.15)",border:"1px solid rgba(232,117,138,0.3)",borderRadius:10,padding:"9px 12px",fontSize:13,color:"#f2a8cc"}}>{error}</div>}
              <button onClick={handleLogin} disabled={loading}
                style={{padding:"14px",background:loading?"rgba(242,168,204,0.2)":"linear-gradient(135deg,#f2a8cc,#e8758a)",border:"none",borderRadius:14,fontSize:15,fontWeight:700,color:"white",cursor:loading?"default":"pointer",marginTop:4,letterSpacing:0.2}}>
                {loading?"Lade…":"Anmelden →"}
              </button>
            </div>
          )}

          {/* REGISTER STEP 1 */}
          {mode==="register"&&step===1&&(
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div style={{background:"rgba(242,168,204,0.1)",borderRadius:12,padding:"10px 14px",marginBottom:2}}>
                <p style={{margin:0,fontSize:12,color:"rgba(255,255,255,0.6)",lineHeight:1.5}}>✨ <strong style={{color:"#f2a8cc"}}>3 Tage kostenlos</strong> testen – danach 4,99€/Monat oder 39,99€/Jahr. Jederzeit kündbar.</p>
              </div>
              {[["Benutzername","text",username,setUsername,"Nur Buchstaben, Zahlen, _"],["E-Mail-Adresse","email",email,setEmail,"deine@email.at"],["Passwort","password",password,setPassword,"Mind. 8 Zeichen"],["Passwort bestätigen","password",confirm,setConfirm,"Passwort wiederholen"]].map(([l,t,v,sv,ph])=>(
                <div key={l}>
                  <label style={{fontSize:11,color:"rgba(255,255,255,0.5)",fontWeight:700,textTransform:"uppercase",letterSpacing:0.8}}>{l}</label>
                  <input type={t} value={v} onChange={e=>sv(e.target.value)} placeholder={ph}
                    style={{display:"block",width:"100%",marginTop:5,padding:"12px 16px",border:"1px solid rgba(255,255,255,0.12)",borderRadius:12,fontSize:15,color:"white",outline:"none",background:"rgba(255,255,255,0.07)",boxSizing:"border-box",fontFamily:"inherit"}}/>
                </div>
              ))}
              {/* Legal consent */}
              <div style={{display:"flex",flexDirection:"column",gap:10,padding:"12px 0"}}>
                <label style={{display:"flex",alignItems:"flex-start",gap:10,cursor:"pointer"}}>
                  <input type="checkbox" checked={agreeTerms} onChange={e=>setAgreeTerms(e.target.checked)} style={{marginTop:2,accentColor:"#f2a8cc",width:16,height:16,flexShrink:0}}/>
                  <span style={{fontSize:12,color:"rgba(255,255,255,0.55)",lineHeight:1.5}}>
                    Ich akzeptiere die <button onClick={()=>setShowLegal("terms")} style={{background:"none",border:"none",color:"#f2a8cc",cursor:"pointer",fontSize:12,padding:0,textDecoration:"underline"}}>AGB</button> und habe die <button onClick={()=>setShowLegal("privacy")} style={{background:"none",border:"none",color:"#f2a8cc",cursor:"pointer",fontSize:12,padding:0,textDecoration:"underline"}}>Datenschutzerklärung</button> gelesen. *
                  </span>
                </label>
                <label style={{display:"flex",alignItems:"flex-start",gap:10,cursor:"pointer"}}>
                  <input type="checkbox" checked={agreeData} onChange={e=>setAgreeData(e.target.checked)} style={{marginTop:2,accentColor:"#f2a8cc",width:16,height:16,flexShrink:0}}/>
                  <span style={{fontSize:12,color:"rgba(255,255,255,0.55)",lineHeight:1.5}}>
                    Ich willige ein, dass meine <strong style={{color:"rgba(255,255,255,0.7)"}}>anonymisierten Gesundheitsdaten</strong> für Forschungszwecke genutzt werden dürfen. Diese Einwilligung ist freiwillig und kann jederzeit widerrufen werden. (Optional)
                  </span>
                </label>
              </div>
              {error&&<div style={{background:"rgba(232,117,138,0.15)",border:"1px solid rgba(232,117,138,0.3)",borderRadius:10,padding:"9px 12px",fontSize:13,color:"#f2a8cc"}}>{error}</div>}
              <button onClick={handleRegisterStep1} disabled={loading}
                style={{padding:"14px",background:loading?"rgba(242,168,204,0.2)":"linear-gradient(135deg,#f2a8cc,#e8758a)",border:"none",borderRadius:14,fontSize:15,fontWeight:700,color:"white",cursor:loading?"default":"pointer",letterSpacing:0.2}}>
                {loading?"Prüfe…":"Weiter →"}
              </button>
              <p style={{textAlign:"center",fontSize:11,color:"rgba(255,255,255,0.3)",margin:"4px 0 0"}}>* Pflichtfeld · DSGVO-konform · Daten in der EU</p>
            </div>
          )}

          {/* REGISTER STEP 2 – GENDER */}
          {mode==="register"&&step===2&&(
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              <div style={{textAlign:"center",marginBottom:4}}>
                <p style={{color:"rgba(255,255,255,0.8)",fontSize:15,fontWeight:600,margin:"0 0 6px"}}>Wie verwendest du GlowTrack?</p>
                <p style={{color:"rgba(255,255,255,0.4)",fontSize:12,margin:0}}>Dies bestimmt welche Features dir angezeigt werden.</p>
              </div>
              {[
                {v:"female",icon:"🌸",title:"Als Frau",desc:"Zyklus-Tracking, Periodentracker, Fruchtbarkeit, Hormon-Ernährungstipps"},
                {v:"male",icon:"💪",title:"Als Mann",desc:"Ernährungs-Tracking, Fortschritt, Partner-Ansicht für Zyklusdaten"},
              ].map(({v,icon,title,desc})=>(
                <button key={v} onClick={()=>setGender(v)}
                  style={{padding:"18px 20px",borderRadius:18,border:`2px solid ${gender===v?"#f2a8cc":"rgba(255,255,255,0.1)"}`,background:gender===v?"rgba(242,168,204,0.15)":"rgba(255,255,255,0.04)",cursor:"pointer",textAlign:"left",transition:"all 0.2s"}}>
                  <div style={{display:"flex",alignItems:"center",gap:14}}>
                    <span style={{fontSize:32}}>{icon}</span>
                    <div>
                      <div style={{fontSize:16,fontWeight:700,color:gender===v?"#f2a8cc":"white",marginBottom:4}}>{title}</div>
                      <div style={{fontSize:12,color:"rgba(255,255,255,0.45)",lineHeight:1.4}}>{desc}</div>
                    </div>
                    <div style={{marginLeft:"auto",width:22,height:22,borderRadius:99,border:`2px solid ${gender===v?"#f2a8cc":"rgba(255,255,255,0.2)"}`,background:gender===v?"#f2a8cc":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      {gender===v&&<div style={{width:8,height:8,borderRadius:99,background:"white"}}/>}
                    </div>
                  </div>
                </button>
              ))}
              {error&&<div style={{background:"rgba(232,117,138,0.15)",border:"1px solid rgba(232,117,138,0.3)",borderRadius:10,padding:"9px 12px",fontSize:13,color:"#f2a8cc"}}>{error}</div>}
              <button onClick={handleRegisterStep2} disabled={loading||!gender}
                style={{padding:"14px",background:(!gender||loading)?"rgba(242,168,204,0.15)":"linear-gradient(135deg,#f2a8cc,#e8758a)",border:"none",borderRadius:14,fontSize:15,fontWeight:700,color:(!gender||loading)?"rgba(255,255,255,0.3)":"white",cursor:(!gender||loading)?"default":"pointer",letterSpacing:0.2}}>
                {loading?"Erstelle Account…":"3 Tage gratis starten 🌸"}
              </button>
              <button onClick={()=>setStep(1)} style={{background:"none",border:"none",color:"rgba(255,255,255,0.3)",cursor:"pointer",fontSize:13}}>← Zurück</button>
            </div>
          )}
        </div>

        {/* Legal links */}
        <div style={{display:"flex",justifyContent:"center",gap:16,marginTop:20}}>
          {[["Impressum","imprint"],["Datenschutz","privacy"],["AGB","terms"]].map(([l,t])=>(
            <button key={t} onClick={()=>setShowLegal(t)}
              style={{background:"none",border:"none",color:"rgba(255,255,255,0.25)",fontSize:12,cursor:"pointer",textDecoration:"underline"}}>
              {l}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}


// ─── MAIN APP WRAPPER ─────────────────────────────────────────────────────────
export default function GlowTrack(){
  const [currentUser,setCurrentUser]=useState(null);
  const [authChecked,setAuthChecked]=useState(false);

  // Check for saved session on mount
  useEffect(()=>{
    storageLoad("glowtrack:v1:__session__").then(sess=>{
      if(sess){
        // Handle both old string format and new object format
        if(typeof sess==="string") setCurrentUser({username:sess,gender:"female"});
        else setCurrentUser(sess);
      }
      setAuthChecked(true);
    });
  },[]);

  async function handleLogin(username,gender){
    await storageSave("glowtrack:v1:__session__",{username,gender:gender||"female"});
    setCurrentUser({username,gender:gender||"female"});
  }
  async function handleLogout(){
    await storageDelete("glowtrack:v1:__session__");
    setCurrentUser(null);
  }

  async function handleCancelSub(){
    if(!currentUser) return;
    const u=currentUser.username||currentUser;
    const sub=await storageLoad(UK_SUB(u))||{};
    await storageSave(UK_SUB(u),{...sub,status:"cancelled",cancelledAt:Date.now()});
  }

  if(!authChecked) return(
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#fdf7f4,#fce4f0)",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{fontSize:48}}>🌸</div>
    </div>
  );
  if(!currentUser) return <AuthScreen onLogin={handleLogin}/>;
  const uname=typeof currentUser==="string"?currentUser:currentUser.username;
  const ugender=typeof currentUser==="string"?"female":currentUser.gender||"female";
  return <GlowTrackApp username={uname} gender={ugender} onLogout={handleLogout} onCancelSub={handleCancelSub}/>;
}

// ─── GLOWTRACK APP (authenticated) ───────────────────────────────────────────
function GlowTrackApp({username,gender,onLogout,onCancelSub}){
  const [tab,setTab]=useState("home");
  const [profile,setProfile]=useState({name:"",height:165,weight:65,goalWeight:58,age:28,activity:"moderate",goal:"lose",cycleLen:28,lastPeriod:"2025-05-18",hasEndometriosis:false});
  const [showOnboarding,setShowOnboarding]=useState(true);
  const [dataLoaded,setDataLoaded]=useState(false);
  const [days,setDays]=useState({});
  const [water,setWater]=useState({});
  const [addOpen,setAddOpen]=useState(false);
  const [mealCat,setMealCat]=useState("Frühstück");
  const [recipes,setRecipes]=useState([]);
  const [customFoods,setCustomFoods]=useState([]); // persisted custom food DB
  const [recipeOpen,setRecipeOpen]=useState(false);
  const [camOpen,setCamOpen]=useState(false);
  const [customOpen,setCustomOpen]=useState(false);
  const [toasts,setToasts]=useState([]);
  const [weightIn,setWeightIn]=useState({morning:"",evening:""});
  const [periodOpen,setPeriodOpen]=useState(false);
  const [editRecipe,setEditRecipe]=useState(null);
  const [manualDeficit,setManualDeficit]=useState(null);
  const [apiKey,setApiKey]=useState("");
  const [aiUsage,setAiUsage]=useState({date:"",count:0});
  const DAILY_AI_LIMIT=5;
  const [subscription,setSubscription]=useState(null);
  const [showPaywall,setShowPaywall]=useState(false); // free users get 5 AI analyses per day

  // ── LOAD all user data on mount ────────────────────────────────────────────
  useEffect(()=>{
    if(!username) return;
    async function loadAll(){
      const [prof,d,w,rec,cf,def,ak,aiu,sub]=await Promise.all([
        storageLoad(UK_PROFILE(username)),
        storageLoad(UK_DAYS(username)),
        storageLoad(UK_WATER(username)),
        storageLoad(UK_RECIPES(username)),
        storageLoad(UK_CUSTOM(username)),
        storageLoad(UK_DEFICIT(username)),
        storageLoad(UK_API_KEY()),
        storageLoad(UK_AI_USAGE(username)),
        storageLoad(UK_SUB(username)),
      ]);
      if(prof){setProfile(p=>({...p,gender:gender,...prof}));setShowOnboarding(false);}
      else setProfile(p=>({...p,gender}));
      if(d) setDays(d);
      if(w) setWater(w);
      if(rec) setRecipes(rec);
      if(cf) setCustomFoods(cf);
      if(def!==null) setManualDeficit(def);
      if(ak) setApiKey(ak);
      if(aiu) setAiUsage(aiu);
      if(sub) setSubscription(sub);
      setDataLoaded(true);
      // Check if trial expired
      if(sub&&sub.status==="trial"&&sub.trialEnd&&new Date(sub.trialEnd)<new Date()){
        setSubscription(s=>({...s,status:"expired"}));
        setShowPaywall(true);
      }
    }
    loadAll();
  },[username]);

  // ── AUTO-SAVE whenever data changes ───────────────────────────────────────
  useEffect(()=>{if(dataLoaded) storageSave(UK_DAYS(username),days);},[days,dataLoaded]);
  useEffect(()=>{if(dataLoaded) storageSave(UK_WATER(username),water);},[water,dataLoaded]);
  useEffect(()=>{if(dataLoaded) storageSave(UK_RECIPES(username),recipes);},[recipes,dataLoaded]);
  useEffect(()=>{if(dataLoaded) storageSave(UK_CUSTOM(username),customFoods);},[customFoods,dataLoaded]);
  useEffect(()=>{if(dataLoaded) storageSave(UK_DEFICIT(username),manualDeficit);},[manualDeficit,dataLoaded]);

  function saveProfile(p){
    setProfile(p);
    if(dataLoaded||showOnboarding===false) storageSave(UK_PROFILE(username),p);
  }

  async function saveApiKey(key){
    setApiKey(key);
    await storageSave(UK_API_KEY(),key);
  }

  function canUseAI(){
    if(apiKey) return {ok:true,remaining:999}; // own key = unlimited
    const today=getToday();
    const count=aiUsage.date===today?aiUsage.count:0;
    return {ok:count<DAILY_AI_LIMIT, remaining:DAILY_AI_LIMIT-count, count, today};
  }

  async function trackAIUsage(){
    const today=getToday();
    const count=(aiUsage.date===today?aiUsage.count:0)+1;
    const newUsage={date:today,count};
    setAiUsage(newUsage);
    await storageSave(UK_AI_USAGE(username),newUsage);
  }

  function finishOnboarding(){
    setShowOnboarding(false);
    storageSave(UK_PROFILE(username),profile);
    setDataLoaded(true);
  }

  const today=getToday();
  const phase=getCyclePhase(profile.lastPeriod,profile.cycleLen,days);
  const pi=PHASE_INFO[phase];
  const baseTDEE=calcTDEE(profile.weight,profile.height,profile.age,profile.activity,profile.goal);
  const tdee=manualDeficit!==null ? baseTDEE+manualDeficit : baseTDEE;
  const tP=Math.round(tdee*0.3/4),tC=Math.round(tdee*0.4/4),tF=Math.round(tdee*0.3/9),tFi=30;
  const todayD=days[today]||{meals:[],morningWeight:"",eveningWeight:"",symptoms:{},period:null};
  const meals=todayD.meals||[];
  const tot=meals.reduce((a,m)=>({cal:a.cal+m.cal,p:a.p+m.p,c:a.c+m.c,f:a.f+m.f,fi:a.fi+(m.fi||0)}),{cal:0,p:0,c:0,f:0,fi:0});
  const rem=Math.max(tdee-tot.cal,0);
  const waterToday=water[today]||0;

  function updateDay(date,patch){setDays(p=>({...p,[date]:{...(p[date]||{meals:[],morningWeight:"",eveningWeight:"",symptoms:{},period:null}),...patch}}))}
  function toast(msg,color="#e8758a"){const id=Date.now();setToasts(t=>[...t,{id,msg,color}]);setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),5000);}

  function scoreMeal(food, amount){
    const f=amount/100;
    const p=food.p*f, fi=(food.fi||0)*f, cal=food.cal*f;
    let score=0;
    if(p>=15) score+=2;
    if(fi>=3) score+=2;
    if(cal<=400) score+=1;
    if(!food.inflammatory) score+=1;
    if(food.endo_ok&&profile.hasEndometriosis) score+=1;
    const top=["🌟 Perfekte Wahl! Reich an Protein & Ballaststoffen – dein Körper dankt es dir!","✨ Wow, das ist ein echter Glow-Food! Ausgewogen, nährstoffreich und entzündungshemmend.","💪 Top-Mahlzeit! Genau das, was dein Körper jetzt braucht. So geht Glow!","🥗 Nutritional Glow-up! Hoch in Protein & Ballaststoffen – perfekt für deinen Hormonhaushalt."];
    const good=["💚 Gute Wahl! Schön ausgewogen und nährstoffreich.","🌿 Nice! Diese Mahlzeit unterstützt deine Energie und Erholung.","✅ Solide Wahl – gut für Makros und sättigend!"];
    const ok=["👍 Ordentliche Mahlzeit – ergänze heute noch etwas Protein oder Ballaststoffe!","💡 Gut gemacht! Noch etwas Gemüse oder Protein für die perfekte Balance."];
    if(score>=5) return top[Math.floor(Math.random()*top.length)];
    if(score>=3) return good[Math.floor(Math.random()*good.length)];
    if(score>=2) return ok[Math.floor(Math.random()*ok.length)];
    return null;
  }

  function doAddMeal(food,amount){
    const isPiece = food.unit==="Stück";
    const f = isPiece ? amount : amount/100;
    const entry={id:Date.now(),name:food.name,qty:amount,unit:food.unit,cat:mealCat,
      cal:Math.round(food.cal*f),p:Math.round(food.p*f*100)/100,c:Math.round(food.c*f*100)/100,
      f:Math.round(food.f*f*100)/100,fi:Math.round((food.fi||0)*f*100)/100,
      inflammatory:food.inflammatory,endo_ok:food.endo_ok};
    updateDay(today,{meals:[...meals,entry]});
    if(food.warn&&(phase==="luteal"||phase==="menstruation")) toast("⚠️ "+food.warn);
    if(food.inflammatory&&(phase==="luteal"||phase==="menstruation")) toast(`⚡ ${food.name} ist entzündungsfördernd – in der ${pi.name} ungünstig.`);
    if(profile.hasEndometriosis&&!food.endo_ok) toast(`🔴 Bei Endometriose kann ${food.name} Entzündungen verstärken.`,"#c0392b");
    if(!food.inflammatory){
      const motiv=scoreMeal(food,amount);
      if(motiv) setTimeout(()=>toast(motiv,"#6db87a"),700);
    }
    setAddOpen(false);
  }

  if(!dataLoaded) return(
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#fdf7f4,#fce4f0)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif"}}>
      <div style={{fontSize:52,marginBottom:16}}>🌸</div>
      <p style={{color:"#b07a9e",fontSize:15,fontWeight:600}}>Lade deine Daten…</p>
    </div>
  );
  if(showOnboarding) return <Onboarding profile={profile} setProfile={p=>{setProfile(p);}} done={finishOnboarding}/>;

  return(
    <div style={{minHeight:"100vh",background:"#fdf7f4",fontFamily:"'DM Sans',sans-serif",maxWidth:480,margin:"0 auto",position:"relative"}}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
      {/* TOASTS */}
      <div style={{position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",zIndex:9999,width:"92%",maxWidth:440}}>
        {toasts.map(t=>(
          <div key={t.id} style={{background:"white",borderLeft:`4px solid ${t.color}`,borderRadius:14,padding:"11px 14px",marginBottom:7,boxShadow:"0 8px 24px rgba(232,117,138,0.2)",display:"flex",gap:10,alignItems:"flex-start"}}>
            <p style={{margin:0,fontSize:13,color:"#5c3d52",flex:1,lineHeight:1.4}}>{t.msg}</p>
            <button onClick={()=>setToasts(x=>x.filter(y=>y.id!==t.id))} style={{background:"none",border:"none",cursor:"pointer",color:"#b07a9e",fontSize:18,padding:0,lineHeight:1}}>×</button>
          </div>
        ))}
      </div>
      <div style={{paddingBottom:80}}>
        {tab==="home"&&<HomeTab {...{profile,phase,pi,tdee,tot,rem,tP,tC,tF,tFi,waterToday,water,today,setWater,meals,updateDay,todayD,setAddOpen,setMealCat,weightIn,setWeightIn,setCamOpen,setPeriodOpen,gender}}/>}
        {tab==="journal"&&<JournalTab {...{days,today,tdee,tP,tC,tF,tFi,phase,pi,profile}}/>}
        {tab==="progress"&&<ProgressTab {...{days,profile,tdee}}/>}
        {tab==="calendar"&&<CalendarTab {...{days,phase,updateDay,profile,recipes,customFoods,tdee,tP,tC,tF,tFi}}/>}
        {tab==="settings"&&<SettingsTab {...{profile,setProfile:saveProfile,setShowOnboarding,manualDeficit,setManualDeficit,baseTDEE,phase,username,onLogout,apiKey,saveApiKey,canUseAI,aiUsage,DAILY_AI_LIMIT,subscription,setSubscription,onCancelSub,gender}}/>}
        {tab==="social"&&<SocialTab {...{username,profile,days,recipes,phase,profile}}/>}
        {showPaywall&&<PaywallScreen onClose={()=>setShowPaywall(false)} username={username} setSubscription={setSubscription} setShowPaywall={setShowPaywall}/>}
      </div>
      <nav style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:"rgba(255,255,255,0.97)",backdropFilter:"blur(12px)",borderTop:"1px solid #fce4f0",display:"flex",justifyContent:"space-around",padding:"10px 0 14px",zIndex:100}}>
        {[["🏠","home","Home"],["📋","journal","Heute"],["💞","social","Freunde"],["📅","calendar","Kalender"],["⚙️","settings","Profil"]].map(([ic,t,l])=>(
          <button key={t} onClick={()=>setTab(t)} style={{background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
            <span style={{fontSize:20}}>{ic}</span>
            <span style={{fontSize:10,color:tab===t?"#f2a8cc":"#c4a0b8",fontWeight:tab===t?700:400}}>{l}</span>
          </button>
        ))}
      </nav>
      {addOpen&&<AddMealModal {...{meals,mealCat,setMealCat,doAddMeal,recipes,setRecipeOpen,setEditRecipe,setAddOpen,setCamOpen,setCustomOpen,profile,phase,pi,updateDay,today,toast,customFoods}}/>}
      {recipeOpen&&<RecipeBuilder onClose={()=>{setRecipeOpen(false);setEditRecipe(null);}} editRecipe={editRecipe} onSave={r=>{if(editRecipe&&editRecipe.id&&recipes.some(x=>x.id===editRecipe.id)){setRecipes(p=>p.map(x=>x.id===editRecipe.id?{...r,id:x.id}:x));toast(`✓ Rezept "${r.name}" aktualisiert!`,"#6db87a");}else{setRecipes(p=>[...p,{...r,id:Date.now()}]);toast(`✓ Rezept "${r.name}" gespeichert!`,"#6db87a");}setRecipeOpen(false);setEditRecipe(null);}} profile={profile} phase={phase} pi={pi}/>}
      {camOpen&&<CameraAI onClose={()=>setCamOpen(false)} onAddMeal={e=>{updateDay(today,{meals:[...meals,{...e,id:Date.now(),cat:mealCat}]});setCamOpen(false);toast(`✓ ${e.name} hinzugefügt!`,"#6db87a");}} mealCat={mealCat} apiKey={apiKey} canUseAI={canUseAI} trackAIUsage={trackAIUsage}/>}
      {customOpen&&<CustomFoodModal onClose={()=>setCustomOpen(false)} onAdd={(entry,saveToDb)=>{updateDay(today,{meals:[...meals,entry]});if(saveToDb){setCustomFoods(p=>[...p,{id:Date.now(),name:entry.name,cal:entry._cal100||entry.cal,p:entry._p100||entry.p,c:entry._c100||entry.c,f:entry._f100||entry.f,fi:entry._fi100||entry.fi,unit:entry.unit,unitLabel:entry.qty+entry.unit,cat:"Eigene Lebensmittel",inflammatory:false,endo_ok:true,_custom:true}]);}setCustomOpen(false);toast(`✓ ${entry.name} hinzugefügt!`,"#6db87a");}} mealCat={mealCat}/>}
      {periodOpen&&<PeriodTracker onClose={()=>setPeriodOpen(false)} todayD={todayD} updateDay={updateDay} today={today} days={days}/>}
    </div>
  );
}

// ─── ONBOARDING ───────────────────────────────────────────────────────────────
function Onboarding({profile,setProfile,done}){
  return(
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#fdf7f4,#fce4f0)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"'DM Sans',sans-serif"}}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
      <div style={{background:"white",borderRadius:28,padding:32,maxWidth:440,width:"100%",boxShadow:"0 20px 60px rgba(242,168,204,0.25)"}}>
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{fontSize:52,marginBottom:8}}>🌸</div>
          <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:28,color:"#5c3d52",margin:0}}>GlowTrack</h1>
          <p style={{color:"#b07a9e",margin:"6px 0 0",fontSize:14}}>Dein persönlicher Wellness-Begleiter</p>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {[["Name","name","text","Dein Name"],["Alter","age","number","28"],["Größe (cm)","height","number","165"],["Gewicht (kg)","weight","number","65"],["Zielgewicht (kg)","goalWeight","number","58"]].map(([l,k,t,ph])=>(
            <div key={k}><Label>{l}</Label><Input type={t} placeholder={ph} value={profile[k]} onChange={e=>setProfile(p=>({...p,[k]:e.target.value}))}/></div>
          ))}
          {[["Aktivitätslevel","activity",[["sedentary","Sitzend"],["light","Leicht aktiv"],["moderate","Moderat aktiv"],["active","Sehr aktiv"],["extreme","Extrem aktiv"]]],
            ["Ziel","goal",[["lose","Abnehmen"],["maintain","Halten"],["gain","Zunehmen"]]]].map(([l,k,opts])=>(
            <div key={k}><Label>{l}</Label>
              <select value={profile[k]} onChange={e=>setProfile(p=>({...p,[k]:e.target.value}))}
                style={{display:"block",width:"100%",marginTop:4,padding:"10px 14px",border:"1.5px solid #fce4f0",borderRadius:12,fontSize:14,color:"#5c3d52",outline:"none",background:"#fdf7f4"}}>
                {opts.map(([v,lb])=><option key={v} value={v}>{lb}</option>)}
              </select>
            </div>
          ))}
          <div><Label>Letzter Periodenbeginn</Label><Input type="date" value={profile.lastPeriod} onChange={e=>setProfile(p=>({...p,lastPeriod:e.target.value}))}/></div>
          <div><Label>Zykluslänge (Tage)</Label><Input type="number" value={profile.cycleLen} onChange={e=>setProfile(p=>({...p,cycleLen:Number(e.target.value)}))}/></div>
          <div style={{display:"flex",alignItems:"center",gap:12,background:"#fdeef1",borderRadius:14,padding:"12px 16px"}}>
            <input type="checkbox" id="endo" checked={profile.hasEndometriosis} onChange={e=>setProfile(p=>({...p,hasEndometriosis:e.target.checked}))} style={{width:18,height:18,accentColor:"#e8758a"}}/>
            <label htmlFor="endo" style={{fontSize:14,color:"#5c3d52",fontWeight:500,cursor:"pointer"}}>Ich habe Endometriose</label>
          </div>
        </div>
        <PinkBtn onClick={done} style={{marginTop:24}}>GlowTrack starten 🌸</PinkBtn>
      </div>
    </div>
  );
}

// ─── HOME TAB ─────────────────────────────────────────────────────────────────
function HomeTab({profile,phase,pi,tdee,tot,rem,tP,tC,tF,tFi,waterToday,water,today,setWater,meals,updateDay,todayD,setAddOpen,setMealCat,weightIn,setWeightIn,setCamOpen,setPeriodOpen,gender}){
  const mealGroups=["Frühstück","Mittagessen","Abendessen","Snacks"];
  return(
    <div style={{padding:"0 16px"}}>
      {/* Header */}
      <div style={{background:`linear-gradient(135deg,${pi.bg},#fce4f0)`,margin:"0 -16px",padding:"48px 24px 20px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <p style={{margin:0,fontSize:13,color:"#b07a9e",fontWeight:500}}>{new Date().toLocaleDateString("de-DE",{weekday:"long",day:"numeric",month:"long"})}</p>
            <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:26,color:"#5c3d52",margin:"4px 0 0"}}>Hallo, {profile.name||"Gorgeous"} ✨</h1>
          </div>
          <div style={{background:"white",borderRadius:14,padding:"8px 12px",textAlign:"center",boxShadow:"0 4px 16px rgba(242,168,204,0.2)",cursor:"pointer"}} onClick={()=>setPeriodOpen(true)}>
            <div style={{fontSize:18}}>{pi.emoji}</div>
            <div style={{fontSize:10,color:"#b07a9e",fontWeight:700,marginTop:1}}>{pi.name}</div>
          </div>
        </div>
        <div style={{background:"white",borderRadius:18,padding:14,marginTop:12,boxShadow:"0 4px 20px rgba(242,168,204,0.15)"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
            <div style={{width:8,height:8,borderRadius:99,background:pi.color}}/>
            <span style={{fontSize:12,fontWeight:700,color:pi.color}}>{pi.name} · {pi.days}</span>
          </div>
          <p style={{margin:"0 0 8px",fontSize:13,color:"#5c3d52",lineHeight:1.5}}>{pi.tip}</p>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <span style={{background:"#fdf7f4",borderRadius:99,padding:"3px 10px",fontSize:11,color:"#b07a9e",fontWeight:600}}>💪 {pi.sport}</span>
            <span style={{background:"#fdf7f4",borderRadius:99,padding:"3px 10px",fontSize:11,color:"#b07a9e",fontWeight:600}}>😊 {pi.mood}</span>
          </div>
        </div>
      </div>
      {/* RING */}
      <div style={{display:"flex",justifyContent:"center",alignItems:"center",gap:20,padding:"20px 0 8px"}}>
        <CircRing value={tot.cal} max={tdee}>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:30,fontWeight:800,color:"#5c3d52",lineHeight:1}}>{rem}</div>
            <div style={{fontSize:11,color:"#b07a9e",marginTop:2}}>kcal übrig</div>
            <div style={{fontSize:10,color:"#c4a0b8",marginTop:1}}>{tot.cal} / {tdee}</div>
          </div>
        </CircRing>
        <div style={{display:"flex",flexDirection:"column",gap:10,flex:1}}>
          {[["Protein","p",tP,"#a8d8ea"],["Kohlenh.","c",tC,"#e8c97e"],["Fett","f",tF,"#b5d8a8"],["Ballaststoffe","fi",tFi,"#c8b0d8"]].map(([l,k,t,c])=>(
            <div key={l} style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:7,height:7,borderRadius:99,background:c,flexShrink:0}}/>
              <div style={{flex:1}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                  <span style={{fontSize:11,color:"#b07a9e",fontWeight:600}}>{l}</span>
                  <span style={{fontSize:11,color:"#5c3d52",fontWeight:700}}>{Math.round(tot[k])}/{t}g</span>
                </div>
                <Bar value={tot[k]} max={t} color={c}/>
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Cam button */}
      <button onClick={()=>setCamOpen(true)} style={{width:"100%",padding:"12px",background:"linear-gradient(135deg,#5c3d52,#8b6db8)",border:"none",borderRadius:14,fontSize:14,fontWeight:700,color:"white",cursor:"pointer",marginBottom:10,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
        📷 Essen fotografieren & KI analysieren
      </button>
      {/* Period tracker button – female only */}
      {(gender==="female"||(profile&&profile.gender==="female"))&&(
        <button onClick={()=>setPeriodOpen(true)} style={{width:"100%",padding:"12px",background:"linear-gradient(135deg,#fdeef1,#fce4f0)",border:"1.5px solid #f2a8cc",borderRadius:14,fontSize:14,fontWeight:600,color:"#e8758a",cursor:"pointer",marginBottom:10,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          🌸 Periode & Zyklus tracken
        </button>
      )}
      {(gender==="male"||(profile&&profile.gender==="male"))&&(
        <div style={{background:"linear-gradient(135deg,#edf7ef,#f3eef9)",border:"1.5px solid #6db87a",borderRadius:14,padding:"12px 16px",marginBottom:10,display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:20}}>💑</span>
          <div>
            <p style={{margin:0,fontSize:13,fontWeight:600,color:"#3a7a4a"}}>Partner-Ansicht</p>
            <p style={{margin:"2px 0 0",fontSize:11,color:"#6db87a"}}>Zyklusdaten deiner Partnerin unter Family & Friends einsehen</p>
          </div>
        </div>
      )}
      {/* Weight */}
      <Card>
        <p style={{margin:"0 0 10px",fontSize:13,fontWeight:700,color:"#5c3d52"}}>⚖️ Gewicht heute</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {[["🌅 Nüchtern","morning"],["🌙 Abend","evening"]].map(([lb,k])=>(
            <div key={k}>
              <label style={{fontSize:11,color:"#b07a9e",fontWeight:600}}>{lb}</label>
              <div style={{display:"flex",gap:6,marginTop:4}}>
                <input type="number" step="0.1" placeholder="kg" value={weightIn[k]} onChange={e=>setWeightIn(p=>({...p,[k]:e.target.value}))}
                  style={{flex:1,padding:"8px 10px",border:"1.5px solid #fce4f0",borderRadius:10,fontSize:14,color:"#5c3d52",outline:"none",background:"#fdf7f4"}}/>
                <button onClick={()=>updateDay(today,{[k+"Weight"]:weightIn[k]})}
                  style={{background:"#fce4f0",border:"none",borderRadius:10,padding:"0 10px",cursor:"pointer",color:"#e8758a",fontSize:16}}>✓</button>
              </div>
            </div>
          ))}
        </div>
      </Card>
      {/* Water */}
      <Card>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
          <span style={{fontSize:13,fontWeight:700,color:"#5c3d52"}}>💧 Wasser</span>
          <span style={{fontSize:13,color:"#b07a9e",fontWeight:600}}>{waterToday}ml / 2500ml</span>
        </div>
        <Bar value={waterToday} max={2500} color="#a8d8ea"/>
        <div style={{display:"flex",gap:8,marginTop:10}}>
          {[200,330,500].map(ml=>(
            <button key={ml} onClick={()=>setWater(w=>({...w,[today]:(w[today]||0)+ml}))}
              style={{flex:1,padding:"8px",background:"#f0f9fc",border:"1.5px solid #a8d8ea",borderRadius:10,fontSize:13,fontWeight:600,color:"#5c8a9e",cursor:"pointer"}}>+{ml}ml</button>
          ))}
        </div>
      </Card>

      {/* Meals */}
      {mealGroups.map(grp=>(
        <Card key={grp}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <span style={{fontSize:14,fontWeight:700,color:"#5c3d52"}}>{grp}</span>
            <button onClick={()=>{setMealCat(grp);setAddOpen(true);}} style={{background:"#fce4f0",border:"none",borderRadius:99,padding:"5px 12px",fontSize:12,color:"#e8758a",fontWeight:600,cursor:"pointer"}}>+ Hinzufügen</button>
          </div>
          {meals.filter(m=>m.cat===grp).length===0&&<p style={{margin:0,fontSize:12,color:"#c4a0b8",fontStyle:"italic"}}>Noch nichts eingetragen</p>}
          {meals.filter(m=>m.cat===grp).map(m=>(
            <div key={m.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"1px solid #fdf7f4"}}>
              <div>
                <div style={{display:"flex",alignItems:"center",gap:5}}>
                  <span style={{fontSize:13,fontWeight:600,color:"#5c3d52"}}>{m.name}</span>
                  {m.inflammatory&&<span style={{background:"#fdeef1",color:"#e8758a",fontSize:9,padding:"1px 4px",borderRadius:99}}>⚡</span>}
                </div>
                <span style={{fontSize:11,color:"#b07a9e"}}>{m.qty}{m.unit==="ml"?"ml":"g"} · {m.cal} kcal · P{m.p}g · K{m.c}g · F{m.f}g · Bal.{m.fi}g</span>
              </div>
              <button onClick={()=>updateDay(today,{meals:meals.filter(x=>x.id!==m.id)})} style={{background:"none",border:"none",cursor:"pointer",color:"#e8758a",fontSize:15,padding:"0 4px"}}>🗑</button>
            </div>
          ))}
        </Card>
      ))}
    </div>
  );
}

// ─── ADD MEAL MODAL ───────────────────────────────────────────────────────────
function AddMealModal({meals,mealCat,setMealCat,doAddMeal,recipes,setRecipeOpen,setEditRecipe,setAddOpen,setCamOpen,setCustomOpen,profile,phase,pi,updateDay,today,toast,customFoods}){
  const [q,setQ]=useState("");
  const [filterCat,setFilterCat]=useState("Alle");
  const [sel,setSel]=useState(null);
  const [qty,setQty]=useState(100);
  const allFoods=[...FOOD_DB,...(customFoods||[])];
  const filtered=allFoods.filter(f=>(f.name.toLowerCase().includes(q.toLowerCase())&&q.length>0)&&(filterCat==="Alle"||f.cat===filterCat)).slice(0,15);
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(92,61,82,0.4)",zIndex:200,display:"flex",alignItems:"flex-end"}} onClick={()=>setAddOpen(false)}>
      <div style={{background:"white",borderRadius:"24px 24px 0 0",width:"100%",maxWidth:480,margin:"0 auto",padding:20,maxHeight:"88vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <h3 style={{fontFamily:"'Playfair Display',serif",margin:0,color:"#5c3d52",fontSize:20}}>Mahlzeit hinzufügen</h3>
          <button onClick={()=>setAddOpen(false)} style={{background:"#fce4f0",border:"none",borderRadius:99,width:32,height:32,cursor:"pointer",fontSize:18,color:"#e8758a"}}>×</button>
        </div>
        <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
          {["Frühstück","Mittagessen","Abendessen","Snacks"].map(g=>(
            <button key={g} onClick={()=>setMealCat(g)} style={{padding:"5px 12px",borderRadius:99,border:"1.5px solid",borderColor:mealCat===g?"#f2a8cc":"#fce4f0",background:mealCat===g?"#fce4f0":"white",color:mealCat===g?"#8b2252":"#b07a9e",fontSize:12,fontWeight:600,cursor:"pointer"}}>{g}</button>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
          <button onClick={()=>{setAddOpen(false);setCamOpen(true);}} style={{padding:"11px",background:"linear-gradient(135deg,#5c3d52,#8b6db8)",border:"none",borderRadius:12,fontSize:13,fontWeight:700,color:"white",cursor:"pointer"}}>📷 KI-Kamera</button>
          <button onClick={()=>{setAddOpen(false);setCustomOpen(true);}} style={{padding:"11px",background:"#fdf7f4",border:"1.5px dashed #f2a8cc",borderRadius:12,fontSize:13,fontWeight:600,color:"#b07a9e",cursor:"pointer"}}>✏️ Selbst eingeben</button>
        </div>
        {recipes.length>0&&(
          <div style={{marginBottom:12}}>
            <p style={{fontSize:11,color:"#b07a9e",fontWeight:700,textTransform:"uppercase",margin:"0 0 7px"}}>Meine Rezepte</p>
            <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:4}}>
              {recipes.map(r=>(
                <div key={r.id} style={{flexShrink:0,background:"linear-gradient(135deg,#fdf7f4,#fce4f0)",border:"1.5px solid #fce4f0",borderRadius:12,padding:"9px 13px",minWidth:140}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#5c3d52",marginBottom:2}}>🍽️ {r.name}</div>
                  <div style={{fontSize:11,color:"#b07a9e",marginBottom:6}}>{r.cal} kcal · P{r.p}g · K{r.c}g</div>
                  {r.ingredients&&<div style={{fontSize:10,color:"#c4a0b8",marginBottom:6}}>{r.ingredients.length} Zutaten</div>}
                  <div style={{display:"flex",gap:5}}>
                    <button onClick={()=>{updateDay(today,{meals:[...meals,{...r,id:Date.now(),cat:mealCat,unit:"g",inflammatory:false,endo_ok:true}]});setAddOpen(false);toast(`✓ ${r.name} hinzugefügt!`,"#6db87a");}}
                      style={{flex:1,padding:"5px 0",background:"linear-gradient(135deg,#f2a8cc,#e8758a)",border:"none",borderRadius:8,fontSize:11,fontWeight:700,color:"white",cursor:"pointer"}}>+ Hinzufügen</button>
                    <button onClick={()=>{setEditRecipe(r);setRecipeOpen(true);setAddOpen(false);}}
                      style={{padding:"5px 8px",background:"white",border:"1.5px solid #fce4f0",borderRadius:8,fontSize:11,color:"#b07a9e",cursor:"pointer"}}>✏️</button>
                    <button onClick={()=>{const dup={...r,id:Date.now(),name:r.name+" (Kopie)",ingredients:(r.ingredients||[]).map(i=>({...i,id:Date.now()+Math.random()}))};setEditRecipe(dup);setRecipeOpen(true);setAddOpen(false);toast("📋 Rezept dupliziert – jetzt bearbeiten!","#6db87a");}}
                      style={{padding:"5px 8px",background:"white",border:"1.5px solid #fce4f0",borderRadius:8,fontSize:11,color:"#b07a9e",cursor:"pointer"}} title="Duplizieren">📋</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <button onClick={()=>{setAddOpen(false);setRecipeOpen(true);}} style={{width:"100%",padding:"9px",background:"#fdf7f4",border:"1.5px dashed #f2a8cc",borderRadius:12,fontSize:13,fontWeight:600,color:"#b07a9e",cursor:"pointer",marginBottom:12}}>+ Neues Rezept erstellen</button>
        <input value={q} onChange={e=>{setQ(e.target.value);setSel(null);}} placeholder="Suchen: Hähnchen, More Nutrition, Red Bull, Schokolade…"
          style={{width:"100%",padding:"10px 14px",border:"1.5px solid #fce4f0",borderRadius:12,fontSize:14,color:"#5c3d52",outline:"none",background:"#fdf7f4",boxSizing:"border-box",marginBottom:8}}/>
        <div style={{display:"flex",gap:5,overflowX:"auto",paddingBottom:5,marginBottom:8}}>
          {["Alle",...CATS,...(customFoods&&customFoods.length>0?["Eigene Lebensmittel"]:[])].filter((v,i,a)=>a.indexOf(v)===i).map(c=>(
            <button key={c} onClick={()=>setFilterCat(c)} style={{flexShrink:0,padding:"3px 9px",borderRadius:99,border:"1.5px solid",borderColor:filterCat===c?"#f2a8cc":"#fce4f0",background:filterCat===c?"#fce4f0":"white",fontSize:11,fontWeight:600,color:filterCat===c?"#8b2252":"#b07a9e",cursor:"pointer"}}>{c}</button>
          ))}
        </div>
        {filtered.length>0&&!sel&&(
          <div style={{border:"1px solid #fce4f0",borderRadius:14,overflow:"hidden",marginBottom:10}}>
            {filtered.map((f,i)=>(
              <button key={f.id} onClick={()=>{setSel(f);setQty(100);}} style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",padding:"10px 14px",background:"white",border:"none",borderBottom:i<filtered.length-1?"1px solid #fce4f0":"none",cursor:"pointer",textAlign:"left"}}>
                <div style={{flex:1}}>
                  <div style={{display:"flex",gap:5,alignItems:"center",flexWrap:"wrap"}}>
                    <span style={{fontSize:13,fontWeight:600,color:"#5c3d52"}}>{f.name}</span>
                    {f.inflammatory&&<span style={{background:"#fdeef1",color:"#e8758a",fontSize:9,padding:"1px 4px",borderRadius:99,fontWeight:700}}>⚡</span>}
                    {profile.hasEndometriosis&&!f.endo_ok&&<span style={{background:"#fdeef1",color:"#c0392b",fontSize:9,padding:"1px 4px",borderRadius:99,fontWeight:700}}>Endo</span>}
                  </div>
                  <div style={{fontSize:11,color:"#b07a9e"}}>{f.cal} kcal/100{f.unit} · P{f.p}g · K{f.c}g · F{f.f}g · Bal.{f.fi}g</div>
                </div>
                <span style={{color:"#f2a8cc",fontSize:20}}>+</span>
              </button>
            ))}
          </div>
        )}
        {sel&&(
          <div style={{background:"#fdf7f4",borderRadius:14,padding:14}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
              <div><div style={{fontWeight:700,color:"#5c3d52",fontSize:14}}>{sel.name}</div>
                <div style={{fontSize:11,color:"#b07a9e"}}>{sel.cal} kcal pro 100{sel.unit}</div></div>
              <button onClick={()=>setSel(null)} style={{background:"none",border:"none",cursor:"pointer",color:"#b07a9e",fontSize:18}}>×</button>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
              <span style={{fontSize:13,color:"#b07a9e",fontWeight:600,whiteSpace:"nowrap"}}>
                {sel.unit==="Stück"?"Stückzahl":sel.unit==="ml"?"Menge (ml)":"Menge (g)"}:
              </span>
              {sel.unit==="Stück"?(
                <div style={{display:"flex",alignItems:"center",gap:8,flex:1}}>
                  <button onClick={()=>setQty(q=>Math.max(1,q-1))} style={{width:34,height:34,borderRadius:99,background:"#fce4f0",border:"none",fontSize:20,color:"#e8758a",cursor:"pointer",fontWeight:700}}>−</button>
                  <span style={{fontSize:20,fontWeight:800,color:"#5c3d52",minWidth:30,textAlign:"center"}}>{qty}</span>
                  <button onClick={()=>setQty(q=>q+1)} style={{width:34,height:34,borderRadius:99,background:"#fce4f0",border:"none",fontSize:20,color:"#e8758a",cursor:"pointer",fontWeight:700}}>+</button>
                  <span style={{fontSize:12,color:"#b07a9e"}}>{sel.unitLabel}</span>
                </div>
              ):(
                <input type="number" value={qty} onChange={e=>setQty(Number(e.target.value))} min={1}
                  style={{flex:1,padding:"8px 12px",border:"1.5px solid #fce4f0",borderRadius:10,fontSize:15,color:"#5c3d52",outline:"none",background:"white"}}/>
              )}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:6,marginBottom:12}}>
              {[["kcal",Math.round(sel.cal*qty/100),"#f2a8cc"],["Prot.",Math.round(sel.p*qty/100*10)/10+"g","#a8d8ea"],["Koh.",Math.round(sel.c*qty/100*10)/10+"g","#e8c97e"],["Fett",Math.round(sel.f*qty/100*10)/10+"g","#b5d8a8"],["Bal.",Math.round((sel.fi||0)*qty/100*10)/10+"g","#c8b0d8"]].map(([l,v,c])=>(
                <div key={l} style={{textAlign:"center",background:"white",borderRadius:10,padding:"7px 3px"}}>
                  <div style={{fontSize:12,fontWeight:700,color:c}}>{v}</div>
                  <div style={{fontSize:10,color:"#b07a9e"}}>{l}</div>
                </div>
              ))}
            </div>
            <PinkBtn onClick={()=>doAddMeal(sel,qty)}>Hinzufügen ✓</PinkBtn>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── CUSTOM FOOD MODAL ────────────────────────────────────────────────────────
function CustomFoodModal({onClose,onAdd,mealCat}){
  const [form,setForm]=useState({name:"",cal:"",p:"",c:"",f:"",fi:"",qty:100,unit:"g"});
  const s=(k,v)=>setForm(p=>({...p,[k]:v}));
  const n=(v)=>Math.round((Number(v)||0)*100)/100;

  function handleAdd(saveToDb){
    if(!form.name||!form.qty) return;
    const qty=Number(form.qty);
    // Per-100 values for reuse in DB
    const _cal100=Math.round((Number(form.cal)||0)/qty*100);
    const _p100=n((Number(form.p)||0)/qty*100);
    const _c100=n((Number(form.c)||0)/qty*100);
    const _f100=n((Number(form.f)||0)/qty*100);
    const _fi100=n((Number(form.fi)||0)/qty*100);
    const entry={
      id:Date.now(), name:form.name, qty, unit:form.unit,
      cat:"Eigene Lebensmittel",
      cal:Math.round(Number(form.cal)||0),
      p:n(form.p), c:n(form.c), f:n(form.f), fi:n(form.fi),
      inflammatory:false, endo_ok:true, _custom:true,
      _cal100,_p100,_c100,_f100,_fi100,
    };
    onAdd(entry, saveToDb);
    onClose();
  }

  const filled=form.cal!==""||form.p!==""||form.c!=="";
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(92,61,82,0.45)",zIndex:350,display:"flex",alignItems:"flex-end"}} onClick={onClose}>
      <div style={{background:"white",borderRadius:"24px 24px 0 0",width:"100%",maxWidth:480,margin:"0 auto",padding:20,maxHeight:"88vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <h3 style={{fontFamily:"'Playfair Display',serif",margin:0,color:"#5c3d52",fontSize:20}}>✏️ Nährwerte eingeben</h3>
          <button onClick={onClose} style={{background:"#fce4f0",border:"none",borderRadius:99,width:32,height:32,cursor:"pointer",fontSize:18,color:"#e8758a"}}>×</button>
        </div>
        {/* Info */}
        <div style={{background:"#fdf7f4",border:"1.5px solid #fce4f0",borderRadius:14,padding:"10px 14px",marginBottom:14}}>
          <p style={{margin:0,fontSize:13,color:"#5c3d52",lineHeight:1.5}}>
            💡 Gib die <strong>tatsächliche Menge</strong> an die du gegessen/getrunken hast – z.B. <em>330 ml</em> – und trag die Nährwerte <strong>genau für diese Menge</strong> ein. Es wird nichts umgerechnet.
          </p>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:11}}>
          <div><Label>Name des Lebensmittels</Label>
            <input value={form.name} onChange={e=>s("name",e.target.value)} placeholder="z.B. Bio-Saft, eigenes Gericht…"
              style={{display:"block",width:"100%",marginTop:4,padding:"10px 14px",border:"1.5px solid #fce4f0",borderRadius:12,fontSize:14,color:"#5c3d52",outline:"none",background:"#fdf7f4",boxSizing:"border-box"}}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div><Label>Einheit</Label>
              <select value={form.unit} onChange={e=>s("unit",e.target.value)}
                style={{display:"block",width:"100%",marginTop:4,padding:"10px 14px",border:"1.5px solid #fce4f0",borderRadius:12,fontSize:14,color:"#5c3d52",outline:"none",background:"#fdf7f4"}}>
                <option value="g">Gramm (g)</option>
                <option value="ml">Milliliter (ml)</option>
                <option value="Stück">Stück</option>
              </select>
            </div>
            <div><Label>Tatsächliche Menge</Label>
              <div style={{display:"flex",alignItems:"center",gap:6,marginTop:4}}>
                <input type="number" value={form.qty} onChange={e=>s("qty",e.target.value)} min={1}
                  style={{flex:1,padding:"10px 10px",border:"1.5px solid #fce4f0",borderRadius:12,fontSize:14,color:"#5c3d52",outline:"none",background:"#fdf7f4"}}/>
                <span style={{fontSize:13,color:"#b07a9e",fontWeight:600}}>{form.unit}</span>
              </div>
            </div>
          </div>
          <div style={{background:"#f3eef9",borderRadius:10,padding:"8px 12px"}}>
            <p style={{margin:0,fontSize:12,color:"#8b6db8",fontWeight:600}}>Nährwerte für genau {form.qty||"?"} {form.unit}:</p>
          </div>
          {[["Kalorien","cal","kcal","#f2a8cc"],["Protein","p","g","#a8d8ea"],["Kohlenhydrate","c","g","#e8c97e"],["Fett","f","g","#b5d8a8"],["Ballaststoffe","fi","g","#c8b0d8"]].map(([l,k,u,col])=>(
            <div key={k} style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:8,height:8,borderRadius:99,background:col,flexShrink:0}}/>
              <span style={{fontSize:13,color:"#5c3d52",width:125,flexShrink:0}}>{l}</span>
              <input type="number" step="0.01" value={form[k]} onChange={e=>s(k,e.target.value)} min={0} placeholder="0"
                style={{flex:1,padding:"8px 10px",border:"1.5px solid #fce4f0",borderRadius:10,fontSize:14,color:"#5c3d52",outline:"none",background:"#fdf7f4",textAlign:"right"}}/>
              <span style={{fontSize:13,color:"#b07a9e",fontWeight:600,width:26}}>{u}</span>
            </div>
          ))}
          {filled&&(
            <div style={{background:"linear-gradient(135deg,#fdf7f4,#fce4f0)",borderRadius:14,padding:"12px 14px",border:"1px solid #fce4f0"}}>
              <p style={{margin:"0 0 8px",fontSize:11,color:"#b07a9e",fontWeight:700,textTransform:"uppercase",letterSpacing:0.5}}>Vorschau – wird so gespeichert</p>
              <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:6}}>
                {[["kcal",Math.round(Number(form.cal)||0),"#f2a8cc"],["Prot.",n(form.p)+"g","#a8d8ea"],["Koh.",n(form.c)+"g","#e8c97e"],["Fett",n(form.f)+"g","#b5d8a8"],["Bal.",n(form.fi)+"g","#c8b0d8"]].map(([l,v,c])=>(
                  <div key={l} style={{textAlign:"center",background:"white",borderRadius:10,padding:"7px 3px"}}>
                    <div style={{fontSize:13,fontWeight:700,color:c}}>{v}</div>
                    <div style={{fontSize:10,color:"#b07a9e"}}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div style={{marginTop:16,display:"flex",flexDirection:"column",gap:8}}>
          <button onClick={()=>handleAdd(true)} disabled={!form.name||!form.qty}
            style={{padding:"13px",background:(!form.name||!form.qty)?"#fce4f0":"linear-gradient(135deg,#f2a8cc,#e8758a)",border:"none",borderRadius:14,fontSize:15,fontWeight:700,color:(!form.name||!form.qty)?"#c4a0b8":"white",cursor:(!form.name||!form.qty)?"default":"pointer"}}>
            Hinzufügen & in Lebensmitteldatenbank speichern 💾
          </button>
          <button onClick={()=>handleAdd(false)} disabled={!form.name||!form.qty}
            style={{padding:"11px",background:"white",border:"1.5px solid #fce4f0",borderRadius:14,fontSize:14,fontWeight:600,color:"#b07a9e",cursor:(!form.name||!form.qty)?"default":"pointer"}}>
            Nur jetzt hinzufügen (nicht speichern)
          </button>
        </div>
      </div>
    </div>
  );
}
// ─── PERIOD TRACKER (Clue-Style + Analyse) ──────────────────────────────────
function PeriodTracker({onClose,todayD,updateDay,today,days,inline=false,dateLabel=null}){
  const [activeTab,setActiveTab]=useState("log");
  const saved=todayD.period||{};
  const [data,setData]=useState({
    isPeriod:saved.isPeriod||false,
    flow:saved.flow||"",color:saved.color||"",consistency:saved.consistency||"",
    discharge:saved.discharge||"",skin:saved.skin||"",hair:saved.hair||"",
    mood:saved.mood||[],energy:saved.energy||0,cramps:saved.cramps||0,
    bloating:saved.bloating||0,breast:saved.breast||0,headache:saved.headache||0,
    backpain:saved.backpain||0,libido:saved.libido||0,sleep:saved.sleep||0,
    acne:saved.acne||"",notes:saved.notes||""
  });
  const set=(k,v)=>setData(p=>({...p,[k]:v}));
  const toggleMood=(m)=>setData(p=>({...p,mood:p.mood.includes(m)?p.mood.filter(x=>x!==m):[...p.mood,m]}));
  function save(){updateDay(today,{period:data});onClose();}

  // Build analysis from past 90 days
  const periodDays=Object.entries(days).filter(([,d])=>d.period?.isPeriod).sort(([a],[b])=>a.localeCompare(b));
  const last6Cycles=[];
  let cycleStart=null;
  for(const [date] of periodDays){
    if(!cycleStart){cycleStart=date;continue;}
    const prev=periodDays[periodDays.indexOf(periodDays.find(([d])=>d===date))-1];
    if(prev){
      const gap=Math.floor((new Date(date)-new Date(prev[0]))/86400000);
      if(gap>2) last6Cycles.push({start:date,gap});
    }
  }
  const avgCycleLen=last6Cycles.length?Math.round(last6Cycles.reduce((a,c)=>a+c.gap,0)/last6Cycles.length):null;
  const moodCounts={};
  const symptomAvgs={cramps:0,bloating:0,energy:0,sleep:0,headache:0};
  let symptomDayCount=0;
  for(const [,d] of Object.entries(days)){
    if(d.period){
      symptomDayCount++;
      (d.period.mood||[]).forEach(m=>moodCounts[m]=(moodCounts[m]||0)+1);
      Object.keys(symptomAvgs).forEach(k=>{if(d.period[k]) symptomAvgs[k]+=(d.period[k]||0);});
    }
  }
  if(symptomDayCount>0) Object.keys(symptomAvgs).forEach(k=>symptomAvgs[k]=Math.round((symptomAvgs[k]/symptomDayCount)*10)/10);
  const topMoods=Object.entries(moodCounts).sort(([,a],[,b])=>b-a).slice(0,3).map(([m])=>m);

  const FLOW=["Sehr leicht","Leicht","Mittel","Stark","Sehr stark"];
  const COLORS=["Hellrot","Dunkelrot","Rotbraun","Braun","Rosa","Orange","Schwärzlich"];
  const CONSIST=["Flüssig","Normal","Klumpig","Dicke Klumpen"];
  const DISCHARGE=["Kein","Weißlich/Cremig","Wässrig","Klar/Glasig","Gelblich","Bräunlich","Grünlich"];
  const SKIN=["Strahlend","Gut","Okay","Etwas unrein","Starker Ausbruch"];
  const HAIR=["Glänzend & voll","Normal","Leicht fettig","Fettig","Trocken","Spürbar Haarausfall"];
  const MOODS=["😊 Gut","😐 Okay","😢 Traurig","😡 Reizbar","😰 Ängstlich","🥰 Liebevoll","😴 Erschöpft","💪 Motiviert","🌀 PMS","🤯 Überfordert","🧘 Ausgeglichen","😍 Selbstbewusst"];
  const ACNE=["Keine","Leicht","Mittel","Stark"];

  const Pills=({opts,val,onSel,multi=false})=><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
    {opts.map(o=>{
      const active=multi?val.includes(o):val===o;
      return <button key={o} onClick={()=>onSel(o)} style={{padding:"5px 13px",borderRadius:99,border:"1.5px solid",borderColor:active?"#f2a8cc":"#fce4f0",background:active?"#fce4f0":"white",color:active?"#8b2252":"#b07a9e",fontSize:12,fontWeight:600,cursor:"pointer"}}>{o}</button>;
    })}
  </div>;
  const Scale=({label,k,emoji=""})=><div style={{marginBottom:12}}>
    <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
      <span style={{fontSize:13,color:"#5c3d52"}}>{emoji} {label}</span>
      <span style={{fontSize:12,fontWeight:700,color:"#f2a8cc"}}>{data[k]>0?`${data[k]}/5`:"-"}</span>
    </div>
    <div style={{display:"flex",gap:5}}>
      {[1,2,3,4,5].map(n=><button key={n} onClick={()=>set(k,data[k]===n?0:n)}
        style={{flex:1,height:26,borderRadius:99,border:"1.5px solid",borderColor:data[k]>=n?"#f2a8cc":"#fce4f0",background:data[k]>=n?"#f2a8cc":"white",cursor:"pointer"}}/>)}
    </div>
  </div>;
  const Sec=({title,children})=><div style={{marginBottom:20}}><p style={{margin:"0 0 10px",fontSize:11,color:"#b07a9e",fontWeight:700,textTransform:"uppercase",letterSpacing:0.5}}>{title}</p>{children}</div>;

  return(
    <div style={inline?{}:{position:"fixed",inset:0,background:"rgba(92,61,82,0.45)",zIndex:400,display:"flex",alignItems:"flex-end"}} onClick={inline?undefined:onClose}>
      <div style={inline?{background:"white",borderRadius:18,border:"1.5px solid #f2a8cc",overflow:"hidden"}:{background:"white",borderRadius:"24px 24px 0 0",width:"100%",maxWidth:480,margin:"0 auto",maxHeight:"92vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
        {/* Header */}
        <div style={{background:"linear-gradient(135deg,#fdeef1,#fce4f0)",padding:"14px 16px 0",borderRadius:inline?"18px 18px 0 0":"24px 24px 0 0"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <h3 style={{fontFamily:"'Playfair Display',serif",margin:0,color:"#5c3d52",fontSize:18}}>🌸 {dateLabel||"Periode & Zyklus"}</h3>
            <button onClick={onClose} style={{background:"white",border:"none",borderRadius:99,width:30,height:30,cursor:"pointer",fontSize:16,color:"#e8758a"}}>×</button>
          </div>
          {/* Tabs */}
          <div style={{display:"flex",gap:0,borderBottom:"2px solid #fce4f0"}}>
            {[["log","📋 Heute"],["analyse","📊 Analyse"]].map(([t,l])=>(
              <button key={t} onClick={()=>setActiveTab(t)}
                style={{flex:1,padding:"10px 0",background:"none",border:"none",cursor:"pointer",fontSize:13,fontWeight:700,color:activeTab===t?"#e8758a":"#b07a9e",borderBottom:activeTab===t?"2px solid #e8758a":"2px solid transparent",marginBottom:-2}}>
                {l}
              </button>
            ))}
          </div>
        </div>

        <div style={{padding:inline?14:20}}>
        {activeTab==="log" && <>
          {/* Period toggle */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:data.isPeriod?"#fdeef1":"#fdf7f4",borderRadius:16,padding:"14px 16px",marginBottom:18,border:`1.5px solid ${data.isPeriod?"#f2a8cc":"#fce4f0"}`}}>
            <div>
              <div style={{fontSize:14,fontWeight:700,color:"#5c3d52"}}>🩸 Periode heute?</div>
              <div style={{fontSize:12,color:"#b07a9e",marginTop:2}}>Aktiviere um Blutungsdetails einzutragen</div>
            </div>
            <button onClick={()=>set("isPeriod",!data.isPeriod)}
              style={{width:50,height:28,borderRadius:99,background:data.isPeriod?"#f2a8cc":"#e0e0e0",border:"none",cursor:"pointer",position:"relative",transition:"background 0.3s"}}>
              <div style={{width:22,height:22,borderRadius:99,background:"white",position:"absolute",top:3,left:data.isPeriod?25:3,transition:"left 0.3s",boxShadow:"0 1px 4px rgba(0,0,0,0.2)"}}/>
            </button>
          </div>

          {data.isPeriod && <>
            <Sec title="Blutungsstärke">
              <Pills opts={FLOW} val={data.flow} onSel={v=>set("flow",v)}/>
            </Sec>
            <Sec title="Farbe">
              <Pills opts={COLORS} val={data.color} onSel={v=>set("color",v)}/>
            </Sec>
            <Sec title="Konsistenz">
              <Pills opts={CONSIST} val={data.consistency} onSel={v=>set("consistency",v)}/>
            </Sec>
          </>}

          <Sec title="Ausfluss">
            <Pills opts={DISCHARGE} val={data.discharge} onSel={v=>set("discharge",v)}/>
          </Sec>

          <Sec title="Stimmung (mehrere möglich)">
            <Pills opts={MOODS} val={data.mood} onSel={toggleMood} multi={true}/>
          </Sec>

          <Sec title="Körperliche Empfindungen">
            <Scale label="Krämpfe" k="cramps" emoji="😣"/>
            <Scale label="Blähungen" k="bloating" emoji="🫀"/>
            <Scale label="Brustspannen" k="breast" emoji="💗"/>
            <Scale label="Kopfschmerzen" k="headache" emoji="🤕"/>
            <Scale label="Rückenschmerzen" k="backpain" emoji="🔙"/>
            <Scale label="Energie" k="energy" emoji="⚡"/>
            <Scale label="Schlafqualität" k="sleep" emoji="😴"/>
            <Scale label="Libido" k="libido" emoji="💫"/>
          </Sec>

          <Sec title="Haut & Körper">
            <div style={{marginBottom:10}}><p style={{margin:"0 0 7px",fontSize:12,color:"#8b6d7a"}}>Allgemeines Hautbild</p><Pills opts={SKIN} val={data.skin} onSel={v=>set("skin",v)}/></div>
            <div style={{marginBottom:10}}><p style={{margin:"0 0 7px",fontSize:12,color:"#8b6d7a"}}>Akne / Unreinheiten</p><Pills opts={ACNE} val={data.acne} onSel={v=>set("acne",v)}/></div>
            <div style={{marginBottom:10}}><p style={{margin:"0 0 7px",fontSize:12,color:"#8b6d7a"}}>Hauttrockenheit</p><Pills opts={["Keine","Leicht trocken","Trocken","Sehr trocken","Schuppig"]} val={data.skinDry||""} onSel={v=>set("skinDry",v)}/></div>
            <div style={{marginBottom:10}}><p style={{margin:"0 0 7px",fontSize:12,color:"#8b6d7a"}}>Fettigkeit</p><Pills opts={["Nicht fettig","Leicht fettig","Fettig","T-Zone fettig","Sehr fettig"]} val={data.skinOil||""} onSel={v=>set("skinOil",v)}/></div>
            <div><p style={{margin:"0 0 7px",fontSize:12,color:"#8b6d7a"}}>Empfindlichkeit</p><Pills opts={["Normal","Leicht sensibel","Sensibel","Sehr sensibel","Rötungen"]} val={data.skinSens||""} onSel={v=>set("skinSens",v)}/></div>
          </Sec>

          <Sec title="Haare">
            <Pills opts={HAIR} val={data.hair} onSel={v=>set("hair",v)}/>
          </Sec>

          <Sec title="Notiz">
            <textarea value={data.notes} onChange={e=>set("notes",e.target.value)} placeholder="Wie fühlst du dich heute? Besondere Beobachtungen?…"
              style={{width:"100%",minHeight:70,padding:"10px 12px",border:"1.5px solid #fce4f0",borderRadius:12,fontSize:14,color:"#5c3d52",outline:"none",background:"#fdf7f4",resize:"vertical",boxSizing:"border-box",fontFamily:"inherit"}}/>
          </Sec>

          <button onClick={save} style={{width:"100%",padding:14,background:"linear-gradient(135deg,#f2a8cc,#e8758a)",border:"none",borderRadius:16,fontSize:15,fontWeight:700,color:"white",cursor:"pointer"}}>
            Speichern 🌸
          </button>
        </>}

        {activeTab==="analyse" && <>
          {/* Cycle length */}
          <div style={{background:"linear-gradient(135deg,#fdeef1,#fce4f0)",borderRadius:18,padding:16,marginBottom:14}}>
            <p style={{margin:"0 0 4px",fontSize:11,color:"#b07a9e",fontWeight:700,textTransform:"uppercase"}}>Durchschnittliche Zykluslänge</p>
            <p style={{margin:0,fontSize:28,fontWeight:800,color:"#5c3d52"}}>{avgCycleLen ? `${avgCycleLen} Tage` : "Noch zu wenig Daten"}</p>
            {avgCycleLen && <p style={{margin:"4px 0 0",fontSize:12,color:"#b07a9e"}}>basierend auf {last6Cycles.length} erfassten Zyklen</p>}
          </div>

          {/* Symptom averages */}
          <div style={{background:"white",borderRadius:18,padding:16,marginBottom:14,boxShadow:"0 2px 12px rgba(242,168,204,0.1)"}}>
            <p style={{margin:"0 0 12px",fontSize:13,fontWeight:700,color:"#5c3d52"}}>📊 Durchschnittliche Symptomstärke</p>
            {symptomDayCount===0 ? <p style={{color:"#c4a0b8",fontSize:13}}>Trage täglich Symptome ein um Analysen zu sehen.</p> :
              [["Krämpfe","cramps","😣","#e8758a"],["Blähungen","bloating","🫀","#f2a8cc"],["Energie","energy","⚡","#e8c97e"],["Schlaf","sleep","😴","#a8d8ea"],["Kopfschmerzen","headache","🤕","#c8b0d8"]].map(([l,k,e,c])=>(
                <div key={k} style={{marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{fontSize:13,color:"#5c3d52"}}>{e} {l}</span>
                    <span style={{fontSize:13,fontWeight:700,color:c}}>{symptomAvgs[k]}/5</span>
                  </div>
                  <div style={{background:"#fce4f0",borderRadius:99,height:7,overflow:"hidden"}}>
                    <div style={{width:`${(symptomAvgs[k]/5)*100}%`,height:"100%",background:c,borderRadius:99}}/>
                  </div>
                </div>
              ))
            }
          </div>

          {/* Top moods */}
          {topMoods.length>0 && (
            <div style={{background:"white",borderRadius:18,padding:16,marginBottom:14,boxShadow:"0 2px 12px rgba(242,168,204,0.1)"}}>
              <p style={{margin:"0 0 10px",fontSize:13,fontWeight:700,color:"#5c3d52"}}>😊 Häufigste Stimmungen</p>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {topMoods.map((m,i)=>(
                  <div key={m} style={{background:i===0?"#fce4f0":i===1?"#f3eef9":"#fdf7f4",borderRadius:12,padding:"8px 14px",textAlign:"center"}}>
                    <div style={{fontSize:15,fontWeight:700,color:i===0?"#e8758a":i===1?"#8b6db8":"#b07a9e"}}>#{i+1}</div>
                    <div style={{fontSize:12,color:"#5c3d52",marginTop:2}}>{m}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Period history */}
          <div style={{background:"white",borderRadius:18,padding:16,marginBottom:14,boxShadow:"0 2px 12px rgba(242,168,204,0.1)"}}>
            <p style={{margin:"0 0 10px",fontSize:13,fontWeight:700,color:"#5c3d52"}}>🗓️ Periodenhistorie</p>
            {periodDays.length===0 ? <p style={{color:"#c4a0b8",fontSize:13}}>Noch keine Periodeneinträge vorhanden.</p> :
              periodDays.slice(-14).reverse().map(([date,d])=>(
                <div key={date} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"1px solid #fdf7f4"}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:"#5c3d52"}}>{new Date(date+"T12:00:00").toLocaleDateString("de-DE",{weekday:"short",day:"numeric",month:"short"})}</div>
                    <div style={{fontSize:11,color:"#b07a9e"}}>{[d.period.flow,d.period.color].filter(Boolean).join(" · ")||"Periode"}</div>
                  </div>
                  <div style={{display:"flex",gap:5}}>
                    {(d.period.mood||[]).slice(0,2).map(m=><span key={m} style={{fontSize:14}}>{m.split(" ")[0]}</span>)}
                  </div>
                </div>
              ))
            }
          </div>

          {/* Insights */}
          {symptomDayCount>=5 && (
            <div style={{background:"linear-gradient(135deg,#f3eef9,#fce4f0)",borderRadius:18,padding:16,marginBottom:14}}>
              <p style={{margin:"0 0 10px",fontSize:13,fontWeight:700,color:"#5c3d52"}}>💡 Muster & Erkenntnisse</p>
              {symptomAvgs.cramps>3 && <p style={{margin:"0 0 8px",fontSize:13,color:"#5c3d52"}}>😣 Deine Krämpfe sind im Schnitt <strong>stark ({symptomAvgs.cramps}/5)</strong>. Magnesium & Wärme können helfen.</p>}
              {symptomAvgs.bloating>3 && <p style={{margin:"0 0 8px",fontSize:13,color:"#5c3d52"}}>🫀 Du hast oft <strong>starke Blähungen</strong>. Hülsenfrüchte & Kohl in der Lutealphase reduzieren.</p>}
              {symptomAvgs.energy<2.5 && <p style={{margin:"0 0 8px",fontSize:13,color:"#5c3d52"}}>⚡ Deine Energie ist im Schnitt <strong>niedrig</strong>. Eisenreiche Ernährung & Vitamin C können helfen.</p>}
              {symptomAvgs.sleep<3 && <p style={{margin:"0 0 8px",fontSize:13,color:"#5c3d52"}}>😴 Dein Schlaf ist im Schnitt <strong>schlecht</strong>. Magnesium vor dem Schlafen kann die Schlafqualität verbessern.</p>}
              {symptomAvgs.headache>2.5 && <p style={{margin:"0 0 0",fontSize:13,color:"#5c3d52"}}>🤕 Häufige <strong>Kopfschmerzen</strong> – achte auf ausreichend Wasser und vermeide Koffein kurz vor der Periode.</p>}
            </div>
          )}
        </>}
        </div>
      </div>
    </div>
  );
}

// ─── JOURNAL TAB ──────────────────────────────────────────────────────────────
function JournalTab({days,today,tdee,tP,tC,tF,tFi,phase,pi,profile}){
  const [subTab,setSubTab]=useState("summary");
  const d=days[today]||{meals:[]};
  const meals=d.meals||[];
  const tot=meals.reduce((a,m)=>({cal:a.cal+m.cal,p:a.p+m.p,c:a.c+m.c,f:a.f+m.f,fi:a.fi+(m.fi||0)}),{cal:0,p:0,c:0,f:0,fi:0});
  const inflam=meals.filter(m=>m.inflammatory).length;
  const score=inflam===0?"💚 Anti-entzündlich":inflam<=1?"🟡 Neutral":"🔴 Pro-entzündlich";

  // Build AI-style day summary
  const calPct = tdee>0?Math.round((tot.cal/tdee)*100):0;
  const pPct = tP>0?Math.round((tot.p/tP)*100):0;
  const cPct = tC>0?Math.round((tot.c/tC)*100):0;
  const fPct = tF>0?Math.round((tot.f/tF)*100):0;
  const fiPct = tFi>0?Math.round((tot.fi/tFi)*100):0;

  function buildSummary(){
    const goods=[],bads=[],tips=[];
    if(pPct>=80) goods.push("✅ Protein-Ziel fast erreicht oder übertroffen – super für Muskel & Sättigung!");
    if(pPct<50&&meals.length>2) bads.push("⚠️ Proteinzufuhr ist noch niedrig – füge Quark, Hähnchen oder Hülsenfrüchte hinzu.");
    if(fiPct>=80) goods.push("🌿 Ballaststoffziel gut erfüllt – gut für Darm & Blutzucker!");
    if(fiPct<40&&meals.length>2) bads.push("⚠️ Wenig Ballaststoffe heute – mehr Gemüse, Vollkorn oder Chiasamen wären ideal.");
    if(inflam===0&&meals.length>1) goods.push("💚 Alle Mahlzeiten anti-entzündlich – perfekt für deinen Körper & Hormonhaushalt!");
    if(inflam>=2) bads.push(`⚡ ${inflam} entzündungsfördernde Lebensmittel – versuche morgen mehr anti-entzündliche Kost.`);
    if(calPct>105) bads.push(`📊 Kalorienbudget um ${calPct-100}% überschritten – morgen leichte Mahlzeiten einplanen.`);
    if(calPct<60&&meals.length>2) tips.push("💡 Du hast noch Kalorienspielraum – eine proteinreiche Mahlzeit wäre ideal.");
    if(calPct>=90&&calPct<=105) goods.push("🎯 Kalorienbudget optimal getroffen – großartig!");
    // Phase-specific
    if(phase==="menstruation"){
      const hasIron=meals.some(m=>["Spinat","Linsen","Rind"].some(k=>m.name.includes(k)));
      if(hasIron) goods.push("🌸 Eisenreiche Mahlzeit in der Periode – genau richtig für deinen Körper jetzt!");
      else tips.push("🌸 Perioden-Tipp: Heute eisenreiche Lebensmittel einbauen – Spinat, Linsen, Kürbiskerne.");
    }
    if(phase==="luteal"){
      const hasMg=meals.some(m=>["Kürbiskern","Schokolade","Banane","Mandel"].some(k=>m.name.includes(k)));
      if(hasMg) goods.push("🌙 Magnesiumreiche Kost in der Lutealphase – hilft gegen Krämpfe & PMS!");
      else tips.push("🌙 Lutealphase-Tipp: Kürbiskerne oder dunkle Schokolade helfen gegen PMS & Heißhunger.");
    }
    if(phase==="ovulation"){
      const hasOmega=meals.some(m=>["Lachs","Omega","Walnuss","Chia","Lein"].some(k=>m.name.includes(k)));
      if(hasOmega) goods.push("☀️ Omega-3-reiche Ernährung in der Ovulation – optimal für Hormonbalance!");
    }
    if(fPct>130) bads.push("🧈 Fettanteil heute sehr hoch – morgen mehr magere Proteine bevorzugen.");
    if(cPct>130) bads.push("🍞 Kohlenhydratanteil heute hoch – auf Vollkorn & ballaststoffreiche Quellen achten.");
    return {goods,bads,tips};
  }
  const {goods,bads,tips}=buildSummary();

  // Vitamins from today's meals
  const vitMeals=meals.filter(m=>{
    const food=FOOD_DB.find(f=>f.name===m.name);
    return food?.vitNote;
  }).map(m=>({name:m.name,vit:FOOD_DB.find(f=>f.name===m.name)?.vitNote}));

  const fertInfo = getFertilityInfo(profile.lastPeriod, profile.cycleLen, days);

  return(
    <div style={{padding:"0 0 0"}}>
      {/* Sub-tabs */}
      <div style={{background:"linear-gradient(135deg,#fdeef1,#fce4f0)",padding:"24px 16px 0"}}>
        <h2 style={{fontFamily:"'Playfair Display',serif",color:"#5c3d52",margin:"0 0 14px"}}>Tagesanalyse</h2>
        <div style={{display:"flex",gap:0,borderBottom:"2px solid #fce4f0"}}>
          {[["summary","📊 Zusammenfassung"],["meals","🍽️ Mahlzeiten"],["vitamins","💊 Vitamine"],["fertility","🌸 Fruchtbarkeit"]].map(([t,l])=>(
            <button key={t} onClick={()=>setSubTab(t)}
              style={{flex:1,padding:"8px 2px",background:"none",border:"none",cursor:"pointer",fontSize:11,fontWeight:700,color:subTab===t?"#e8758a":"#b07a9e",borderBottom:subTab===t?"2px solid #e8758a":"2px solid transparent",marginBottom:-2,whiteSpace:"nowrap"}}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div style={{padding:"16px 16px 0"}}>
      {subTab==="summary"&&<>
        {/* Macro overview */}
        <Card>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <span style={{fontSize:13,fontWeight:700,color:"#5c3d52"}}>Heutige Nährwerte</span>
          </div>
          <div style={{background:"#fdf7f4",borderRadius:12,padding:"10px 12px",marginBottom:10,border:"1px solid #fce4f0"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
              <span style={{fontSize:15}}>🔥</span>
              <span style={{fontSize:13,fontWeight:700,color:"#5c3d52"}}>Entzündungsindex: {score}</span>
            </div>
            <p style={{margin:0,fontSize:12,color:"#b07a9e",lineHeight:1.5}}>Der Index zeigt, wie entzündungsfördernd deine Ernährung heute war. Er basiert auf der Anzahl der Mahlzeiten mit entzündungsfördernden Zutaten (Zucker, Weißmehl, rotes Fleisch, Alkohol, Transfette). Bei Endometriose & in der Luteal-/Menstruationsphase besonders relevant, da Entzündungen Beschwerden verstärken können.</p>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:4}}>
            {[["Kalorien",`${Math.round(tot.cal)} / ${tdee}`,"#f2a8cc",calPct],["Protein",`${Math.round(tot.p)} / ${tP}g`,"#a8d8ea",pPct],["Kohlenhydrate",`${Math.round(tot.c)} / ${tC}g`,"#e8c97e",cPct],["Fett",`${Math.round(tot.f)} / ${tF}g`,"#b5d8a8",fPct],["Ballaststoffe",`${Math.round(tot.fi)} / ${tFi}g`,"#c8b0d8",fiPct]].map(([l,v,c,pct])=>(
              <div key={l} style={{background:"#fdf7f4",borderRadius:12,padding:11}}>
                <div style={{fontSize:10,color:"#b07a9e",fontWeight:700,marginBottom:2}}>{l}</div>
                <div style={{fontSize:14,fontWeight:800,color:"#5c3d52",marginBottom:pct!=null?4:0}}>{v}</div>
                {pct!=null&&<div style={{background:"#fce4f0",borderRadius:99,height:5}}><div style={{width:`${Math.min(pct,100)}%`,height:"100%",background:c,borderRadius:99}}/></div>}
              </div>
            ))}
          </div>
        </Card>
        {/* Phase context */}
        <div style={{background:`linear-gradient(135deg,${pi.bg},#fce4f0)`,borderRadius:18,padding:14,marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
            <span style={{fontSize:18}}>{pi.emoji}</span>
            <span style={{fontSize:13,fontWeight:700,color:pi.color}}>{pi.name} – Ernährungsempfehlung</span>
          </div>
          <p style={{margin:"0 0 8px",fontSize:13,color:"#5c3d52",lineHeight:1.5}}>{pi.tip}</p>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {pi.nutrients.map(n=><span key={n} style={{background:"white",borderRadius:99,padding:"3px 10px",fontSize:11,color:pi.color,fontWeight:600}}>+ {n}</span>)}
          </div>
        </div>
        {/* AI Summary */}
        {meals.length===0?<Card><p style={{margin:0,color:"#c4a0b8",fontSize:14,textAlign:"center"}}>Noch keine Mahlzeiten eingetragen.</p></Card>:<>
          {goods.length>0&&<Card style={{borderLeft:"4px solid #6db87a"}}>
            <p style={{margin:"0 0 10px",fontSize:13,fontWeight:700,color:"#3a7a4a"}}>🌟 Das läuft heute super!</p>
            {goods.map((g,i)=><p key={i} style={{margin:"0 0 6px",fontSize:13,color:"#5c3d52",lineHeight:1.4}}>{g}</p>)}
          </Card>}
          {bads.length>0&&<Card style={{borderLeft:"4px solid #e8758a"}}>
            <p style={{margin:"0 0 10px",fontSize:13,fontWeight:700,color:"#c0392b"}}>📌 Das könnte besser sein</p>
            {bads.map((b,i)=><p key={i} style={{margin:"0 0 6px",fontSize:13,color:"#5c3d52",lineHeight:1.4}}>{b}</p>)}
          </Card>}
          {tips.length>0&&<Card style={{borderLeft:"4px solid #e8c97e"}}>
            <p style={{margin:"0 0 10px",fontSize:13,fontWeight:700,color:"#8b6000"}}>💡 Tipps für heute</p>
            {tips.map((t,i)=><p key={i} style={{margin:"0 0 6px",fontSize:13,color:"#5c3d52",lineHeight:1.4}}>{t}</p>)}
          </Card>}
          {goods.length===0&&bads.length===0&&<Card><p style={{margin:0,fontSize:13,color:"#b07a9e",textAlign:"center"}}>Trage mehr Mahlzeiten ein für deine persönliche Zusammenfassung!</p></Card>}
        </>}
      </>}

      {subTab==="meals"&&<>
        <Card>
          <h3 style={{margin:"0 0 10px",color:"#5c3d52",fontSize:15}}>Alle Mahlzeiten heute</h3>
          {meals.length===0?<p style={{color:"#c4a0b8",fontSize:14}}>Noch keine Einträge.</p>:
            meals.map(m=>(
              <div key={m.id} style={{padding:"9px 0",borderBottom:"1px solid #fdf7f4"}}>
                <div style={{display:"flex",justifyContent:"space-between"}}>
                  <span style={{fontSize:13,fontWeight:700,color:"#5c3d52"}}>{m.name}</span>
                  <span style={{fontSize:13,fontWeight:700,color:"#f2a8cc"}}>{m.cal} kcal</span>
                </div>
                <div style={{fontSize:11,color:"#b07a9e"}}>{m.qty}{m.unit==="Stück"?" Stück":m.unit==="ml"?"ml":"g"} · P{m.p}g · K{m.c}g · F{m.f}g · Bal.{m.fi}g</div>
                {m.inflammatory&&<span style={{background:"#fdeef1",borderRadius:99,padding:"2px 8px",fontSize:10,color:"#e8758a",fontWeight:700}}>⚡ entzündungsfördernd</span>}
              </div>
            ))
          }
        </Card>
      </>}

      {subTab==="vitamins"&&<>
        <Card>
          <h3 style={{margin:"0 0 4px",color:"#5c3d52",fontSize:15}}>💊 Vitamine & Mikronährstoffe heute</h3>
          <p style={{margin:"0 0 14px",fontSize:12,color:"#b07a9e"}}>Basierend auf deinen heutigen Mahlzeiten:</p>
          {vitMeals.length===0?<p style={{color:"#c4a0b8",fontSize:13}}>Noch keine vitaminreichen Lebensmittel eingetragen. Füge Spinat, Lachs, Eier oder Beeren hinzu!</p>:
            vitMeals.map((vm,i)=>(
              <div key={i} style={{padding:"10px 0",borderBottom:"1px solid #fdf7f4"}}>
                <div style={{fontSize:13,fontWeight:700,color:"#5c3d52",marginBottom:4}}>{vm.name}</div>
                <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                  {vm.vit.split(",").map(v=><span key={v} style={{background:"#f3eef9",borderRadius:99,padding:"3px 9px",fontSize:11,color:"#8b6db8",fontWeight:600}}>{v.trim()}</span>)}
                </div>
              </div>
            ))
          }
        </Card>
        <Card>
          <p style={{margin:"0 0 10px",fontSize:13,fontWeight:700,color:"#5c3d52"}}>🌸 Mikronährstoffe für {pi.name}</p>
          <p style={{margin:"0 0 10px",fontSize:13,color:"#5c3d52"}}>In deiner aktuellen Zyklusphase besonders wichtig:</p>
          {pi.nutrients.map(n=>(
            <div key={n} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:"1px solid #fdf7f4"}}>
              <div style={{width:8,height:8,borderRadius:99,background:pi.color,flexShrink:0}}/>
              <span style={{fontSize:13,fontWeight:600,color:"#5c3d52"}}>{n}</span>
            </div>
          ))}
        </Card>
      </>}

      {subTab==="fertility"&&<>
        {/* Fertile window */}
        <div style={{background:fertInfo.isFertile?"linear-gradient(135deg,#edf7ef,#d4f0d9)":"linear-gradient(135deg,#fdeef1,#fce4f0)",borderRadius:18,padding:18,marginBottom:14,border:`2px solid ${fertInfo.isFertile?"#6db87a":"#f2a8cc"}`}}>
          <div style={{fontSize:32,marginBottom:8}}>{fertInfo.isPeakFertile?"🥚":fertInfo.isFertile?"🌱":"🌙"}</div>
          <p style={{margin:"0 0 4px",fontSize:11,color:fertInfo.isFertile?"#3a7a4a":"#b07a9e",fontWeight:700,textTransform:"uppercase"}}>Fruchtbarkeitsstatus heute</p>
          {fertInfo.isPeakFertile&&<p style={{margin:"0 0 6px",fontSize:20,fontWeight:800,color:"#3a7a4a"}}>🥚 Höchste Fruchtbarkeit – Eisprung jetzt!</p>}
          {fertInfo.isFertile&&!fertInfo.isPeakFertile&&<p style={{margin:"0 0 6px",fontSize:20,fontWeight:800,color:"#3a7a4a"}}>🌱 Fruchtbares Fenster aktiv</p>}
          {!fertInfo.isFertile&&<p style={{margin:"0 0 6px",fontSize:20,fontWeight:800,color:"#5c3d52"}}>Nicht fruchtbar</p>}
          <p style={{margin:"0 0 4px",fontSize:13,color:"#5c3d52"}}>Zyklustag <strong>{fertInfo.dayOfCycle+1}</strong> von {fertInfo.cycleLen}</p>
          {!fertInfo.isFertile&&fertInfo.daysUntilFertile!=null&&<p style={{margin:0,fontSize:13,color:"#b07a9e"}}>Fruchtbares Fenster beginnt in <strong>{fertInfo.daysUntilFertile} Tagen</strong></p>}
          {fertInfo.isFertile&&<p style={{margin:0,fontSize:13,color:"#3a7a4a"}}>Eisprung erwartet in <strong>{fertInfo.daysUntilOvulation} Tag{fertInfo.daysUntilOvulation===1?"":"en"}</strong></p>}
        </div>
        {/* Cycle calendar mini */}
        <Card>
          <h3 style={{margin:"0 0 12px",color:"#5c3d52",fontSize:14}}>📅 Zyklusübersicht</h3>
          <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
            {Array.from({length:fertInfo.cycleLen},((_,i)=>{
              const isToday=i===fertInfo.dayOfCycle;
              const isFertileDay=i>=fertInfo.fertileStart&&i<=fertInfo.fertileEnd;
              const isPeak=i===fertInfo.ovulationDay||i===fertInfo.ovulationDay-1;
              const isPeriodDay=i<5;
              const bg=isToday?"#5c3d52":isPeak?"#e8c97e":isFertileDay?"#b5d8a8":isPeriodDay?"#fdeef1":"#fdf7f4";
              const color=isToday?"white":isPeak?"#5c3d52":isFertileDay?"#2d6b3a":isPeriodDay?"#e8758a":"#b07a9e";
              return(
                <div key={i} style={{width:28,height:28,borderRadius:99,background:bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:isToday?800:500,color,border:isToday?"2px solid #5c3d52":"1.5px solid transparent"}}>
                  {i+1}
                </div>
              );
            }))}
          </div>
          <div style={{display:"flex",gap:12,marginTop:12,flexWrap:"wrap"}}>
            {[["#fdeef1","#e8758a","Periode"],["#b5d8a8","#2d6b3a","Fruchtbar"],["#e8c97e","#5c3d52","Eisprung"],["#5c3d52","white","Heute"]].map(([bg,c,l])=>(
              <div key={l} style={{display:"flex",alignItems:"center",gap:5}}>
                <div style={{width:12,height:12,borderRadius:99,background:bg,border:`1px solid ${c}`}}/>
                <span style={{fontSize:11,color:"#b07a9e"}}>{l}</span>
              </div>
            ))}
          </div>
        </Card>
        {/* Phase timeline */}
        <Card>
          <h3 style={{margin:"0 0 12px",color:"#5c3d52",fontSize:14}}>🔮 Nächste Phasen</h3>
          {[
            {ph:"Menstruation",day:0,len:5,color:"#e8758a",emoji:"🌸"},
            {ph:"Follikelphase",day:5,len:8,color:"#6db87a",emoji:"🌿"},
            {ph:"Fruchtbares Fenster",day:fertInfo.fertileStart,len:7,color:"#a8d8ea",emoji:"🌱"},
            {ph:"Eisprung",day:fertInfo.ovulationDay,len:2,color:"#e8c97e",emoji:"🥚"},
            {ph:"Lutealphase",day:16,len:fertInfo.cycleLen-16,color:"#8b6db8",emoji:"🌙"},
          ].map(({ph,day,len,color,emoji})=>{
            const isCurrentPhase=(fertInfo.dayOfCycle>=day&&fertInfo.dayOfCycle<day+len);
            const daysUntil=fertInfo.dayOfCycle<day?day-fertInfo.dayOfCycle:fertInfo.dayOfCycle>=day+len?(fertInfo.cycleLen-fertInfo.dayOfCycle)+day:0;
            return(
              <div key={ph} style={{display:"flex",alignItems:"center",gap:12,padding:"8px 0",borderBottom:"1px solid #fdf7f4",background:isCurrentPhase?"#fdf7f4":"transparent",borderRadius:8,paddingLeft:isCurrentPhase?8:0}}>
                <span style={{fontSize:20}}>{emoji}</span>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontSize:13,fontWeight:700,color:isCurrentPhase?color:"#5c3d52"}}>{ph}</span>
                    {isCurrentPhase&&<span style={{background:color,color:"white",fontSize:9,padding:"2px 6px",borderRadius:99,fontWeight:700}}>JETZT</span>}
                  </div>
                  <span style={{fontSize:11,color:"#b07a9e"}}>{isCurrentPhase?`Noch ${day+len-fertInfo.dayOfCycle} Tage`:`In ${daysUntil} Tagen`}</span>
                </div>
              </div>
            );
          })}
        </Card>
      </>}
      </div>
    </div>
  );
}

// ─── PROGRESS TAB ─────────────────────────────────────────────────────────────
function ProgressTab({days,profile,tdee}){
  const wh=Object.entries(days).filter(([,d])=>d.morningWeight).sort(([a],[b])=>a.localeCompare(b)).slice(-14).map(([date,d])=>({date,w:Number(d.morningWeight)}));
  const maxW=wh.length?Math.max(...wh.map(d=>d.w))+2:80,minW=wh.length?Math.min(...wh.map(d=>d.w))-2:60;
  const H=140,W=340,pad=28;
  const pts=wh.map((d,i)=>({x:pad+(i/Math.max(wh.length-1,1))*(W-pad*2),y:H-pad-((d.w-minW)/(maxW-minW||1))*(H-pad*2),w:d.w}));
  const path=pts.length>1?pts.map((p,i)=>`${i===0?"M":"L"} ${p.x} ${p.y}`).join(" "):"";
  const allK=Object.values(days).map(d=>(d.meals||[]).reduce((s,m)=>s+m.cal,0)).filter(Boolean);
  const avgK=allK.length?Math.round(allK.reduce((a,b)=>a+b,0)/allK.length):0;
  const diff=profile.goalWeight&&profile.weight?Number(profile.weight)-Number(profile.goalWeight):0;
  const wkly=tdee>0&&avgK>0?(tdee-avgK)*7/7700:0;
  const weeks=wkly>0&&diff>0?Math.ceil(diff/wkly):null;
  return(
    <div style={{padding:"24px 16px 0"}}>
      <h2 style={{fontFamily:"'Playfair Display',serif",color:"#5c3d52",marginBottom:14}}>Verlauf</h2>
      {weeks&&<div style={{background:"linear-gradient(135deg,#f9d4e8,#fce4f0)",borderRadius:18,padding:16,marginBottom:12}}>
        <p style={{margin:0,fontSize:12,color:"#b07a9e",fontWeight:600}}>🎯 Ziel-Prognose</p>
        <p style={{margin:"5px 0 0",fontSize:20,fontWeight:800,color:"#5c3d52"}}>~{weeks} Wochen bis {profile.goalWeight} kg</p>
        <p style={{margin:"3px 0 0",fontSize:12,color:"#b07a9e"}}>bei Ø {avgK} kcal/Tag</p>
      </div>}
      <Card>
        <h3 style={{margin:"0 0 12px",color:"#5c3d52",fontSize:14}}>Gewichtsverlauf</h3>
        {wh.length<2?<p style={{color:"#c4a0b8",fontSize:13}}>Trage täglich dein Gewicht ein, um den Verlauf zu sehen.</p>:(
          <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto"}}>
            <defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f2a8cc" stopOpacity="0.3"/><stop offset="100%" stopColor="#f2a8cc" stopOpacity="0"/></linearGradient></defs>
            {pts.length>1&&<path d={path+` L ${pts[pts.length-1].x} ${H} L ${pts[0].x} ${H} Z`} fill="url(#lg)"/>}
            {pts.length>1&&<path d={path} fill="none" stroke="#f2a8cc" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>}
            {pts.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r={4} fill="white" stroke="#f2a8cc" strokeWidth="2"/>)}
            {profile.goalWeight&&Number(profile.goalWeight)>=minW&&Number(profile.goalWeight)<=maxW&&(()=>{const gY=H-pad-((Number(profile.goalWeight)-minW)/(maxW-minW||1))*(H-pad*2);return<line x1={pad} y1={gY} x2={W-pad} y2={gY} stroke="#e8c97e" strokeWidth="1.5" strokeDasharray="5 4"/>;})()}
          </svg>
        )}
      </Card>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        {[["Aktuell",`${profile.weight} kg`],["Ziel",`${profile.goalWeight} kg`],["Ø kcal/Tag",`${avgK}`],["Tage erfasst",Object.keys(days).length]].map(([l,v])=>(
          <div key={l} style={{background:"white",borderRadius:14,padding:14,boxShadow:"0 2px 10px rgba(242,168,204,0.1)"}}>
            <div style={{fontSize:11,color:"#b07a9e",fontWeight:700}}>{l}</div>
            <div style={{fontSize:20,fontWeight:800,color:"#5c3d52",marginTop:3}}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── CALENDAR TAB ─────────────────────────────────────────────────────────────
function CalendarTab({days,phase,updateDay,profile,recipes,customFoods,tdee,tP,tC,tF,tFi}){
  const [calDate,setCalDate]=useState(getToday());
  const [editMode,setEditMode]=useState(null); // null | "meals" | "period" | "weight" | "water"
  const [pastMealCat,setPastMealCat]=useState("Frühstück");
  const [pastAddOpen,setPastAddOpen]=useState(false);
  const [pastPeriodOpen,setPastPeriodOpen]=useState(false);
  const [pastWeightIn,setPastWeightIn]=useState({morning:"",evening:""});
  const [pastWaterIn,setPastWaterIn]=useState("");
  const [toast,setToast]=useState(null);

  const today=getToday();
  const d=new Date(calDate+"T00:00:00");
  const year=d.getFullYear(),month=d.getMonth();
  const firstDay=new Date(year,month,1).getDay();
  const dim=new Date(year,month+1,0).getDate();
  const isPast=calDate<today;
  const isToday=calDate===today;

  const cells=[];
  for(let i=0;i<(firstDay||7)-1;i++) cells.push(null);
  for(let i=1;i<=dim;i++) cells.push(i);

  const key=n=>`${year}-${String(month+1).padStart(2,"0")}-${String(n).padStart(2,"0")}`;
  const dot=n=>{const dd=days[key(n)];if(!dd)return null;const k=(dd.meals||[]).reduce((s,m)=>s+m.cal,0);if(!k)return null;return k<1600?"#6db87a":k<2100?"#e8c97e":"#e8758a";};
  const hasPeriod=n=>{const dd=days[key(n)];return dd?.period?.isPeriod||dd?.period?.flow;};

  const sel=days[calDate]||{meals:[],morningWeight:"",eveningWeight:"",period:null,water:0};
  const selMeals=sel?.meals||[];
  const selTot=selMeals.reduce((a,m)=>({cal:a.cal+m.cal,p:a.p+m.p,c:a.c+m.c,f:a.f+m.f,fi:a.fi+(m.fi||0)}),{cal:0,p:0,c:0,f:0,fi:0});

  function showToast(msg){setToast(msg);setTimeout(()=>setToast(null),3000);}

  function selectDay(n){
    const dk=key(n);
    setCalDate(dk);
    setEditMode(null);
    // Pre-fill weight inputs from existing data
    const dd=days[dk];
    setPastWeightIn({morning:dd?.morningWeight||"",evening:dd?.eveningWeight||""});
    setPastWaterIn(dd?.water||"");
  }

  function removePastMeal(id){
    updateDay(calDate,{meals:selMeals.filter(m=>m.id!==id)});
    showToast("Mahlzeit gelöscht");
  }

  function savePastWeight(){
    if(pastWeightIn.morning||pastWeightIn.evening){
      updateDay(calDate,{
        morningWeight:pastWeightIn.morning||sel.morningWeight||"",
        eveningWeight:pastWeightIn.evening||sel.eveningWeight||""
      });
      showToast("✓ Gewicht gespeichert");
      setEditMode(null);
    }
  }

  function savePastWater(){
    const ml=Number(pastWaterIn);
    if(ml>0){
      updateDay(calDate,{water:(sel.water||0)+ml});
      setPastWaterIn("");
      showToast(`✓ +${ml}ml Wasser hinzugefügt`);
    }
  }

  return(
    <div style={{padding:"0 0 0"}}>
      {/* Toast */}
      {toast&&<div style={{position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",zIndex:9999,background:"white",borderLeft:"4px solid #6db87a",borderRadius:14,padding:"10px 16px",boxShadow:"0 8px 24px rgba(0,0,0,0.12)",fontSize:13,color:"#5c3d52",fontWeight:600,whiteSpace:"nowrap"}}>{toast}</div>}

      {/* Header */}
      <div style={{background:"linear-gradient(135deg,#fdeef1,#fce4f0)",padding:"24px 16px 16px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <h2 style={{fontFamily:"'Playfair Display',serif",color:"#5c3d52",margin:0}}>Tagebuch</h2>
          <div style={{display:"flex",gap:4,alignItems:"center"}}>
            <button onClick={()=>{const d2=new Date(year,month-1,1);setCalDate(`${d2.getFullYear()}-${String(d2.getMonth()+1).padStart(2,"0")}-01`);}}
              style={{background:"white",border:"none",borderRadius:99,width:30,height:30,cursor:"pointer",color:"#e8758a",fontWeight:700,fontSize:16,boxShadow:"0 1px 4px rgba(242,168,204,0.2)"}}>‹</button>
            <span style={{fontSize:13,color:"#5c3d52",fontWeight:600,padding:"0 6px"}}>{d.toLocaleDateString("de-DE",{month:"long",year:"numeric"})}</span>
            <button onClick={()=>{const d2=new Date(year,month+1,1);setCalDate(`${d2.getFullYear()}-${String(d2.getMonth()+1).padStart(2,"0")}-01`);}}
              style={{background:"white",border:"none",borderRadius:99,width:30,height:30,cursor:"pointer",color:"#e8758a",fontWeight:700,fontSize:16,boxShadow:"0 1px 4px rgba(242,168,204,0.2)"}}>›</button>
          </div>
        </div>
        {/* Calendar grid */}
        <div style={{background:"white",borderRadius:18,padding:"12px 10px",boxShadow:"0 2px 12px rgba(242,168,204,0.12)"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:6}}>
            {["Mo","Di","Mi","Do","Fr","Sa","So"].map(x=><div key={x} style={{textAlign:"center",fontSize:10,color:"#b07a9e",fontWeight:700,padding:"3px 0"}}>{x}</div>)}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
            {cells.map((n,i)=>{
              const dk=n?key(n):null;
              const isSelected=dk===calDate;
              const isTodays=dk===today;
              const isFuture=dk>today;
              return(
                <button key={i} onClick={()=>n&&!isFuture&&selectDay(n)}
                  style={{aspectRatio:1,borderRadius:10,border:isSelected?"2px solid #e8758a":isTodays?"2px solid #f2a8cc":"2px solid transparent",background:n?isSelected?"#fdeef1":"white":"transparent",cursor:n&&!isFuture?"pointer":"default",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",opacity:isFuture?0.3:1}}>
                  {n&&<>
                    <span style={{fontSize:12,fontWeight:isSelected||isTodays?800:500,color:isSelected?"#e8758a":isTodays?"#f2a8cc":"#5c3d52"}}>{n}</span>
                    <div style={{display:"flex",gap:2,marginTop:1}}>
                      {dot(n)&&<div style={{width:4,height:4,borderRadius:99,background:dot(n)}}/>}
                      {hasPeriod(n)&&<div style={{width:4,height:4,borderRadius:99,background:"#e8758a"}}/>}
                    </div>
                  </>}
                </button>
              );
            })}
          </div>
          <div style={{display:"flex",gap:10,marginTop:10,flexWrap:"wrap"}}>
            {[["#6db87a","Ziel erreicht"],["#e8c97e","Knapp"],["#e8758a","Über Ziel / Periode"]].map(([c,l])=>(
              <div key={l} style={{display:"flex",alignItems:"center",gap:5}}>
                <div style={{width:7,height:7,borderRadius:99,background:c}}/>
                <span style={{fontSize:10,color:"#b07a9e"}}>{l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{padding:"14px 16px 0"}}>
        {/* Selected day header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div>
            <h3 style={{fontFamily:"'Playfair Display',serif",margin:0,fontSize:17,color:"#5c3d52"}}>
              {new Date(calDate+"T12:00:00").toLocaleDateString("de-DE",{weekday:"long",day:"numeric",month:"long"})}
            </h3>
            {isToday&&<span style={{fontSize:11,color:"#6db87a",fontWeight:700}}>● Heute</span>}
            {isPast&&<span style={{fontSize:11,color:"#b07a9e",fontWeight:600}}>Vergangener Tag – du kannst Einträge bearbeiten</span>}
          </div>
        </div>

        {/* Quick action buttons for past/today */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
          <button onClick={()=>setEditMode(editMode==="meals"?null:"meals")}
            style={{padding:"10px 8px",background:editMode==="meals"?"#fce4f0":"white",border:`1.5px solid ${editMode==="meals"?"#f2a8cc":"#fce4f0"}`,borderRadius:14,fontSize:13,fontWeight:600,color:editMode==="meals"?"#e8758a":"#5c3d52",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
            🍽️ {editMode==="meals"?"Schließen":"Mahlzeit eintragen"}
          </button>
          <button onClick={()=>setEditMode(editMode==="period"?null:"period")}
            style={{padding:"10px 8px",background:editMode==="period"?"#fdeef1":"white",border:`1.5px solid ${editMode==="period"?"#f2a8cc":"#fce4f0"}`,borderRadius:14,fontSize:13,fontWeight:600,color:editMode==="period"?"#e8758a":"#5c3d52",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
            🌸 {editMode==="period"?"Schließen":"Periode tracken"}
          </button>
          <button onClick={()=>setEditMode(editMode==="weight"?null:"weight")}
            style={{padding:"10px 8px",background:editMode==="weight"?"#f3eef9":"white",border:`1.5px solid ${editMode==="weight"?"#8b6db8":"#fce4f0"}`,borderRadius:14,fontSize:13,fontWeight:600,color:editMode==="weight"?"#8b6db8":"#5c3d52",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
            ⚖️ {editMode==="weight"?"Schließen":"Gewicht eintragen"}
          </button>
          <button onClick={()=>setEditMode(editMode==="water"?null:"water")}
            style={{padding:"10px 8px",background:editMode==="water"?"#f0f9fc":"white",border:`1.5px solid ${editMode==="water"?"#a8d8ea":"#fce4f0"}`,borderRadius:14,fontSize:13,fontWeight:600,color:editMode==="water"?"#5c8a9e":"#5c3d52",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
            💧 {editMode==="water"?"Schließen":"Wasser eintragen"}
          </button>
        </div>

        {/* ── EDIT: MEALS ── */}
        {editMode==="meals"&&(
          <Card style={{border:"1.5px solid #f2a8cc"}}>
            <p style={{margin:"0 0 10px",fontSize:13,fontWeight:700,color:"#5c3d52"}}>🍽️ Mahlzeit für diesen Tag eintragen</p>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
              {["Frühstück","Mittagessen","Abendessen","Snacks"].map(g=>(
                <button key={g} onClick={()=>setPastMealCat(g)}
                  style={{padding:"5px 12px",borderRadius:99,border:"1.5px solid",borderColor:pastMealCat===g?"#f2a8cc":"#fce4f0",background:pastMealCat===g?"#fce4f0":"white",color:pastMealCat===g?"#8b2252":"#b07a9e",fontSize:12,fontWeight:600,cursor:"pointer"}}>
                  {g}
                </button>
              ))}
            </div>
            <PastAddMealInline
              date={calDate}
              mealCat={pastMealCat}
              selMeals={selMeals}
              updateDay={updateDay}
              recipes={recipes}
              customFoods={customFoods}
              profile={profile}
              onToast={showToast}
            />
          </Card>
        )}

        {/* ── EDIT: PERIOD ── */}
        {editMode==="period"&&(
          <div style={{marginBottom:12}}>
            <PeriodTracker
              onClose={()=>setEditMode(null)}
              todayD={sel}
              updateDay={updateDay}
              today={calDate}
              days={days}
              inline={true}
              dateLabel={new Date(calDate+"T12:00:00").toLocaleDateString("de-DE",{weekday:"long",day:"numeric",month:"long"})}
            />
          </div>
        )}

        {/* ── EDIT: WEIGHT ── */}
        {editMode==="weight"&&(
          <Card style={{border:"1.5px solid #8b6db8"}}>
            <p style={{margin:"0 0 12px",fontSize:13,fontWeight:700,color:"#5c3d52"}}>⚖️ Gewicht für diesen Tag</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
              {[["🌅 Nüchterngewicht","morning"],["🌙 Abendgewicht","evening"]].map(([lb,k])=>(
                <div key={k}>
                  <label style={{fontSize:11,color:"#b07a9e",fontWeight:600}}>{lb}</label>
                  <input type="number" step="0.1" placeholder={sel[k+"Weight"]||"kg"} value={pastWeightIn[k]}
                    onChange={e=>setPastWeightIn(p=>({...p,[k]:e.target.value}))}
                    style={{display:"block",width:"100%",marginTop:4,padding:"9px 10px",border:"1.5px solid #fce4f0",borderRadius:10,fontSize:14,color:"#5c3d52",outline:"none",background:"#fdf7f4",boxSizing:"border-box"}}/>
                </div>
              ))}
            </div>
            {(sel.morningWeight||sel.eveningWeight)&&(
              <p style={{margin:"0 0 10px",fontSize:12,color:"#b07a9e"}}>
                Gespeichert: {sel.morningWeight&&`🌅 ${sel.morningWeight}kg`} {sel.eveningWeight&&`🌙 ${sel.eveningWeight}kg`}
              </p>
            )}
            <PinkBtn onClick={savePastWeight}>Gewicht speichern ✓</PinkBtn>
          </Card>
        )}

        {/* ── EDIT: WATER ── */}
        {editMode==="water"&&(
          <Card style={{border:"1.5px solid #a8d8ea"}}>
            <p style={{margin:"0 0 10px",fontSize:13,fontWeight:700,color:"#5c3d52"}}>💧 Wasser für diesen Tag</p>
            {sel.water>0&&<p style={{margin:"0 0 10px",fontSize:13,color:"#b07a9e"}}>Bereits eingetragen: <strong>{sel.water}ml</strong></p>}
            <div style={{display:"flex",gap:8,marginBottom:10}}>
              {[200,330,500].map(ml=>(
                <button key={ml} onClick={()=>{updateDay(calDate,{water:(sel.water||0)+ml});showToast(`✓ +${ml}ml hinzugefügt`);}}
                  style={{flex:1,padding:"9px",background:"#f0f9fc",border:"1.5px solid #a8d8ea",borderRadius:10,fontSize:13,fontWeight:600,color:"#5c8a9e",cursor:"pointer"}}>+{ml}ml</button>
              ))}
            </div>
            <div style={{display:"flex",gap:8}}>
              <input type="number" value={pastWaterIn} onChange={e=>setPastWaterIn(e.target.value)} placeholder="Eigene Menge in ml"
                style={{flex:1,padding:"9px 12px",border:"1.5px solid #fce4f0",borderRadius:10,fontSize:14,color:"#5c3d52",outline:"none",background:"#fdf7f4"}}/>
              <button onClick={savePastWater}
                style={{padding:"9px 16px",background:"linear-gradient(135deg,#a8d8ea,#5c8a9e)",border:"none",borderRadius:10,fontSize:13,fontWeight:700,color:"white",cursor:"pointer"}}>+</button>
            </div>
          </Card>
        )}

        {/* ── DAY SUMMARY ── */}
        <Card>
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:6,marginBottom:10}}>
            {[["kcal",Math.round(selTot.cal),"#f2a8cc"],["P",Math.round(selTot.p)+"g","#a8d8ea"],["K",Math.round(selTot.c)+"g","#e8c97e"],["F",Math.round(selTot.f)+"g","#b5d8a8"],["Bal",Math.round(selTot.fi)+"g","#c8b0d8"]].map(([l,v,c])=>(
              <div key={l} style={{textAlign:"center",background:"#fdf7f4",borderRadius:10,padding:"7px 3px"}}>
                <div style={{fontSize:13,fontWeight:700,color:"#5c3d52"}}>{v}</div>
                <div style={{fontSize:10,color:"#b07a9e"}}>{l}</div>
              </div>
            ))}
          </div>
          {sel.morningWeight&&<p style={{margin:"0 0 3px",fontSize:12,color:"#5c3d52"}}>🌅 Nüchterngewicht: <strong>{sel.morningWeight} kg</strong></p>}
          {sel.eveningWeight&&<p style={{margin:"0 0 4px",fontSize:12,color:"#5c3d52"}}>🌙 Abendgewicht: <strong>{sel.eveningWeight} kg</strong></p>}
          {sel.water>0&&<p style={{margin:"0 0 6px",fontSize:12,color:"#5c3d52"}}>💧 Wasser: <strong>{sel.water}ml</strong></p>}
          {sel.period&&(sel.period.isPeriod||sel.period.flow)&&(
            <div style={{background:"#fdeef1",borderRadius:10,padding:"8px 12px",marginBottom:8}}>
              <p style={{margin:"0 0 3px",fontSize:12,fontWeight:700,color:"#e8758a"}}>🌸 Periode</p>
              <p style={{margin:0,fontSize:12,color:"#5c3d52"}}>{[sel.period.flow,sel.period.color,sel.period.consistency].filter(Boolean).join(" · ")||"Eingetragen"}</p>
              {sel.period.mood?.length>0&&<p style={{margin:"3px 0 0",fontSize:11,color:"#8b6db8"}}>{sel.period.mood.join(" · ")}</p>}
            </div>
          )}
          {selMeals.length===0?(
            <p style={{margin:"8px 0 0",fontSize:12,color:"#c4a0b8",fontStyle:"italic"}}>Noch keine Mahlzeiten für diesen Tag</p>
          ):(
            selMeals.map(m=>(
              <div key={m.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderTop:"1px solid #fdf7f4"}}>
                <div style={{flex:1}}>
                  <span style={{fontSize:13,fontWeight:600,color:"#5c3d52"}}>{m.name}</span>
                  <span style={{fontSize:11,color:"#b07a9e",marginLeft:6}}>{m.cal} kcal · {m.cat}</span>
                </div>
                <button onClick={()=>removePastMeal(m.id)}
                  style={{background:"none",border:"none",cursor:"pointer",color:"#e8758a",fontSize:14,padding:"0 2px",opacity:0.7}}>🗑</button>
              </div>
            ))
          )}
        </Card>
      </div>

      {/* Past meal add modal */}
      {pastAddOpen&&(
        <AddMealModal
          meals={selMeals}
          mealCat={pastMealCat}
          setMealCat={setPastMealCat}
          doAddMeal={(food,amount)=>{
            const isPiece=food.unit==="Stück";
            const f=isPiece?amount:amount/100;
            const entry={id:Date.now(),name:food.name,qty:amount,unit:food.unit,cat:pastMealCat,
              cal:Math.round(food.cal*f),p:Math.round(food.p*f*100)/100,c:Math.round(food.c*f*100)/100,
              f:Math.round(food.f*f*100)/100,fi:Math.round((food.fi||0)*f*100)/100,
              inflammatory:food.inflammatory,endo_ok:food.endo_ok};
            updateDay(calDate,{meals:[...selMeals,entry]});
            setPastAddOpen(false);
            showToast(`✓ ${food.name} für ${new Date(calDate+"T12:00:00").toLocaleDateString("de-DE",{day:"numeric",month:"short"})} hinzugefügt`);
          }}
          recipes={recipes}
          setRecipeOpen={()=>{}}
          setEditRecipe={()=>{}}
          setAddOpen={setPastAddOpen}
          setCamOpen={()=>{}}
          setCustomOpen={()=>{}}
          profile={profile}
          phase={phase}
          pi={PHASE_INFO[phase]}
          updateDay={updateDay}
          today={calDate}
          toast={(m,c)=>showToast(m)}
          customFoods={customFoods}
        />
      )}
    </div>
  );
}

// ─── PAST ADD MEAL INLINE (compact food search for calendar) ─────────────────
function PastAddMealInline({date,mealCat,selMeals,updateDay,recipes,customFoods,profile,onToast}){
  const [q,setQ]=useState("");
  const [sel,setSel]=useState(null);
  const [qty,setQty]=useState(100);
  const allFoods=[...FOOD_DB,...(customFoods||[])];
  const filtered=allFoods.filter(f=>f.name.toLowerCase().includes(q.toLowerCase())&&q.length>1).slice(0,10);

  function addIt(food,amount){
    const isPiece=food.unit==="Stück";
    const f=isPiece?amount:amount/100;
    const entry={id:Date.now(),name:food.name,qty:amount,unit:food.unit,cat:mealCat,
      cal:Math.round(food.cal*f),p:Math.round(food.p*f*100)/100,c:Math.round(food.c*f*100)/100,
      f:Math.round(food.f*f*100)/100,fi:Math.round((food.fi||0)*f*100)/100,
      inflammatory:food.inflammatory,endo_ok:food.endo_ok};
    updateDay(date,{meals:[...selMeals,entry]});
    setSel(null);setQ("");setQty(100);
    onToast(`✓ ${food.name} hinzugefügt`);
  }

  return(
    <div>
      <input value={q} onChange={e=>{setQ(e.target.value);setSel(null);}} placeholder="Lebensmittel suchen…"
        style={{width:"100%",padding:"9px 12px",border:"1.5px solid #fce4f0",borderRadius:12,fontSize:14,color:"#5c3d52",outline:"none",background:"#fdf7f4",boxSizing:"border-box",marginBottom:8}}/>
      {/* Quick recipes */}
      {q.length===0&&recipes.length>0&&(
        <div style={{display:"flex",gap:7,overflowX:"auto",paddingBottom:6,marginBottom:8}}>
          {recipes.map(r=>(
            <button key={r.id} onClick={()=>{updateDay(date,{meals:[...selMeals,{...r,id:Date.now(),cat:mealCat,unit:"g",inflammatory:false,endo_ok:true}]});onToast(`✓ ${r.name} hinzugefügt`);}}
              style={{flexShrink:0,background:"#fdf7f4",border:"1.5px solid #fce4f0",borderRadius:10,padding:"6px 12px",cursor:"pointer"}}>
              <div style={{fontSize:11,fontWeight:700,color:"#5c3d52"}}>🍽️ {r.name}</div>
              <div style={{fontSize:10,color:"#b07a9e"}}>{r.cal} kcal</div>
            </button>
          ))}
        </div>
      )}
      {filtered.length>0&&!sel&&(
        <div style={{border:"1px solid #fce4f0",borderRadius:12,overflow:"hidden",maxHeight:200,overflowY:"auto",marginBottom:8}}>
          {filtered.map((f,i)=>(
            <button key={f.id||i} onClick={()=>{setSel(f);setQty(f.unit==="Stück"?1:100);}}
              style={{display:"flex",justifyContent:"space-between",width:"100%",padding:"9px 12px",background:"white",border:"none",borderBottom:i<filtered.length-1?"1px solid #fdf7f4":"none",cursor:"pointer",textAlign:"left",alignItems:"center"}}>
              <div>
                <div style={{fontSize:12,fontWeight:600,color:"#5c3d52"}}>{f.name}</div>
                <div style={{fontSize:10,color:"#b07a9e"}}>{f.cal} kcal/100{f.unit==="Stück"?"g":f.unit}</div>
              </div>
              <span style={{color:"#f2a8cc",fontSize:18}}>+</span>
            </button>
          ))}
        </div>
      )}
      {sel&&(
        <div style={{background:"#fdf7f4",borderRadius:12,padding:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <span style={{fontSize:13,fontWeight:700,color:"#5c3d52"}}>{sel.name}</span>
            <button onClick={()=>setSel(null)} style={{background:"none",border:"none",cursor:"pointer",color:"#b07a9e",fontSize:16}}>×</button>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
            {sel.unit==="Stück"?(
              <>
                <button onClick={()=>setQty(q=>Math.max(1,q-1))} style={{width:30,height:30,borderRadius:99,background:"#fce4f0",border:"none",fontSize:18,color:"#e8758a",cursor:"pointer"}}>−</button>
                <span style={{fontSize:16,fontWeight:800,color:"#5c3d52",minWidth:24,textAlign:"center"}}>{qty}</span>
                <button onClick={()=>setQty(q=>q+1)} style={{width:30,height:30,borderRadius:99,background:"#fce4f0",border:"none",fontSize:18,color:"#e8758a",cursor:"pointer"}}>+</button>
                <span style={{fontSize:12,color:"#b07a9e"}}>Stück</span>
              </>
            ):(
              <>
                <input type="number" value={qty} onChange={e=>setQty(Number(e.target.value))} min={1}
                  style={{flex:1,padding:"7px 10px",border:"1.5px solid #fce4f0",borderRadius:10,fontSize:14,color:"#5c3d52",outline:"none",background:"white"}}/>
                <span style={{fontSize:12,color:"#b07a9e",fontWeight:600}}>{sel.unit==="ml"?"ml":"g"}</span>
              </>
            )}
          </div>
          <PinkBtn onClick={()=>addIt(sel,qty)}>Hinzufügen ✓</PinkBtn>
        </div>
      )}
    </div>
  );
}


// ─── SETTINGS TAB ─────────────────────────────────────────────────────────────
function SettingsTab({profile,setProfile,setShowOnboarding,manualDeficit,setManualDeficit,baseTDEE,phase,username,onLogout,apiKey,saveApiKey,canUseAI,aiUsage,DAILY_AI_LIMIT}){
  const pi=PHASE_INFO[phase]||PHASE_INFO["follicular"];
  const tdee=(baseTDEE||0)+(manualDeficit||0);
  const [keyInput,setKeyInput]=useState(apiKey||"");
  const [keySaved,setKeySaved]=useState(false);
  const aiStatus=canUseAI?canUseAI():{ok:true,remaining:DAILY_AI_LIMIT};
  return(
    <div style={{padding:"24px 16px 0"}}>
      <h2 style={{fontFamily:"'Playfair Display',serif",color:"#5c3d52",marginBottom:14}}>Mein Profil</h2>
      <div style={{background:"linear-gradient(135deg,#f9d4e8,#fce4f0)",borderRadius:18,padding:16,marginBottom:12,textAlign:"center"}}>
        <div style={{fontSize:44,marginBottom:6}}>🌸</div>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,color:"#5c3d52"}}>{profile.name||"Mein Profil"}</div>
        <div style={{fontSize:13,color:"#b07a9e",marginTop:4}}>{pi.emoji} {pi.name} · TDEE: {tdee} kcal/Tag</div>
        <div style={{marginTop:8,background:"rgba(255,255,255,0.6)",borderRadius:10,padding:"5px 12px",display:"inline-flex",alignItems:"center",gap:6,fontSize:12,color:"#5c3d52",fontWeight:600}}>
          👤 @{username}
        </div>
        {profile.hasEndometriosis&&<div style={{marginTop:8,background:"#fdeef1",borderRadius:10,padding:"5px 12px",display:"inline-block",fontSize:12,color:"#e8758a",fontWeight:600}}>🔴 Endometriose-Modus aktiv</div>}
      </div>
      <Card>
        {[["Name","name","text"],["Alter","age","number"],["Größe (cm)","height","number"],["Gewicht (kg)","weight","number"],["Zielgewicht (kg)","goalWeight","number"]].map(([l,k,t])=>(
          <div key={k} style={{marginBottom:11}}><Label>{l}</Label><Input type={t} value={profile[k]} onChange={e=>setProfile(p=>({...p,[k]:e.target.value}))}/></div>
        ))}
        <div style={{marginBottom:11}}><Label>Letzter Periodenbeginn</Label><Input type="date" value={profile.lastPeriod} onChange={e=>setProfile(p=>({...p,lastPeriod:e.target.value}))}/></div>
        <div style={{marginBottom:11}}><Label>Zykluslänge (Tage)</Label><Input type="number" value={profile.cycleLen} onChange={e=>setProfile(p=>({...p,cycleLen:Number(e.target.value)}))}/></div>
        {[["activity",[["sedentary","Sitzend"],["light","Leicht aktiv"],["moderate","Moderat aktiv"],["active","Sehr aktiv"],["extreme","Extrem aktiv"]],"Aktivitätslevel"],
          ["goal",[["lose","Abnehmen"],["maintain","Halten"],["gain","Zunehmen"]],"Ziel"]].map(([k,opts,l])=>(
          <div key={k} style={{marginBottom:11}}><Label>{l}</Label>
            <select value={profile[k]} onChange={e=>setProfile(p=>({...p,[k]:e.target.value}))} style={{display:"block",width:"100%",marginTop:4,padding:"10px 14px",border:"1.5px solid #fce4f0",borderRadius:12,fontSize:14,color:"#5c3d52",outline:"none",background:"#fdf7f4"}}>
              {opts.map(([v,lb])=><option key={v} value={v}>{lb}</option>)}
            </select>
          </div>
        ))}
        <div style={{display:"flex",alignItems:"center",gap:12,background:"#fdeef1",borderRadius:14,padding:"12px 16px"}}>
          <input type="checkbox" id="endo2" checked={profile.hasEndometriosis} onChange={e=>setProfile(p=>({...p,hasEndometriosis:e.target.checked}))} style={{width:18,height:18,accentColor:"#e8758a"}}/>
          <label htmlFor="endo2" style={{fontSize:13,color:"#5c3d52",fontWeight:500,cursor:"pointer"}}>Endometriose-Modus</label>
        </div>
      </Card>
      <Card>
        <p style={{margin:"0 0 4px",fontSize:13,fontWeight:700,color:"#5c3d52"}}>⚡ Kaloriendefizit anpassen</p>
        <p style={{margin:"0 0 12px",fontSize:12,color:"#b07a9e",lineHeight:1.5}}>Dein automatisches Tagesziel: <strong>{baseTDEE} kcal</strong> (TDEE – Zieldefizit). Hier kannst du das Ziel manuell überschreiben.</p>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
          {[
            {label:"Sanft −250",val:-250,note:"~0,2 kg/Wo"},
            {label:"Standard −400",val:-400,note:"~0,35 kg/Wo"},
            {label:"Moderat −500",val:-500,note:"~0,45 kg/Wo"},
            {label:"Aggressiv −750",val:-750,note:"~0,7 kg/Wo"},
            {label:"Maximum −1000",val:-1000,note:"~0,9 kg/Wo"},
            {label:"Halten ±0",val:0,note:"Gewicht halten"},
            {label:"Aufbauen +300",val:300,note:"~0,25 kg/Wo"},
          ].map(({label,val,note})=>(
            <button key={val} onClick={()=>setManualDeficit(val)}
              style={{padding:"7px 12px",borderRadius:12,border:"1.5px solid",borderColor:manualDeficit===val?"#f2a8cc":"#fce4f0",background:manualDeficit===val?"#fce4f0":"white",cursor:"pointer",textAlign:"left"}}>
              <div style={{fontSize:12,fontWeight:700,color:manualDeficit===val?"#8b2252":"#5c3d52"}}>{label}</div>
              <div style={{fontSize:10,color:"#b07a9e"}}>{note}</div>
            </button>
          ))}
        </div>
        <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:10}}>
          <span style={{fontSize:13,color:"#b07a9e",fontWeight:600}}>Oder manuell eingeben:</span>
          <input type="number" placeholder="z.B. -600"
            value={manualDeficit!==null?manualDeficit:""}
            onChange={e=>setManualDeficit(e.target.value===""?null:Number(e.target.value))}
            style={{flex:1,padding:"8px 12px",border:"1.5px solid #fce4f0",borderRadius:10,fontSize:14,color:"#5c3d52",outline:"none",background:"#fdf7f4"}}/>
        </div>
        <div style={{background:"#fdf7f4",borderRadius:12,padding:"10px 14px"}}>
          <span style={{fontSize:13,color:"#5c3d52"}}>Aktuelles Tagesziel: </span>
          <strong style={{fontSize:15,color:"#f2a8cc"}}>{baseTDEE+(manualDeficit||0)} kcal</strong>
          {manualDeficit!==null&&manualDeficit!==0&&<span style={{fontSize:12,color:"#b07a9e",marginLeft:8}}>({manualDeficit>0?"+":""}{manualDeficit} kcal Anpassung)</span>}
        </div>
        {manualDeficit!==null&&<button onClick={()=>setManualDeficit(null)} style={{marginTop:8,background:"none",border:"none",cursor:"pointer",fontSize:12,color:"#b07a9e",textDecoration:"underline"}}>Zurücksetzen auf automatisch</button>}
      </Card>
      {/* Subscription card */}
      <Card>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
          <span style={{fontSize:20}}>💎</span>
          <div>
            <p style={{margin:0,fontSize:13,fontWeight:700,color:"#5c3d52"}}>Mein Abo</p>
            <p style={{margin:0,fontSize:11,color:"#b07a9e"}}>
              {subscription?.status==="trial"&&`Testphase – endet ${new Date(subscription.trialEnd).toLocaleDateString("de-DE")}`}
              {subscription?.status==="active"&&`Aktiv · ${subscription.plan==="yearly"?"Jahresabo":subscription.plan==="couple"?"Pärchen-Abo":"Monatsabo"}`}
              {subscription?.status==="cancelled"&&"Gekündigt – läuft zum Periodenende aus"}
              {subscription?.status==="expired"&&"Testphase abgelaufen"}
              {!subscription&&"Kein aktives Abo"}
            </p>
          </div>
          <div style={{marginLeft:"auto",background:subscription?.status==="active"?"#edf7ef":subscription?.status==="trial"?"#fdf6e3":"#fdeef1",borderRadius:99,padding:"4px 10px"}}>
            <span style={{fontSize:11,fontWeight:700,color:subscription?.status==="active"?"#3a7a4a":subscription?.status==="trial"?"#8b6000":"#e8758a"}}>
              {subscription?.status==="active"?"✓ Aktiv":subscription?.status==="trial"?"Testphase":subscription?.status==="cancelled"?"Gekündigt":"Inaktiv"}
            </span>
          </div>
        </div>
        {subscription?.status==="active"&&subscription?.periodEnd&&(
          <p style={{margin:"0 0 10px",fontSize:12,color:"#b07a9e"}}>Nächste Abrechnung: {new Date(subscription.periodEnd).toLocaleDateString("de-DE")}</p>
        )}
        {(subscription?.status==="active"||subscription?.status==="trial")&&subscription?.status!=="cancelled"&&(
          <div style={{background:"#fdeef1",borderRadius:12,padding:"10px 14px",marginBottom:10}}>
            <p style={{margin:"0 0 6px",fontSize:12,fontWeight:700,color:"#e8758a"}}>Abo kündigen</p>
            <p style={{margin:"0 0 10px",fontSize:12,color:"#b07a9e",lineHeight:1.5}}>Das Abo wird zum Ende der aktuellen Abrechnungsperiode beendet. Deine Daten bleiben erhalten.</p>
            <button onClick={async()=>{if(window.confirm("Abo wirklich kündigen?")){await onCancelSub();setSubscription(s=>({...s,status:"cancelled",cancelledAt:Date.now()}));}}}
              style={{padding:"8px 16px",background:"none",border:"1.5px solid #e8758a",borderRadius:10,fontSize:13,fontWeight:600,color:"#e8758a",cursor:"pointer"}}>
              Abo kündigen
            </button>
          </div>
        )}
        {(!subscription||subscription?.status==="expired"||subscription?.status==="cancelled")&&(
          <button onClick={()=>alert("Weiterleitung zu Stripe… (In Produktion wird hier Stripe Checkout geöffnet)")}
            style={{width:"100%",padding:"11px",background:"linear-gradient(135deg,#f2a8cc,#e8758a)",border:"none",borderRadius:12,fontSize:14,fontWeight:700,color:"white",cursor:"pointer"}}>
            Abo abschließen 💎
          </button>
        )}
      </Card>
      {/* API Key Section */}
      <Card>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
          <span style={{fontSize:20}}>🔑</span>
          <div>
            <p style={{margin:0,fontSize:13,fontWeight:700,color:"#5c3d52"}}>Anthropic API-Key</p>
            <p style={{margin:0,fontSize:11,color:"#b07a9e"}}>Für unbegrenzte KI-Kameraanalysen</p>
          </div>
        </div>
        {/* Usage meter */}
        <div style={{background:"#fdf7f4",borderRadius:12,padding:"10px 12px",marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <span style={{fontSize:12,color:"#5c3d52",fontWeight:600}}>📷 Heutige KI-Analysen</span>
            <span style={{fontSize:12,fontWeight:700,color:apiKey?"#6db87a":aiStatus.ok?"#5c3d52":"#e8758a"}}>
              {apiKey?"∞ Unbegrenzt":`${aiUsage.date===getToday()?aiUsage.count:0} / ${DAILY_AI_LIMIT}`}
            </span>
          </div>
          {!apiKey&&(
            <div style={{background:"#fce4f0",borderRadius:99,height:6,overflow:"hidden"}}>
              <div style={{width:`${Math.min(((aiUsage.date===getToday()?aiUsage.count:0)/DAILY_AI_LIMIT)*100,100)}%`,height:"100%",background:aiStatus.ok?"#f2a8cc":"#e8758a",borderRadius:99,transition:"width 0.5s"}}/>
            </div>
          )}
        </div>
        <div style={{background:"linear-gradient(135deg,#fdf7f4,#f3eef9)",borderRadius:12,padding:"10px 12px",marginBottom:12,border:"1px solid #fce4f0"}}>
          <p style={{margin:"0 0 4px",fontSize:12,fontWeight:700,color:"#5c3d52"}}>Wie bekomme ich einen Key?</p>
          <p style={{margin:0,fontSize:12,color:"#b07a9e",lineHeight:1.5}}>
            1. Gehe zu <strong>console.anthropic.com</strong><br/>
            2. Account erstellen (kostenlos)<br/>
            3. API Keys - Create Key<br/>
            4. Key hier einfügen<br/>
            Kosten: ~0,001 Euro pro Foto-Analyse
          </p>
        </div>
        <Label>API-Key eingeben</Label>
        <div style={{display:"flex",gap:8,marginTop:4}}>
          <input
            type="password"
            value={keyInput}
            onChange={e=>{setKeyInput(e.target.value);setKeySaved(false);}}
            placeholder="sk-ant-api03-..."
            style={{flex:1,padding:"10px 12px",border:"1.5px solid #fce4f0",borderRadius:12,fontSize:13,color:"#5c3d52",outline:"none",background:"#fdf7f4",fontFamily:"monospace"}}
          />
          <button onClick={async()=>{await saveApiKey(keyInput.trim());setKeySaved(true);setTimeout(()=>setKeySaved(false),2500);}}
            style={{padding:"10px 14px",background:keySaved?"#edf7ef":"linear-gradient(135deg,#f2a8cc,#e8758a)",border:"none",borderRadius:12,fontSize:13,fontWeight:700,color:keySaved?"#3a7a4a":"white",cursor:"pointer",whiteSpace:"nowrap"}}>
            {keySaved?"✓ Gespeichert":"Speichern"}
          </button>
        </div>
        {apiKey&&<button onClick={async()=>{await saveApiKey("");setKeyInput("");}} style={{marginTop:8,background:"none",border:"none",cursor:"pointer",fontSize:12,color:"#b07a9e",textDecoration:"underline"}}>Key entfernen</button>}
      </Card>
      <PinkBtn onClick={()=>setShowOnboarding(true)}>Profil neu einrichten</PinkBtn>
      <div style={{height:10}}/>
      <button onClick={onLogout}
        style={{width:"100%",padding:"13px",background:"white",border:"1.5px solid #fce4f0",borderRadius:16,fontSize:15,fontWeight:600,color:"#b07a9e",cursor:"pointer"}}>
        🚪 Abmelden (@{username})
      </button>
      <div style={{height:20}}/>
    </div>
  );
}

// ─── RECIPE BUILDER ───────────────────────────────────────────────────────────
function RecipeBuilder({onClose,onSave,editRecipe,profile,phase,pi}){
  const [name,setName]=useState(editRecipe?.name||"");
  const [ingredients,setIngredients]=useState(editRecipe?.ingredients||[]);
  const [q,setQ]=useState("");
  const [sel,setSel]=useState(null);
  const [qty,setQty]=useState(100);
  const [filterCat,setFilterCat]=useState("Alle");
  const [editIngId,setEditIngId]=useState(null);
  const [editIngQty,setEditIngQty]=useState(0);

  const r2=(v)=>Math.round(v*100)/100; // 2 decimal places
  const tot=ingredients.reduce((a,i)=>({cal:a.cal+i.cal,p:a.p+i.p,c:a.c+i.c,f:a.f+i.f,fi:a.fi+(i.fi||0)}),{cal:0,p:0,c:0,f:0,fi:0});
  const filtered=FOOD_DB.filter(f=>(f.name.toLowerCase().includes(q.toLowerCase())&&q.length>0)&&(filterCat==="Alle"||f.cat===filterCat)).slice(0,12);

  function addIng(food,amount){
    const f=food.unit==="Stück"?amount:amount/100;
    setIngredients(p=>[...p,{id:Date.now(),name:food.name,qty:amount,unit:food.unit,
      cal:Math.round(food.cal*f),p:r2(food.p*f),c:r2(food.c*f),f:r2(food.f*f),fi:r2((food.fi||0)*f),
      inflammatory:food.inflammatory,endo_ok:food.endo_ok,
      _baseFood:food // store for re-calc when editing qty
    }]);
    setSel(null);setQ("");setQty(food.unit==="Stück"?1:100);
  }

  function updateIngQty(ing,newQty){
    const food=ing._baseFood||FOOD_DB.find(f=>f.name===ing.name);
    if(!food){setEditIngId(null);return;}
    const f=food.unit==="Stück"?newQty:newQty/100;
    setIngredients(p=>p.map(i=>i.id===ing.id?{...i,qty:newQty,
      cal:Math.round(food.cal*f),p:r2(food.p*f),c:r2(food.c*f),f:r2(food.f*f),fi:r2((food.fi||0)*f)
    }:i));
    setEditIngId(null);
  }

  function handleSave(){
    if(!name||ingredients.length===0) return;
    onSave({name,...tot,
      cal:Math.round(tot.cal),p:r2(tot.p),c:r2(tot.c),f:r2(tot.f),fi:r2(tot.fi),
      ingredients});
  }

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(92,61,82,0.4)",zIndex:300,display:"flex",alignItems:"flex-end"}} onClick={onClose}>
      <div style={{background:"white",borderRadius:"24px 24px 0 0",width:"100%",maxWidth:480,margin:"0 auto",padding:20,maxHeight:"92vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <h3 style={{fontFamily:"'Playfair Display',serif",margin:0,color:"#5c3d52",fontSize:20}}>{editRecipe?"✏️ Rezept bearbeiten":"🍽️ Rezept erstellen"}</h3>
          <button onClick={onClose} style={{background:"#fce4f0",border:"none",borderRadius:99,width:32,height:32,cursor:"pointer",fontSize:18,color:"#e8758a"}}>×</button>
        </div>

        {/* Recipe name */}
        <div style={{marginBottom:14}}><Label>Rezeptname</Label><Input value={name} onChange={e=>setName(e.target.value)} placeholder="z.B. Mein Protein-Bowl"/></div>

        {/* Ingredients list */}
        {ingredients.length>0&&(
          <div style={{background:"#fdf7f4",borderRadius:16,padding:14,marginBottom:14}}>
            <p style={{margin:"0 0 10px",fontSize:11,color:"#b07a9e",fontWeight:700,textTransform:"uppercase",letterSpacing:0.5}}>Zutatenliste ({ingredients.length})</p>
            {ingredients.map(i=>(
              <div key={i.id}>
                {editIngId===i.id?(
                  <div style={{background:"white",borderRadius:12,padding:10,marginBottom:6,border:"1.5px solid #f2a8cc"}}>
                    <div style={{fontSize:13,fontWeight:700,color:"#5c3d52",marginBottom:8}}>{i.name}</div>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                      {i.unit==="Stück"?(
                        <>
                          <button onClick={()=>setEditIngQty(q=>Math.max(1,q-1))} style={{width:30,height:30,borderRadius:99,background:"#fce4f0",border:"none",fontSize:18,color:"#e8758a",cursor:"pointer"}}>−</button>
                          <span style={{fontSize:18,fontWeight:800,color:"#5c3d52",minWidth:28,textAlign:"center"}}>{editIngQty}</span>
                          <button onClick={()=>setEditIngQty(q=>q+1)} style={{width:30,height:30,borderRadius:99,background:"#fce4f0",border:"none",fontSize:18,color:"#e8758a",cursor:"pointer"}}>+</button>
                          <span style={{fontSize:12,color:"#b07a9e"}}>Stück</span>
                        </>
                      ):(
                        <>
                          <input type="number" value={editIngQty} onChange={e=>setEditIngQty(Number(e.target.value))} min={1}
                            style={{flex:1,padding:"7px 10px",border:"1.5px solid #fce4f0",borderRadius:10,fontSize:14,color:"#5c3d52",outline:"none",background:"#fdf7f4"}}/>
                          <span style={{fontSize:13,color:"#b07a9e",fontWeight:600}}>{i.unit==="ml"?"ml":"g"}</span>
                        </>
                      )}
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={()=>updateIngQty(i,editIngQty)} style={{flex:1,padding:"8px",background:"linear-gradient(135deg,#f2a8cc,#e8758a)",border:"none",borderRadius:10,fontSize:13,fontWeight:700,color:"white",cursor:"pointer"}}>Übernehmen ✓</button>
                      <button onClick={()=>setEditIngId(null)} style={{padding:"8px 14px",background:"#fdf7f4",border:"1.5px solid #fce4f0",borderRadius:10,fontSize:13,color:"#b07a9e",cursor:"pointer"}}>Abbruch</button>
                    </div>
                  </div>
                ):(
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid #fce4f0"}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:600,color:"#5c3d52"}}>{i.name}</div>
                      <div style={{fontSize:11,color:"#b07a9e",marginTop:1}}>
                        <strong>{i.qty}{i.unit==="Stück"?" Stk.":i.unit==="ml"?"ml":"g"}</strong>
                        {" · "}{i.cal} kcal · P {i.p}g · K {i.c}g · F {i.f}g · Bal. {i.fi}g
                      </div>
                    </div>
                    <div style={{display:"flex",gap:6}}>
                      <button onClick={()=>{setEditIngId(i.id);setEditIngQty(i.qty);}} style={{background:"#fdf7f4",border:"1.5px solid #fce4f0",borderRadius:8,padding:"5px 8px",cursor:"pointer",fontSize:13,color:"#b07a9e"}}>✏️</button>
                      <button onClick={()=>setIngredients(p=>p.filter(x=>x.id!==i.id))} style={{background:"#fdeef1",border:"none",borderRadius:8,padding:"5px 8px",cursor:"pointer",fontSize:13,color:"#e8758a"}}>🗑</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {/* Totals */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:6,marginTop:12}}>
              {[["kcal",Math.round(tot.cal),"#f2a8cc"],["Prot.",r2(tot.p)+"g","#a8d8ea"],["Koh.",r2(tot.c)+"g","#e8c97e"],["Fett",r2(tot.f)+"g","#b5d8a8"],["Bal.",r2(tot.fi)+"g","#c8b0d8"]].map(([l,v,c])=>(
                <div key={l} style={{textAlign:"center",background:"white",borderRadius:10,padding:"7px 3px"}}>
                  <div style={{fontSize:12,fontWeight:700,color:c}}>{v}</div>
                  <div style={{fontSize:10,color:"#b07a9e"}}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search */}
        <p style={{margin:"0 0 6px",fontSize:11,color:"#b07a9e",fontWeight:700,textTransform:"uppercase",letterSpacing:0.5}}>Zutat hinzufügen</p>
        <input value={q} onChange={e=>{setQ(e.target.value);setSel(null);}} placeholder="Zutat suchen…"
          style={{display:"block",width:"100%",marginTop:0,padding:"10px 14px",border:"1.5px solid #fce4f0",borderRadius:12,fontSize:14,color:"#5c3d52",outline:"none",background:"#fdf7f4",boxSizing:"border-box",marginBottom:8}}/>
        <div style={{display:"flex",gap:5,overflowX:"auto",paddingBottom:5,marginBottom:8}}>
          {["Alle",...CATS].map(c=>(
            <button key={c} onClick={()=>setFilterCat(c)} style={{flexShrink:0,padding:"3px 9px",borderRadius:99,border:"1.5px solid",borderColor:filterCat===c?"#f2a8cc":"#fce4f0",background:filterCat===c?"#fce4f0":"white",fontSize:11,fontWeight:600,color:filterCat===c?"#8b2252":"#b07a9e",cursor:"pointer"}}>{c}</button>
          ))}
        </div>
        {filtered.length>0&&!sel&&(
          <div style={{border:"1px solid #fce4f0",borderRadius:14,overflow:"hidden",marginBottom:10}}>
            {filtered.map((f,i)=>(
              <button key={f.id||i} onClick={()=>{setSel(f);setQty(f.unit==="Stück"?1:100);}}
                style={{display:"flex",justifyContent:"space-between",width:"100%",padding:"10px 14px",background:"white",border:"none",borderBottom:i<filtered.length-1?"1px solid #fce4f0":"none",cursor:"pointer",textAlign:"left",alignItems:"center"}}>
                <div>
                  <div style={{fontSize:12,fontWeight:600,color:"#5c3d52"}}>{f.name}</div>
                  <div style={{fontSize:11,color:"#b07a9e"}}>{f.cal} kcal/100{f.unit==="Stück"?"g":f.unit} · P{f.p}g · K{f.c}g</div>
                </div>
                <span style={{color:"#f2a8cc",fontSize:18,fontWeight:700}}>+</span>
              </button>
            ))}
          </div>
        )}
        {sel&&(
          <div style={{background:"#fdf7f4",borderRadius:12,padding:14,marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
              <div>
                <div style={{fontWeight:700,color:"#5c3d52",fontSize:13}}>{sel.name}</div>
                <div style={{fontSize:11,color:"#b07a9e"}}>{sel.cal} kcal / 100{sel.unit==="Stück"?"g":sel.unit}</div>
              </div>
              <button onClick={()=>setSel(null)} style={{background:"none",border:"none",cursor:"pointer",color:"#b07a9e",fontSize:18}}>×</button>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
              <span style={{fontSize:13,color:"#b07a9e",fontWeight:600,whiteSpace:"nowrap"}}>
                {sel.unit==="Stück"?"Stückzahl:":sel.unit==="ml"?"Menge (ml):":"Menge (g):"}
              </span>
              {sel.unit==="Stück"?(
                <div style={{display:"flex",alignItems:"center",gap:8,flex:1}}>
                  <button onClick={()=>setQty(q=>Math.max(1,q-1))} style={{width:32,height:32,borderRadius:99,background:"#fce4f0",border:"none",fontSize:18,color:"#e8758a",cursor:"pointer",fontWeight:700}}>−</button>
                  <span style={{fontSize:18,fontWeight:800,color:"#5c3d52",minWidth:28,textAlign:"center"}}>{qty}</span>
                  <button onClick={()=>setQty(q=>q+1)} style={{width:32,height:32,borderRadius:99,background:"#fce4f0",border:"none",fontSize:18,color:"#e8758a",cursor:"pointer",fontWeight:700}}>+</button>
                  <span style={{fontSize:12,color:"#b07a9e"}}>{sel.unitLabel}</span>
                </div>
              ):(
                <input type="number" value={qty} onChange={e=>setQty(Number(e.target.value))} min={1}
                  style={{flex:1,padding:"8px 10px",border:"1.5px solid #fce4f0",borderRadius:10,fontSize:14,color:"#5c3d52",outline:"none",background:"white"}}/>
              )}
            </div>
            {/* Preview */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:6,marginBottom:10}}>
              {(()=>{const f=sel.unit==="Stück"?qty:qty/100;return[["kcal",Math.round(sel.cal*f),"#f2a8cc"],["Prot.",r2(sel.p*f)+"g","#a8d8ea"],["Koh.",r2(sel.c*f)+"g","#e8c97e"],["Fett",r2(sel.f*f)+"g","#b5d8a8"],["Bal.",r2((sel.fi||0)*f)+"g","#c8b0d8"]]})().map(([l,v,c])=>(
                <div key={l} style={{textAlign:"center",background:"white",borderRadius:10,padding:"6px 2px"}}>
                  <div style={{fontSize:12,fontWeight:700,color:c}}>{v}</div>
                  <div style={{fontSize:9,color:"#b07a9e"}}>{l}</div>
                </div>
              ))}
            </div>
            <PinkBtn onClick={()=>addIng(sel,qty)}>+ Zur Zutatenliste</PinkBtn>
          </div>
        )}
        <PinkBtn onClick={handleSave} disabled={!name||ingredients.length===0}>
          {editRecipe?"Rezept speichern ✓":"Rezept erstellen ✓"}
        </PinkBtn>
      </div>
    </div>
  );
}


// ─── CAMERA AI ────────────────────────────────────────────────────────────────
function CameraAI({onClose,onAddMeal,mealCat,apiKey,canUseAI,trackAIUsage}){
  const [step,setStep]=useState("capture");
  const [imgData,setImgData]=useState(null);
  const [result,setResult]=useState(null);
  const [edit,setEdit]=useState(null);
  const [extra,setExtra]=useState("");
  const [desc,setDesc]=useState("");
  const fileRef=useRef();

  async function analyze(b64,manualDesc){
    // Check daily limit
    if(canUseAI){
      const {ok,remaining}=canUseAI();
      if(!ok){
        setStep("limit");
        return;
      }
    }
    setStep("analyzing");
    try{
      const isManual=!b64&&manualDesc;
      const prompt=isManual
        ?`Du bist Ernährungsexperte. Analysiere: "${manualDesc}". Schätze Nährwerte für die gesamte Portion. Antworte NUR mit JSON (kein Markdown): {"name":"Gerichtsname","cal":0,"p":0,"c":0,"f":0,"fi":0,"ingredients":["Zutat ca. Xg"],"notes":"Hinweis"}`
        :`Du bist Ernährungsexperte. Analysiere das Bild genau. Identifiziere Zutaten und Portionsgrößen. Antworte NUR mit JSON: {"name":"Gericht","cal":0,"p":0,"c":0,"f":0,"fi":0,"ingredients":["Zutat ca. Xg"],"notes":"Genauigkeit"}`;
      const msgs=isManual?[{role:"user",content:prompt}]:[{role:"user",content:[{type:"image",source:{type:"base64",media_type:"image/jpeg",data:b64}},{type:"text",text:prompt}]}];
      const effectiveKey=apiKey||"";
      const headers={"Content-Type":"application/json"};
      if(effectiveKey) headers["x-api-key"]=effectiveKey;
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers,body:JSON.stringify({model:effectiveKey?"claude-sonnet-4-20250514":"claude-haiku-4-5-20251001",max_tokens:1000,messages:msgs})});
      if(trackAIUsage) await trackAIUsage();
      const data=await res.json();
      if(data.error){throw new Error(data.error.message);}
      const text=data.content.map(x=>x.text||"").join("").replace(/```json|```/g,"").trim();
      const parsed=JSON.parse(text);
      setResult(parsed);setEdit({...parsed});setStep("result");
    }catch{
      const fallback={name:"Gericht",cal:350,p:18,c:40,f:10,fi:3,ingredients:[],notes:"Analyse fehlgeschlagen – bitte anpassen."};
      setResult(fallback);setEdit({...fallback});setStep("result");
    }
  }

  function handleFile(e){
    const file=e.target.files[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=ev=>{const b64=ev.target.result.split(",")[1];setImgData(ev.target.result);analyze(b64,"");};
    reader.readAsDataURL(file);
  }

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(92,61,82,0.5)",zIndex:400,display:"flex",alignItems:"flex-end"}} onClick={onClose}>
      <div style={{background:"white",borderRadius:"24px 24px 0 0",width:"100%",maxWidth:480,margin:"0 auto",padding:20,maxHeight:"88vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <h3 style={{fontFamily:"'Playfair Display',serif",margin:0,color:"#5c3d52",fontSize:20}}>📷 KI-Kamera</h3>
          <button onClick={onClose} style={{background:"#fce4f0",border:"none",borderRadius:99,width:32,height:32,cursor:"pointer",fontSize:18,color:"#e8758a"}}>×</button>
        </div>
        {step==="limit"&&(
          <div style={{textAlign:"center",padding:"36px 20px"}}>
            <div style={{fontSize:52,marginBottom:14}}>🔒</div>
            <p style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:"#5c3d52",margin:"0 0 10px"}}>Tageslimit erreicht</p>
            <p style={{fontSize:13,color:"#b07a9e",margin:"0 0 20px",lineHeight:1.6}}>
              Du hast heute {canUseAI&&canUseAI().count||5} von 5 kostenlosen KI-Analysen verbraucht. Morgen stehen dir wieder 5 zur Verfügung.
            </p>
            <div style={{background:"linear-gradient(135deg,#fdf7f4,#fce4f0)",borderRadius:16,padding:16,marginBottom:20,textAlign:"left"}}>
              <p style={{margin:"0 0 6px",fontSize:13,fontWeight:700,color:"#5c3d52"}}>💡 Unbegrenzte Analysen?</p>
              <p style={{margin:0,fontSize:12,color:"#b07a9e",lineHeight:1.5}}>Trage deinen eigenen Anthropic API-Key in den Einstellungen ein. Kosten: ~0,001€ pro Analyse – deutlich günstiger als jedes Abo.</p>
            </div>
            <button onClick={onClose} style={{width:"100%",padding:"12px",background:"linear-gradient(135deg,#f2a8cc,#e8758a)",border:"none",borderRadius:14,fontSize:14,fontWeight:700,color:"white",cursor:"pointer"}}>Verstanden</button>
          </div>
        )}
        {step==="capture"&&(
          <div>
            <div style={{background:"linear-gradient(135deg,#5c3d52,#8b6db8)",borderRadius:18,padding:28,textAlign:"center",marginBottom:14}}>
              <div style={{fontSize:52,marginBottom:10}}>📷</div>
              <p style={{color:"white",fontSize:15,margin:0,fontWeight:600}}>KI erkennt Lebensmittel & schätzt Kalorien</p>
            </div>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFile} style={{display:"none"}}/>
            <PinkBtn onClick={()=>fileRef.current.click()}>📸 Foto aufnehmen / auswählen</PinkBtn>
            <div style={{height:8}}/>
            <button onClick={()=>setStep("manual")} style={{width:"100%",padding:"12px",background:"#fdf7f4",border:"1.5px dashed #f2a8cc",borderRadius:14,fontSize:14,fontWeight:600,color:"#b07a9e",cursor:"pointer"}}>✏️ Gericht manuell beschreiben</button>
          </div>
        )}
        {step==="analyzing"&&(
          <div style={{textAlign:"center",padding:"48px 20px"}}>
            <div style={{fontSize:52,marginBottom:14}}>🔮</div>
            <p style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:"#5c3d52",margin:"0 0 8px"}}>KI analysiert…</p>
            <p style={{fontSize:13,color:"#b07a9e",margin:0}}>Kalorien & Makros werden geschätzt</p>
          </div>
        )}
        {step==="manual"&&(
          <div>
            <p style={{fontSize:13,color:"#b07a9e",marginBottom:10}}>Beschreibe dein Gericht – Zutaten, Zubereitungsart, Portionsgröße:</p>
            <textarea value={desc} onChange={e=>setDesc(e.target.value)} placeholder="z.B. Pasta Carbonara mit 200g Spaghetti, 2 Eiern, 50g Speck, 30g Parmesan"
              style={{width:"100%",minHeight:90,padding:"12px",border:"1.5px solid #fce4f0",borderRadius:12,fontSize:14,color:"#5c3d52",outline:"none",background:"#fdf7f4",resize:"vertical",boxSizing:"border-box",fontFamily:"inherit",marginBottom:12}}/>
            <PinkBtn onClick={()=>analyze(null,desc)} disabled={!desc.trim()}>🔮 KI analysieren</PinkBtn>
            <div style={{height:8}}/>
            <button onClick={()=>setStep("capture")} style={{width:"100%",padding:11,background:"none",border:"1.5px solid #fce4f0",borderRadius:12,fontSize:14,color:"#b07a9e",cursor:"pointer"}}>← Zurück</button>
          </div>
        )}
        {step==="result"&&edit&&(
          <div>
            {imgData&&<img src={imgData} alt="food" style={{width:"100%",borderRadius:14,objectFit:"cover",maxHeight:170,marginBottom:12}}/>}
            <div style={{background:"#fdf7f4",borderRadius:14,padding:14,marginBottom:12}}>
              <div style={{marginBottom:10}}>
                <p style={{margin:"0 0 4px",fontSize:11,color:"#b07a9e",fontWeight:700,textTransform:"uppercase"}}>Erkanntes Gericht</p>
                <input value={edit.name} onChange={e=>setEdit(r=>({...r,name:e.target.value}))}
                  style={{fontSize:16,fontWeight:700,color:"#5c3d52",border:"none",background:"transparent",outline:"none",width:"100%",fontFamily:"inherit"}}/>
              </div>
              {result?.ingredients?.length>0&&(
                <div style={{marginBottom:8}}>
                  <p style={{margin:"0 0 5px",fontSize:11,color:"#b07a9e",fontWeight:700}}>ERKANNTE ZUTATEN:</p>
                  <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                    {result.ingredients.map((ing,i)=><span key={i} style={{background:"white",borderRadius:99,padding:"3px 9px",fontSize:11,color:"#5c3d52",border:"1px solid #fce4f0"}}>{ing}</span>)}
                  </div>
                </div>
              )}
              {result?.notes&&<p style={{margin:0,fontSize:12,color:"#b07a9e",fontStyle:"italic"}}>{result.notes}</p>}
            </div>
            <p style={{fontSize:12,color:"#b07a9e",margin:"0 0 8px",fontWeight:600}}>WERTE ANPASSEN:</p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12}}>
              {[["kcal","cal"],["Protein (g)","p"],["Kohlenh. (g)","c"],["Fett (g)","f"],["Ballaststoffe (g)","fi"]].map(([l,k])=>(
                <div key={k} style={{background:"#fdf7f4",borderRadius:12,padding:"9px 6px",textAlign:"center"}}>
                  <div style={{fontSize:10,color:"#b07a9e",fontWeight:700,marginBottom:3}}>{l}</div>
                  <input type="number" value={edit[k]} onChange={e=>setEdit(r=>({...r,[k]:Number(e.target.value)}))}
                    style={{width:"100%",border:"none",background:"transparent",textAlign:"center",fontSize:15,fontWeight:700,color:"#5c3d52",outline:"none"}}/>
                </div>
              ))}
            </div>
            <div style={{marginBottom:12}}>
              <label style={{fontSize:11,color:"#b07a9e",fontWeight:700}}>Nicht erkannte Zutaten hinzufügen:</label>
              <input value={extra} onChange={e=>setExtra(e.target.value)} placeholder="z.B. 1 EL Öl, Käse überbacken, Sahnesauce…"
                style={{display:"block",width:"100%",marginTop:4,padding:"9px 12px",border:"1.5px solid #fce4f0",borderRadius:12,fontSize:14,color:"#5c3d52",outline:"none",background:"#fdf7f4",boxSizing:"border-box"}}/>
            </div>
            <PinkBtn onClick={()=>onAddMeal({name:`${edit.name}${extra?` (+${extra})`:""}`,cal:edit.cal+(extra?50:0),p:edit.p,c:edit.c,f:edit.f,fi:edit.fi,unit:"g",cat:mealCat,inflammatory:false,endo_ok:true,qty:1})}>
              ✓ Als Mahlzeit hinzufügen
            </PinkBtn>
            <div style={{height:8}}/>
            <button onClick={()=>{setStep("capture");setImgData(null);setResult(null);}} style={{width:"100%",padding:11,background:"none",border:"1.5px solid #fce4f0",borderRadius:12,fontSize:14,color:"#b07a9e",cursor:"pointer"}}>← Neu fotografieren</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SOCIAL TAB ───────────────────────────────────────────────────────────────
function SocialTab({username,profile,days,recipes,phase}){
  const [publicFeed,setPublicFeed]=useState([]);
  const [feedLoaded,setFeedLoaded]=useState(false);
  const [subTab,setSubTab]=useState("friends");
  const [friends,setFriends]=useState([]);
  const [requests,setRequests]=useState([]);
  const [shareSettings,setShareSettings]=useState({shareAnalysis:false,shareCycle:false,shareRecipes:false,shareFertility:false});
  const [sharedRecipes,setSharedRecipes]=useState([]);
  const [loading,setLoading]=useState(true);
  const [searchUser,setSearchUser]=useState("");
  const [searchResult,setSearchResult]=useState(null); // null | "found" | "notfound" | "self" | "already"
  const [addRelation,setAddRelation]=useState("friend");
  const [friendData,setFriendData]=useState({}); // {username: {profile,shareSettings,lastSync,...}}
  const [toast,setToastMsg]=useState(null);
  const [viewFriend,setViewFriend]=useState(null);

  function showToast(m,c="#6db87a"){setToastMsg({m,c});setTimeout(()=>setToastMsg(null),3500);}

  useEffect(()=>{
    async function load(){
      const [fr,req,ss,sr,feed]=await Promise.all([
        storageLoad(UK_FRIENDS(username)),
        storageLoad(UK_REQUESTS(username)),
        storageLoad(UK_SHARE(username)),
        storageLoad(UK_SHARED_RECIPES(username)),
        storageLoad(UK_PUBLIC_FEED()),
      ]);
      if(fr) setFriends(fr);
      if(req) setRequests(req);
      if(ss) setShareSettings(ss);
      if(sr) setSharedRecipes(sr);
      if(feed) setPublicFeed(feed);
      setFeedLoaded(true);
      setLoading(false);
    }
    load();
  },[username]);

  async function saveShareSettings(s){
    setShareSettings(s);
    await storageSave(UK_SHARE(username),s);
    // Update public profile so friends can read it
    await publishPublicData(s);
  }

  async function publishPublicData(ss=shareSettings){
    const pub={
      username,
      displayName:profile.name||username,
      updatedAt:Date.now(),
      shareSettings:ss,
    };
    if(ss.shareAnalysis){
      const meals=Object.values(days);
      const allKcal=meals.map(d=>(d.meals||[]).reduce((s,m)=>s+m.cal,0)).filter(Boolean);
      pub.avgKcal=allKcal.length?Math.round(allKcal.reduce((a,b)=>a+b,0)/allKcal.length):null;
      pub.totalDays=meals.length;
      // Last 7 days kcal
      const last7=Object.entries(days).sort(([a],[b])=>b.localeCompare(a)).slice(0,7).map(([date,d])=>({
        date,kcal:(d.meals||[]).reduce((s,m)=>s+m.cal,0)
      }));
      pub.last7=last7;
    }
    if(ss.shareCycle){
      pub.phase=phase;
      pub.lastPeriod=profile.lastPeriod;
      pub.cycleLen=profile.cycleLen;
    }
    if(ss.shareFertility){
      pub.fertInfo=getFertilityInfo(profile.lastPeriod,profile.cycleLen,days);
    }
    if(ss.shareRecipes){
      pub.recipeCount=recipes.length;
    }
    await storageSave(uk(username,"public"),pub);
  }

  async function searchForUser(){
    const u=searchUser.trim().toLowerCase();
    if(!u){return;}
    if(u===username){setSearchResult("self");return;}
    if(friends.some(f=>f.username===u)){setSearchResult("already");return;}
    const users=await storageLoad(UK_USERS())||{};
    if(users[u]) setSearchResult("found");
    else setSearchResult("notfound");
  }

  async function sendRequest(){
    const u=searchUser.trim().toLowerCase();
    // Add to their requests
    const theirReqs=(await storageLoad(UK_REQUESTS(u)))||[];
    const already=theirReqs.some(r=>r.from===username);
    if(already){showToast("Anfrage bereits gesendet.","#e8758a");return;}
    theirReqs.push({from:username,relation:addRelation,at:Date.now()});
    await storageSave(UK_REQUESTS(u),theirReqs);
    setSearchResult(null);setSearchUser("");
    showToast(`✓ Anfrage an @${u} gesendet!`);
  }

  async function acceptRequest(req){
    const newFriends=[...friends,{username:req.from,relation:req.relation||"friend",addedAt:Date.now()}];
    setFriends(newFriends);
    await storageSave(UK_FRIENDS(username),newFriends);
    // Also add back on their side
    const theirFriends=(await storageLoad(UK_FRIENDS(req.from)))||[];
    if(!theirFriends.some(f=>f.username===username)){
      theirFriends.push({username,relation:req.relation||"friend",addedAt:Date.now()});
      await storageSave(UK_FRIENDS(req.from),theirFriends);
    }
    // Remove from requests
    const newReqs=requests.filter(r=>r.from!==req.from);
    setRequests(newReqs);
    await storageSave(UK_REQUESTS(username),newReqs);
    showToast(`✓ @${req.from} zur Freundesliste hinzugefügt!`);
  }

  async function declineRequest(req){
    const newReqs=requests.filter(r=>r.from!==req.from);
    setRequests(newReqs);
    await storageSave(UK_REQUESTS(username),newReqs);
    showToast("Anfrage abgelehnt.");
  }

  async function removeFriend(u){
    const nf=friends.filter(f=>f.username!==u);
    setFriends(nf);
    await storageSave(UK_FRIENDS(username),nf);
    showToast(`@${u} entfernt.`);
  }

  async function loadFriendData(u){
    const pub=await storageLoad(uk(u,"public"));
    if(pub) setFriendData(p=>({...p,[u]:pub}));
    setViewFriend(u);
  }

  async function togglePublishRecipe(recipe){
    const feed=(await storageLoad(UK_PUBLIC_FEED()))||[];
    const exists=feed.findIndex(r=>r._id===`${username}:${recipe.id}`);
    if(exists>=0){
      // Unpublish
      const newFeed=feed.filter(r=>r._id!==`${username}:${recipe.id}`);
      await storageSave(UK_PUBLIC_FEED(),newFeed);
      setPublicFeed(newFeed);
      showToast("Rezept aus Feed entfernt.");
    } else {
      // Publish
      const post={
        _id:`${username}:${recipe.id}`,
        _author:username,
        _authorDisplay:profile.name||username,
        _publishedAt:Date.now(),
        ...recipe,
        id:recipe.id,
      };
      const newFeed=[post,...feed].slice(0,200); // max 200 posts in feed
      await storageSave(UK_PUBLIC_FEED(),newFeed);
      setPublicFeed(newFeed);
      showToast("✓ Rezept im Feed veröffentlicht!");
    }
  }

  function isPublished(recipe){
    return publicFeed.some(r=>r._id===`${username}:${recipe.id}`);
  }

  async function saveFromFeed(post){
    const theirRecipes=(await storageLoad(UK_SHARED_RECIPES(username)))||[];
    const already=theirRecipes.some(r=>r._id===post._id);
    if(already){showToast("Rezept bereits gespeichert.","#e8758a");return;}
    const saved={...post,id:Date.now(),_sharedFrom:post._author,_sharedAt:Date.now()};
    const newList=[...theirRecipes,saved];
    setSharedRecipes(newList);
    await storageSave(UK_SHARED_RECIPES(username),newList);
    showToast(`✓ Rezept "${post.name}" gespeichert!`);
  }

  async function shareRecipeWith(recipe,targetUser){
    const theirRecipes=(await storageLoad(UK_SHARED_RECIPES(targetUser)))||[];
    const already=theirRecipes.some(r=>r._sharedFrom===username&&r.name===recipe.name);
    if(already){showToast(`Rezept bereits mit @${targetUser} geteilt.`,"#e8758a");return;}
    theirRecipes.push({...recipe,id:Date.now(),_sharedFrom:username,_sharedAt:Date.now()});
    await storageSave(UK_SHARED_RECIPES(targetUser),theirRecipes);
    showToast(`✓ Rezept mit @${targetUser} geteilt!`);
  }

  const pi=PHASE_INFO[phase]||PHASE_INFO.follicular;

  if(loading) return(
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:60}}>
      <div style={{fontSize:32}}>🌸</div>
    </div>
  );

  return(
    <div style={{padding:"0 0 0",fontFamily:"'DM Sans',sans-serif"}}>
      {toast&&<div style={{position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",zIndex:9999,background:"white",borderLeft:`4px solid ${toast.c}`,borderRadius:14,padding:"10px 16px",boxShadow:"0 8px 24px rgba(0,0,0,0.12)",fontSize:13,color:"#5c3d52",fontWeight:600,maxWidth:340,zIndex:9999}}>{toast.m}</div>}

      {/* Header */}
      <div style={{background:"linear-gradient(135deg,#f9d4e8,#fce4f0)",padding:"28px 16px 0"}}>
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
        <h2 style={{fontFamily:"'Playfair Display',serif",color:"#5c3d52",margin:"0 0 14px",fontSize:24}}>💞 Family & Friends</h2>
        <div style={{display:"flex",gap:0,borderBottom:"2px solid rgba(255,255,255,0.5)"}}>
          {[["friends","👥 Freunde"],["share","🔒 Teilen"],["shared","🎁 Geteilt"],["recipes","🍽️ Rezepte"],["feed","✨ Feed"]].map(([t,l])=>(
            <button key={t} onClick={()=>setSubTab(t)}
              style={{flex:1,padding:"9px 2px",background:"none",border:"none",cursor:"pointer",fontSize:11,fontWeight:700,color:subTab===t?"#e8758a":"#b07a9e",borderBottom:subTab===t?"2px solid #e8758a":"2px solid transparent",marginBottom:-2,whiteSpace:"nowrap"}}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div style={{padding:"16px 16px 0"}}>

      {/* ── FRIENDS TAB ── */}
      {subTab==="friends"&&<>
        {/* Pending requests */}
        {requests.length>0&&(
          <div style={{background:"linear-gradient(135deg,#fdf6e3,#fce4f0)",borderRadius:18,padding:16,marginBottom:14,border:"1.5px solid #e8c97e"}}>
            <p style={{margin:"0 0 10px",fontSize:13,fontWeight:700,color:"#5c3d52"}}>📬 Ausstehende Anfragen ({requests.length})</p>
            {requests.map(req=>(
              <div key={req.from} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.5)"}}>
                <div>
                  <span style={{fontSize:14,fontWeight:700,color:"#5c3d52"}}>@{req.from}</span>
                  <span style={{fontSize:11,color:"#b07a9e",marginLeft:8}}>{req.relation==="partner"?"💑 Partner":"👥 Freund/in"}</span>
                </div>
                <div style={{display:"flex",gap:6}}>
                  <button onClick={()=>acceptRequest(req)} style={{padding:"6px 12px",background:"linear-gradient(135deg,#f2a8cc,#e8758a)",border:"none",borderRadius:10,fontSize:12,fontWeight:700,color:"white",cursor:"pointer"}}>✓ Annehmen</button>
                  <button onClick={()=>declineRequest(req)} style={{padding:"6px 10px",background:"white",border:"1.5px solid #fce4f0",borderRadius:10,fontSize:12,color:"#b07a9e",cursor:"pointer"}}>✕</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Search */}
        <div style={{background:"white",borderRadius:18,padding:16,marginBottom:14,boxShadow:"0 2px 12px rgba(242,168,204,0.1)"}}>
          <p style={{margin:"0 0 10px",fontSize:13,fontWeight:700,color:"#5c3d52"}}>🔍 Freund/Partner hinzufügen</p>
          <div style={{display:"flex",gap:8,marginBottom:10}}>
            <input value={searchUser} onChange={e=>{setSearchUser(e.target.value);setSearchResult(null);}} placeholder="Benutzername eingeben…"
              onKeyDown={e=>e.key==="Enter"&&searchForUser()}
              style={{flex:1,padding:"10px 12px",border:"1.5px solid #fce4f0",borderRadius:12,fontSize:14,color:"#5c3d52",outline:"none",background:"#fdf7f4"}}/>
            <button onClick={searchForUser} style={{padding:"10px 14px",background:"linear-gradient(135deg,#f2a8cc,#e8758a)",border:"none",borderRadius:12,fontSize:14,fontWeight:700,color:"white",cursor:"pointer"}}>Suchen</button>
          </div>
          {searchResult==="found"&&(
            <div style={{background:"#edf7ef",border:"1.5px solid #6db87a",borderRadius:14,padding:12}}>
              <p style={{margin:"0 0 10px",fontSize:13,fontWeight:600,color:"#3a7a4a"}}>✓ @{searchUser} gefunden!</p>
              <div style={{display:"flex",gap:8,marginBottom:10}}>
                {[["friend","👥 Freund/in"],["partner","💑 Partner"]].map(([v,l])=>(
                  <button key={v} onClick={()=>setAddRelation(v)}
                    style={{flex:1,padding:"7px",borderRadius:10,border:"1.5px solid",borderColor:addRelation===v?"#f2a8cc":"#fce4f0",background:addRelation===v?"#fce4f0":"white",fontSize:13,fontWeight:600,color:addRelation===v?"#8b2252":"#b07a9e",cursor:"pointer"}}>
                    {l}
                  </button>
                ))}
              </div>
              <button onClick={sendRequest} style={{width:"100%",padding:"10px",background:"linear-gradient(135deg,#f2a8cc,#e8758a)",border:"none",borderRadius:12,fontSize:14,fontWeight:700,color:"white",cursor:"pointer"}}>
                Anfrage senden 💌
              </button>
            </div>
          )}
          {searchResult==="notfound"&&<p style={{margin:0,fontSize:13,color:"#e8758a"}}>❌ Kein Account mit diesem Benutzernamen gefunden.</p>}
          {searchResult==="self"&&<p style={{margin:0,fontSize:13,color:"#e8758a"}}>Das bist du selbst 😄</p>}
          {searchResult==="already"&&<p style={{margin:0,fontSize:13,color:"#e8758a"}}>Diese Person ist bereits in deiner Liste.</p>}
        </div>

        {/* Friends list */}
        {friends.length===0?(
          <div style={{background:"white",borderRadius:18,padding:24,textAlign:"center",boxShadow:"0 2px 12px rgba(242,168,204,0.1)"}}>
            <div style={{fontSize:40,marginBottom:10}}>👥</div>
            <p style={{color:"#b07a9e",fontSize:14,margin:0}}>Noch keine Freunde oder Partner hinzugefügt.</p>
          </div>
        ):(
          friends.map(f=>{
            const fd=friendData[f.username];
            const isPartner=f.relation==="partner";
            return(
              <div key={f.username} style={{background:"white",borderRadius:18,padding:16,marginBottom:10,boxShadow:"0 2px 12px rgba(242,168,204,0.1)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:fd?10:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{width:44,height:44,borderRadius:99,background:"linear-gradient(135deg,#f9d4e8,#fce4f0)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>
                      {isPartner?"💑":"🌸"}
                    </div>
                    <div>
                      <div style={{fontSize:15,fontWeight:700,color:"#5c3d52"}}>@{f.username}</div>
                      <div style={{fontSize:11,color:"#b07a9e"}}>{isPartner?"Partner":"Freund/in"} · seit {new Date(f.addedAt).toLocaleDateString("de-DE",{day:"numeric",month:"short",year:"numeric"})}</div>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={()=>fd&&viewFriend===f.username?setViewFriend(null):loadFriendData(f.username)}
                      style={{padding:"6px 12px",background:"#fdf7f4",border:"1.5px solid #fce4f0",borderRadius:10,fontSize:12,fontWeight:600,color:"#b07a9e",cursor:"pointer"}}>
                      {viewFriend===f.username?"Schließen":"Profil"}
                    </button>
                    <button onClick={()=>removeFriend(f.username)}
                      style={{padding:"6px 8px",background:"none",border:"none",cursor:"pointer",color:"#e8758a",fontSize:14}}>🗑</button>
                  </div>
                </div>
                {/* Friend data view */}
                {viewFriend===f.username&&fd&&(
                  <div style={{borderTop:"1px solid #fdf7f4",paddingTop:12,marginTop:4}}>
                    <p style={{margin:"0 0 8px",fontSize:11,color:"#b07a9e",fontWeight:700,textTransform:"uppercase",letterSpacing:0.5}}>Geteilte Informationen</p>
                    {!fd.shareSettings?.shareAnalysis&&!fd.shareSettings?.shareCycle&&!fd.shareSettings?.shareFertility&&(
                      <p style={{fontSize:13,color:"#c4a0b8",fontStyle:"italic"}}>@{f.username} teilt noch keine Informationen.</p>
                    )}
                    {fd.shareSettings?.shareAnalysis&&fd.avgKcal&&(
                      <div style={{background:"#fdf7f4",borderRadius:12,padding:10,marginBottom:8}}>
                        <p style={{margin:"0 0 6px",fontSize:12,fontWeight:700,color:"#5c3d52"}}>📊 Ernährungsfortschritt</p>
                        <p style={{margin:"0 0 4px",fontSize:13,color:"#5c3d52"}}>Ø <strong>{fd.avgKcal} kcal/Tag</strong> · {fd.totalDays} Tage erfasst</p>
                        {fd.last7&&fd.last7.length>0&&(
                          <div>
                            <p style={{margin:"6px 0 4px",fontSize:11,color:"#b07a9e",fontWeight:600}}>LETZTE 7 TAGE</p>
                            <div style={{display:"flex",gap:4,alignItems:"flex-end",height:40}}>
                              {fd.last7.slice().reverse().map((d,i)=>{
                                const maxK=Math.max(...fd.last7.map(x=>x.kcal),1);
                                const h=Math.round((d.kcal/maxK)*36);
                                return<div key={i} title={`${d.date}: ${d.kcal} kcal`}
                                  style={{flex:1,height:h,background:"#f2a8cc",borderRadius:"4px 4px 0 0",minHeight:2}}/>;
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {fd.shareSettings?.shareCycle&&fd.phase&&(
                      <div style={{background:"#fdf7f4",borderRadius:12,padding:10,marginBottom:8}}>
                        <p style={{margin:"0 0 6px",fontSize:12,fontWeight:700,color:"#5c3d52"}}>🌸 Zyklusphase</p>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <span style={{fontSize:20}}>{PHASE_INFO[fd.phase]?.emoji||"🌸"}</span>
                          <div>
                            <span style={{fontSize:13,fontWeight:600,color:PHASE_INFO[fd.phase]?.color||"#e8758a"}}>{PHASE_INFO[fd.phase]?.name||fd.phase}</span>
                            <p style={{margin:"2px 0 0",fontSize:11,color:"#b07a9e"}}>{PHASE_INFO[fd.phase]?.mood||""}</p>
                          </div>
                        </div>
                      </div>
                    )}
                    {isPartner&&fd.shareSettings?.shareFertility&&fd.fertInfo&&(
                      <div style={{background:fd.fertInfo.isFertile?"#edf7ef":"#fdf7f4",borderRadius:12,padding:10,marginBottom:8,border:`1px solid ${fd.fertInfo.isFertile?"#6db87a":"#fce4f0"}`}}>
                        <p style={{margin:"0 0 6px",fontSize:12,fontWeight:700,color:"#5c3d52"}}>💑 Fruchtbarkeit</p>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <span style={{fontSize:22}}>{fd.fertInfo.isPeakFertile?"🥚":fd.fertInfo.isFertile?"🌱":"🌙"}</span>
                          <div>
                            {fd.fertInfo.isPeakFertile&&<p style={{margin:0,fontSize:13,fontWeight:700,color:"#3a7a4a"}}>Peak-Fruchtbarkeit – Eisprung heute!</p>}
                            {fd.fertInfo.isFertile&&!fd.fertInfo.isPeakFertile&&<p style={{margin:0,fontSize:13,fontWeight:700,color:"#3a7a4a"}}>Fruchtbares Fenster aktiv</p>}
                            {!fd.fertInfo.isFertile&&<p style={{margin:0,fontSize:13,color:"#5c3d52"}}>Nicht fruchtbar</p>}
                            {fd.lastPeriod&&(()=>{
                              const lp=new Date(fd.lastPeriod);
                              const cl=fd.cycleLen||28;
                              const nextPeriod=new Date(lp);
                              nextPeriod.setDate(lp.getDate()+cl);
                              const daysUntil=Math.ceil((nextPeriod-new Date())/86400000);
                              return<p style={{margin:"3px 0 0",fontSize:11,color:"#b07a9e"}}>
                                {daysUntil>0?`Nächste Periode in ~${daysUntil} Tagen`:`Periode erwartet`}
                              </p>;
                            })()}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {viewFriend===f.username&&!fd&&(
                  <div style={{borderTop:"1px solid #fdf7f4",paddingTop:12,marginTop:4}}>
                    <p style={{fontSize:13,color:"#c4a0b8",fontStyle:"italic"}}>Lade Profil…</p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </>}

      {/* ── SHARE SETTINGS TAB ── */}
      {subTab==="share"&&(
        <div>
          <div style={{background:"linear-gradient(135deg,#f3eef9,#fce4f0)",borderRadius:18,padding:16,marginBottom:14}}>
            <p style={{margin:"0 0 6px",fontSize:13,fontWeight:700,color:"#5c3d52"}}>🔒 Datenschutz & Teilen</p>
            <p style={{margin:0,fontSize:12,color:"#b07a9e",lineHeight:1.5}}>Du entscheidest was du teilst. Nur bestätigte Freunde und Partner sehen deine geteilten Daten.</p>
          </div>
          {[
            {k:"shareAnalysis",icon:"📊",title:"Ernährungsanalyse teilen",desc:"Ø Kalorien, Fortschrittsbalken, letzte 7 Tage"},
            {k:"shareCycle",icon:"🌸",title:"Zyklusphase teilen",desc:"Aktuelle Phase und Stimmungshinweis (keine Details)"},
            {k:"shareRecipes",icon:"🍽️",title:"Rezeptanzahl teilen",desc:"Wie viele Rezepte du gespeichert hast"},
            {k:"shareFertility",icon:"💑",title:"Fruchtbarkeit & Periode teilen",desc:"Nur für Partner – fruchtbare Tage, Eisprung, nächste Periode"},
          ].map(({k,icon,title,desc})=>(
            <div key={k} style={{background:"white",borderRadius:18,padding:16,marginBottom:10,boxShadow:"0 2px 12px rgba(242,168,204,0.1)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{flex:1,paddingRight:12}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                    <span style={{fontSize:18}}>{icon}</span>
                    <span style={{fontSize:14,fontWeight:700,color:"#5c3d52"}}>{title}</span>
                  </div>
                  <p style={{margin:0,fontSize:12,color:"#b07a9e"}}>{desc}</p>
                </div>
                <button onClick={()=>{const s={...shareSettings,[k]:!shareSettings[k]};saveShareSettings(s);}}
                  style={{width:50,height:28,borderRadius:99,background:shareSettings[k]?"#f2a8cc":"#e0e0e0",border:"none",cursor:"pointer",position:"relative",flexShrink:0,transition:"background 0.3s"}}>
                  <div style={{width:22,height:22,borderRadius:99,background:"white",position:"absolute",top:3,left:shareSettings[k]?25:3,transition:"left 0.3s",boxShadow:"0 1px 4px rgba(0,0,0,0.2)"}}/>
                </button>
              </div>
            </div>
          ))}
          <div style={{background:"#fdf7f4",borderRadius:14,padding:"10px 14px",marginTop:4}}>
            <p style={{margin:0,fontSize:12,color:"#b07a9e",lineHeight:1.5}}>💡 Tippe auf „Profil" bei einem Freund um seine geteilten Daten zu sehen. Daten werden automatisch aktualisiert.</p>
          </div>
        </div>
      )}

      {/* ── SHARED WITH ME TAB ── */}
      {subTab==="shared"&&(
        <div>
          <p style={{margin:"0 0 14px",fontSize:13,color:"#b07a9e"}}>Von Freunden geteilte Rezepte und Inhalte:</p>
          {sharedRecipes.length===0?(
            <div style={{background:"white",borderRadius:18,padding:24,textAlign:"center",boxShadow:"0 2px 12px rgba(242,168,204,0.1)"}}>
              <div style={{fontSize:40,marginBottom:10}}>🎁</div>
              <p style={{color:"#b07a9e",fontSize:14,margin:0}}>Noch keine geteilten Rezepte.</p>
              <p style={{color:"#c4a0b8",fontSize:12,marginTop:6}}>Wenn Freunde Rezepte mit dir teilen, erscheinen sie hier.</p>
            </div>
          ):(
            sharedRecipes.map(r=>(
              <div key={r.id} style={{background:"white",borderRadius:18,padding:16,marginBottom:10,boxShadow:"0 2px 12px rgba(242,168,204,0.1)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                  <div>
                    <div style={{fontSize:15,fontWeight:700,color:"#5c3d52"}}>🍽️ {r.name}</div>
                    <div style={{fontSize:11,color:"#b07a9e",marginTop:2}}>geteilt von @{r._sharedFrom} · {new Date(r._sharedAt).toLocaleDateString("de-DE",{day:"numeric",month:"short"})}</div>
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:6,marginBottom:10}}>
                  {[["kcal",Math.round(r.cal),"#f2a8cc"],["P",Math.round(r.p)+"g","#a8d8ea"],["K",Math.round(r.c)+"g","#e8c97e"],["F",Math.round(r.f)+"g","#b5d8a8"],["Bal",Math.round(r.fi||0)+"g","#c8b0d8"]].map(([l,v,c])=>(
                    <div key={l} style={{textAlign:"center",background:"#fdf7f4",borderRadius:10,padding:"6px 3px"}}>
                      <div style={{fontSize:12,fontWeight:700,color:c}}>{v}</div>
                      <div style={{fontSize:10,color:"#b07a9e"}}>{l}</div>
                    </div>
                  ))}
                </div>
                {r.ingredients&&r.ingredients.length>0&&(
                  <div style={{marginBottom:10}}>
                    <p style={{margin:"0 0 6px",fontSize:11,color:"#b07a9e",fontWeight:700,textTransform:"uppercase"}}>Zutaten</p>
                    {r.ingredients.map((ing,i)=>(
                      <div key={i} style={{fontSize:12,color:"#5c3d52",padding:"3px 0",borderBottom:"1px solid #fdf7f4"}}>
                        <strong>{ing.qty}{ing.unit==="Stück"?" Stk.":ing.unit==="ml"?"ml":"g"}</strong> {ing.name}
                        <span style={{color:"#b07a9e",marginLeft:6}}>{ing.cal} kcal</span>
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={async()=>{
                  const saved={...r,id:Date.now(),_sharedFrom:r._sharedFrom};
                  setSharedRecipes(p=>p.map(x=>x.id===r.id?{...x,_saved:true}:x));
                  showToast(`✓ Rezept "${r.name}" in deine Rezepte gespeichert!`);
                }} style={{width:"100%",padding:"9px",background:r._saved?"#edf7ef":"linear-gradient(135deg,#f2a8cc,#e8758a)",border:"none",borderRadius:12,fontSize:13,fontWeight:700,color:r._saved?"#3a7a4a":"white",cursor:"pointer"}}>
                  {r._saved?"✓ In eigenen Rezepten gespeichert":"+ In eigene Rezepte übernehmen"}
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── SHARE RECIPES TAB ── */}
      {subTab==="recipes"&&(
        <div>
          <p style={{margin:"0 0 14px",fontSize:13,color:"#b07a9e"}}>Wähle ein Rezept und teile es mit einem Freund:</p>
          {friends.length===0&&(
            <div style={{background:"#fdf7f4",borderRadius:14,padding:"10px 14px",marginBottom:14}}>
              <p style={{margin:0,fontSize:13,color:"#b07a9e"}}>💡 Füge zuerst Freunde hinzu um Rezepte zu teilen.</p>
            </div>
          )}
          {recipes.length===0?(
            <div style={{background:"white",borderRadius:18,padding:24,textAlign:"center",boxShadow:"0 2px 12px rgba(242,168,204,0.1)"}}>
              <div style={{fontSize:40,marginBottom:10}}>🍽️</div>
              <p style={{color:"#b07a9e",fontSize:14,margin:0}}>Noch keine Rezepte erstellt.</p>
            </div>
          ):(
            recipes.map(r=>(
              <div key={r.id} style={{background:"white",borderRadius:18,padding:16,marginBottom:10,boxShadow:"0 2px 12px rgba(242,168,204,0.1)"}}>
                <div style={{fontSize:15,fontWeight:700,color:"#5c3d52",marginBottom:4}}>🍽️ {r.name}</div>
                <div style={{fontSize:12,color:"#b07a9e",marginBottom:10}}>{Math.round(r.cal)} kcal · P{Math.round(r.p)}g · {r.ingredients?.length||0} Zutaten</div>
                <div style={{display:"flex",gap:8,marginBottom:friends.length>0?10:0,flexWrap:"wrap"}}>
                  <button onClick={()=>togglePublishRecipe(r)}
                    style={{flex:1,padding:"8px 12px",background:isPublished(r)?"linear-gradient(135deg,#8b6db8,#5c3d52)":"linear-gradient(135deg,#f2a8cc,#e8758a)",border:"none",borderRadius:10,fontSize:12,fontWeight:700,color:"white",cursor:"pointer"}}>
                    {isPublished(r)?"✓ Im Feed veröffentlicht":"✨ Im Feed veröffentlichen"}
                  </button>
                </div>
                {friends.length>0&&(
                  <div>
                    <p style={{margin:"0 0 6px",fontSize:11,color:"#b07a9e",fontWeight:700,textTransform:"uppercase"}}>Direkt teilen mit:</p>
                    <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                      {friends.map(f=>(
                        <button key={f.username} onClick={()=>shareRecipeWith(r,f.username)}
                          style={{padding:"6px 12px",background:"#fdf7f4",border:"1.5px solid #fce4f0",borderRadius:10,fontSize:12,fontWeight:600,color:"#5c3d52",cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
                          <span>{f.relation==="partner"?"💑":"🌸"}</span> @{f.username}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ── FOR YOU FEED TAB ── */}
      {subTab==="feed"&&(
        <div>
          <div style={{background:"linear-gradient(135deg,#f3eef9,#fce4f0)",borderRadius:18,padding:14,marginBottom:14}}>
            <p style={{margin:"0 0 4px",fontSize:13,fontWeight:700,color:"#5c3d52"}}>✨ GlowTrack Feed</p>
            <p style={{margin:0,fontSize:12,color:"#b07a9e",lineHeight:1.5}}>Rezepte die GlowTrack-Nutzer:innen öffentlich geteilt haben. Nährwerte, Zutaten, Inspiration.</p>
          </div>
          {publicFeed.filter(p=>p._author!==username).length===0?(
            <div style={{background:"white",borderRadius:18,padding:28,textAlign:"center",boxShadow:"0 2px 12px rgba(242,168,204,0.1)"}}>
              <div style={{fontSize:44,marginBottom:12}}>✨</div>
              <p style={{color:"#5c3d52",fontSize:15,fontWeight:600,margin:"0 0 6px"}}>Der Feed ist noch leer</p>
              <p style={{color:"#b07a9e",fontSize:13,margin:0}}>Veröffentliche deine Rezepte im „Rezepte"-Tab um sie hier zu sehen. Andere Nutzer:innen sehen sie dann auch!</p>
            </div>
          ):(
            publicFeed.filter(p=>p._author!==username).map(post=>{
              const alreadySaved=sharedRecipes.some(r=>r._id===post._id);
              return(
                <div key={post._id} style={{background:"white",borderRadius:20,marginBottom:16,overflow:"hidden",boxShadow:"0 4px 20px rgba(242,168,204,0.15)"}}>
                  {/* Recipe card header */}
                  <div style={{background:"linear-gradient(135deg,#f9d4e8,#fce4f0)",padding:"16px 16px 12px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                      <div style={{width:38,height:38,borderRadius:99,background:"linear-gradient(135deg,#f2a8cc,#e8758a)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:"white",fontWeight:700}}>
                        {(post._authorDisplay||post._author||"?")[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{fontSize:14,fontWeight:700,color:"#5c3d52"}}>{post._authorDisplay||`@${post._author}`}</div>
                        <div style={{fontSize:11,color:"#b07a9e"}}>@{post._author} · {new Date(post._publishedAt).toLocaleDateString("de-DE",{day:"numeric",month:"short"})}</div>
                      </div>
                    </div>
                    {/* Recipe visual placeholder */}
                    <div style={{background:"linear-gradient(135deg,#5c3d52,#8b6db8)",borderRadius:14,padding:20,textAlign:"center",marginBottom:0}}>
                      <div style={{fontSize:52,marginBottom:6}}>🍽️</div>
                      <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:"white",fontWeight:600}}>{post.name}</div>
                      <div style={{fontSize:12,color:"rgba(255,255,255,0.75)",marginTop:4}}>{post.ingredients?.length||0} Zutaten</div>
                    </div>
                  </div>
                  <div style={{padding:"14px 16px"}}>
                    {/* Macros */}
                    <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginBottom:14}}>
                      {[["kcal",Math.round(post.cal||0),"#f2a8cc"],["Prot.",Math.round(post.p||0)+"g","#a8d8ea"],["Koh.",Math.round(post.c||0)+"g","#e8c97e"],["Fett",Math.round(post.f||0)+"g","#b5d8a8"],["Bal.",Math.round(post.fi||0)+"g","#c8b0d8"]].map(([l,v,c])=>(
                        <div key={l} style={{textAlign:"center",background:"#fdf7f4",borderRadius:10,padding:"8px 4px"}}>
                          <div style={{fontSize:14,fontWeight:800,color:c}}>{v}</div>
                          <div style={{fontSize:10,color:"#b07a9e",marginTop:1}}>{l}</div>
                        </div>
                      ))}
                    </div>
                    {/* Ingredients */}
                    {post.ingredients&&post.ingredients.length>0&&(
                      <div style={{marginBottom:14}}>
                        <p style={{margin:"0 0 7px",fontSize:11,color:"#b07a9e",fontWeight:700,textTransform:"uppercase",letterSpacing:0.5}}>Zutaten</p>
                        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                          {post.ingredients.map((ing,i)=>(
                            <span key={i} style={{background:"#fdf7f4",borderRadius:99,padding:"4px 10px",fontSize:12,color:"#5c3d52",border:"1px solid #fce4f0"}}>
                              {ing.qty}{ing.unit==="Stück"?" Stk.":ing.unit==="ml"?"ml":"g"} {ing.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Save button */}
                    <button onClick={()=>saveFromFeed(post)}
                      style={{width:"100%",padding:"11px",background:alreadySaved?"#edf7ef":"linear-gradient(135deg,#f2a8cc,#e8758a)",border:"none",borderRadius:12,fontSize:14,fontWeight:700,color:alreadySaved?"#3a7a4a":"white",cursor:alreadySaved?"default":"pointer"}}>
                      {alreadySaved?"✓ Gespeichert":"+ Rezept speichern"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
          {/* Own published recipes */}
          {publicFeed.filter(p=>p._author===username).length>0&&(
            <div style={{marginTop:16}}>
              <p style={{margin:"0 0 10px",fontSize:12,color:"#b07a9e",fontWeight:700,textTransform:"uppercase",letterSpacing:0.5}}>Deine veröffentlichten Rezepte</p>
              {publicFeed.filter(p=>p._author===username).map(post=>(
                <div key={post._id} style={{background:"white",borderRadius:14,padding:12,marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center",boxShadow:"0 2px 8px rgba(242,168,204,0.1)"}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:"#5c3d52"}}>🍽️ {post.name}</div>
                    <div style={{fontSize:11,color:"#b07a9e"}}>{Math.round(post.cal||0)} kcal · {post.ingredients?.length||0} Zutaten</div>
                  </div>
                  <button onClick={()=>togglePublishRecipe(post)}
                    style={{padding:"6px 12px",background:"#fdeef1",border:"1.5px solid #f2a8cc",borderRadius:10,fontSize:12,fontWeight:600,color:"#e8758a",cursor:"pointer"}}>
                    Entfernen
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      </div>
    </div>
  );
}

// ─── PAYWALL SCREEN ───────────────────────────────────────────────────────────
function PaywallScreen({onClose,username,setSubscription,setShowPaywall}){
  const [selected,setSelected]=useState("monthly");
  const [loading,setLoading]=useState(false);
  const PLANS={
    monthly:{label:"Monatlich",price:"4,99 €",period:"/Monat",saving:null,stripe:"https://buy.stripe.com/glowtrack-monthly"},
    yearly:{label:"Jährlich",price:"39,99 €",period:"/Jahr",saving:"33% gespart",stripe:"https://buy.stripe.com/glowtrack-yearly"},
    couple:{label:"Pärchen",price:"6,99 €",period:"/Monat",saving:"2 Accounts",stripe:"https://buy.stripe.com/glowtrack-couple"},
  };
  async function simulateSubscribe(){
    // In production this redirects to Stripe. Here we simulate for demo.
    setLoading(true);
    await new Promise(r=>setTimeout(r,1200));
    const end=new Date();
    if(selected==="yearly") end.setFullYear(end.getFullYear()+1);
    else end.setMonth(end.getMonth()+1);
    const sub={plan:selected,status:"active",startDate:Date.now(),periodEnd:end.toISOString()};
    await storageSave(UK_SUB(username),sub);
    setSubscription(sub);
    setShowPaywall(false);
    setLoading(false);
  }
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(26,10,18,0.97)",zIndex:9000,display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"'DM Sans',sans-serif"}}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
      <div style={{maxWidth:420,width:"100%"}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:48,marginBottom:10,filter:"drop-shadow(0 0 20px rgba(242,168,204,0.4))"}}>🌸</div>
          <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:26,color:"white",margin:"0 0 8px"}}>Deine Testphase ist abgelaufen</h2>
          <p style={{color:"rgba(255,255,255,0.5)",fontSize:14,margin:0}}>Wähle ein Abo um GlowTrack weiter zu nutzen</p>
        </div>
        {/* Features */}
        <div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"center",marginBottom:24}}>
          {["📷 KI-Kameraanalyse","🌸 Zyklus-Tracking","💞 Family & Friends","📊 Tagesanalyse","🍽️ Unbegrenzte Rezepte","🔒 Daten sicher"].map(f=>(
            <span key={f} style={{background:"rgba(242,168,204,0.1)",borderRadius:99,padding:"5px 12px",fontSize:12,color:"rgba(255,255,255,0.7)",border:"1px solid rgba(242,168,204,0.2)"}}>{f}</span>
          ))}
        </div>
        {/* Plans */}
        <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
          {Object.entries(PLANS).map(([key,plan])=>(
            <button key={key} onClick={()=>setSelected(key)}
              style={{padding:"16px 18px",borderRadius:16,border:`2px solid ${selected===key?"#f2a8cc":"rgba(255,255,255,0.1)"}`,background:selected===key?"rgba(242,168,204,0.12)":"rgba(255,255,255,0.04)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",transition:"all 0.2s"}}>
              <div style={{textAlign:"left"}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:15,fontWeight:700,color:selected===key?"#f2a8cc":"white"}}>{plan.label}</span>
                  {plan.saving&&<span style={{background:"rgba(109,184,122,0.2)",borderRadius:99,padding:"2px 8px",fontSize:11,color:"#6db87a",fontWeight:700}}>{plan.saving}</span>}
                </div>
                <div style={{fontSize:12,color:"rgba(255,255,255,0.4)",marginTop:2}}>Jederzeit kündbar</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:20,fontWeight:800,color:"white"}}>{plan.price}</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>{plan.period}</div>
              </div>
            </button>
          ))}
        </div>
        <button onClick={simulateSubscribe} disabled={loading}
          style={{width:"100%",padding:"15px",background:loading?"rgba(242,168,204,0.2)":"linear-gradient(135deg,#f2a8cc,#e8758a)",border:"none",borderRadius:16,fontSize:16,fontWeight:700,color:"white",cursor:loading?"default":"pointer",marginBottom:12}}>
          {loading?"Verarbeite…":`${PLANS[selected].label}es Abo starten`}
        </button>
        <p style={{textAlign:"center",fontSize:11,color:"rgba(255,255,255,0.25)",margin:0,lineHeight:1.6}}>
          Zahlung über Stripe · SSL-verschlüsselt · DSGVO-konform<br/>
          Kündigung jederzeit möglich über Einstellungen
        </p>
      </div>
    </div>
  );
}

// ─── LEGAL SCREEN ─────────────────────────────────────────────────────────────
function LegalScreen({type,onClose}){
  const texts={
    imprint:`IMPRESSUM

Angaben gemäß § 5 ECG (Österreich) / § 5 TMG (Deutschland):

[PFLICHTFELD – Bitte vor Veröffentlichung ausfüllen]

Unternehmensname: [Dein Name / Firmenname]
Adresse: [Straße, Hausnummer, PLZ, Ort, Land]
E-Mail: [deine@email.com]
Telefon: [+43 / +49 / +41 ...]

Umsatzsteuer-ID (sofern vorhanden): [USt-ID]

Aufsichtsbehörde: [falls zutreffend]

Plattform der EU-Kommission zur Online-Streitbeilegung (OS):
https://ec.europa.eu/consumers/odr

HINWEIS: Dieses Impressum ist eine Vorlage und muss von einem Anwalt geprüft und vervollständigt werden, bevor die App öffentlich zugänglich gemacht wird.`,

    privacy:`DATENSCHUTZERKLÄRUNG (DSGVO-Vorlage)

Stand: Juni 2025

1. VERANTWORTLICHE PERSON
[Name, Adresse, E-Mail] – Datenschutzbeauftragter: [falls erforderlich]

2. ERHOBENE DATEN
Wir erheben folgende personenbezogene Daten:
• Benutzername, E-Mail-Adresse, Passwort (verschlüsselt)
• Körperdaten (Gewicht, Größe, Alter) – freiwillig
• Gesundheitsdaten (Zyklus, Ernährung) gemäß Art. 9 DSGVO – nur mit ausdrücklicher Einwilligung
• Nutzungsdaten (Analysezwecke, anonymisiert)

3. RECHTSGRUNDLAGEN (Art. 6 & 9 DSGVO)
• Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO) für das Nutzerkonto
• Einwilligung (Art. 6 Abs. 1 lit. a / Art. 9 Abs. 2 lit. a DSGVO) für Gesundheitsdaten
• Berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO) für Sicherheit und Betrieb

4. DATENWEITERGABE AN DRITTE
Daten werden NUR weitergegeben wenn:
a) Du ausdrücklich eingewilligt hast (Datenweitergabe für Forschung – Opt-in)
b) Gesetzliche Pflicht besteht
c) Auftragsverarbeitung (z.B. Hosting, Zahlungsabwicklung via Stripe)

ANONYMISIERUNG: Für Forschungszwecke werden Daten vollständig anonymisiert (kein Rückschluss auf Personen möglich) und nur in aggregierter Form weitergegeben. Ein Widerruf ist jederzeit möglich.

5. DATENSPEICHERUNG
Daten werden auf Servern innerhalb der EU gespeichert. Speicherdauer: bis zur Kontolöschung + 30 Tage gesetzliche Aufbewahrungsfrist.

6. DEINE RECHTE (Art. 15–22 DSGVO)
• Auskunft über gespeicherte Daten (Art. 15)
• Berichtigung unrichtiger Daten (Art. 16)
• Löschung ("Recht auf Vergessenwerden") (Art. 17)
• Einschränkung der Verarbeitung (Art. 18)
• Datenübertragbarkeit (Art. 20)
• Widerspruch gegen Verarbeitung (Art. 21)
• Widerruf von Einwilligungen (Art. 7 Abs. 3)

Anfragen an: [datenschutz@deineapp.com]
Beschwerden: Österreichische Datenschutzbehörde (dsb.gv.at)

7. GESUNDHEITSDATEN (Art. 9 DSGVO – besondere Kategorien)
Zyklus-, Menstruations- und Ernährungsdaten sind besonders sensible Gesundheitsdaten. Diese werden nur mit ausdrücklicher Einwilligung verarbeitet und NIEMALS ohne separate Einwilligung an Dritte weitergegeben.

⚠️ HINWEIS: Diese Datenschutzerklärung ist eine Vorlage. Vor Veröffentlichung MUSS sie von einem auf Datenschutzrecht spezialisierten Anwalt geprüft werden.`,

    terms:`ALLGEMEINE GESCHÄFTSBEDINGUNGEN (AGB) – VORLAGE

Stand: Juni 2025

§ 1 GELTUNGSBEREICH
Diese AGB gelten für die Nutzung der App „GlowTrack" (nachfolgend „App") zwischen dem Anbieter [Name/Firma] und dem Nutzer.

§ 2 VERTRAGSGEGENSTAND
GlowTrack ist eine digitale Wellness-App für Ernährungs- und Zyklus-Tracking. Die App ist kein Medizinprodukt und ersetzt keine ärztliche Beratung.

§ 3 REGISTRIERUNG & NUTZERKONTO
• Mindestalter: 16 Jahre
• Korrekte Angaben bei Registrierung erforderlich
• Zugangsdaten sind vertraulich zu halten

§ 4 TESTPHASE & ABONNEMENT
• 3 Tage kostenlose Testphase ab Registrierung
• Nach Ablauf: kostenpflichtiges Abo erforderlich
• Preise: Monatlich 4,99 € / Jährlich 39,99 € / Pärchen 6,99 €/Monat
• Alle Preise inkl. MwSt.
• Zahlung via Stripe (Kreditkarte, SEPA)
• Abrechnung: monatlich/jährlich im Voraus

§ 5 KÜNDIGUNG
• Monatliches Abo: Kündigung jederzeit zum Ende der Abrechnungsperiode
• Jahresabo: Kündigung bis 14 Tage vor Verlängerung
• Kündigung über: Einstellungen > Abo verwalten
• Kein Anspruch auf Rückerstattung für laufende Perioden (außer gesetzliches Widerrufsrecht)

§ 6 WIDERRUFSRECHT (EU-Verbraucherrecht)
Bei digitalen Inhalten besteht ein 14-tägiges Widerrufsrecht ab Vertragsschluss, sofern die Nutzung noch nicht begonnen hat. Mit Beginn der Nutzung erlischt das Widerrufsrecht (ausdrückliche Zustimmung erforderlich – wird bei Registrierung eingeholt).

§ 7 HAFTUNGSAUSSCHLUSS
Die App ersetzt keine medizinische Beratung. Für Schäden durch fehlerhafte Gesundheitseinschätzungen wird keine Haftung übernommen, soweit gesetzlich zulässig.

§ 8 DATENWEITERGABE FÜR FORSCHUNG
Sofern der Nutzer eingewilligt hat, können vollständig anonymisierte und aggregierte Nutzungsdaten für Forschungszwecke an Dritte weitergegeben werden. Die Einwilligung ist freiwillig und jederzeit widerrufbar.

§ 9 ANWENDBARES RECHT
Es gilt österreichisches Recht unter Ausschluss des UN-Kaufrechts. Verbraucher können auch vor den Gerichten ihres Wohnsitzmitgliedstaates klagen.

§ 10 STREITBEILEGUNG
EU-Streitschlichtungsplattform: https://ec.europa.eu/consumers/odr
Wir sind nicht verpflichtet, an einem Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.

⚠️ HINWEIS: Diese AGB sind eine Vorlage und müssen vor Veröffentlichung anwaltlich geprüft werden.`
  };

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(26,10,18,0.97)",zIndex:9999,display:"flex",flexDirection:"column",fontFamily:"'DM Sans',sans-serif"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 20px",borderBottom:"1px solid rgba(255,255,255,0.1)"}}>
        <h3 style={{margin:0,color:"white",fontSize:16,fontWeight:700}}>
          {type==="imprint"?"Impressum":type==="privacy"?"Datenschutzerklärung":"AGB"}
        </h3>
        <button onClick={onClose} style={{background:"rgba(255,255,255,0.1)",border:"none",borderRadius:99,width:32,height:32,cursor:"pointer",color:"white",fontSize:18}}>×</button>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"20px"}}>
        <pre style={{color:"rgba(255,255,255,0.7)",fontSize:12,lineHeight:1.8,whiteSpace:"pre-wrap",fontFamily:"inherit",margin:0}}>
          {texts[type]}
        </pre>
        <div style={{background:"rgba(232,193,126,0.15)",border:"1px solid rgba(232,193,126,0.3)",borderRadius:12,padding:"12px 16px",marginTop:20}}>
          <p style={{margin:0,fontSize:12,color:"rgba(232,193,126,0.9)",lineHeight:1.6}}>
            ⚠️ <strong>Wichtiger Hinweis:</strong> Alle rechtlichen Texte sind Vorlagen und müssen vor der öffentlichen Nutzung von einem auf österreichisches/deutsches Recht spezialisierten Anwalt geprüft und angepasst werden. Besonders die Datenschutzerklärung für Gesundheitsdaten (Art. 9 DSGVO) erfordert sorgfältige rechtliche Prüfung.
          </p>
        </div>
      </div>
    </div>
  );
}
