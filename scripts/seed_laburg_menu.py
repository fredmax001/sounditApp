#!/usr/bin/env python3
"""
Seed and update the master drink menu into the drink_items table.
Includes all LA BURG + We bar liquor items with We bar bottle prices,
and sets all liquor bottles to come with 4 mixers included.

Usage:
    python scripts/seed_laburg_menu.py
    python scripts/seed_laburg_menu.py --user-id 3    # target a specific user ID
    python scripts/seed_laburg_menu.py --all-orgs     # update/seed all organizers with master menus
    python scripts/seed_laburg_menu.py --dry-run      # preview without writing
"""

import sys
import os
import argparse

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from models import DrinkItem, User

MIXERS = ["Red Bull", "Tonic Water", "Cola", "Soda Water", "Juice"]

LIQUOR_CATEGORIES = {
    "brandy", "whiskey", "bourbon", "japanese_whiskey",
    "vodka", "gin", "rum", "tequila", "liqueur",
}

# ---------------------------------------------------------------------------
# Full Master Drink Menu
# All Liquor items use We bar bottle prices and include 4 mixers.
# ---------------------------------------------------------------------------
LABURG_MENU = [
    # ---- Cocktails 鸡尾酒 ----
    dict(name="Gin Tonic",           category="cocktail_classic", price=50, description="Classic gin & tonic", supports_mixers=False),
    dict(name="Long Island Ice Tea", category="cocktail_classic", price=60, description="Long Island Ice Tea", supports_mixers=False),
    dict(name="Blue Margarita",      category="cocktail_classic", price=50, description="Blue Margarita", supports_mixers=False),
    dict(name="Mojito",              category="cocktail_classic", price=60, description="Classic Mojito", supports_mixers=False),
    dict(name="Cuba Libre",          category="cocktail_classic", price=50, description="Cuba Libre (Rum & Cola)", supports_mixers=False),
    dict(name="Whisky Coke",         category="cocktail_classic", price=50, description="Whisky & Coke", supports_mixers=False),
    dict(name="Screwdriver",         category="cocktail_classic", price=50, description="Vodka & Orange Juice", supports_mixers=False),
    dict(name="Tequila Sunrise",     category="cocktail_classic", price=50, description="Tequila Sunrise", supports_mixers=False),
    dict(name="Pina Colada",         category="cocktail_classic", price=50, description="Pina Colada", supports_mixers=False),
    dict(name="Sex on the Beach",    category="cocktail_classic", price=50, description="Sex on the Beach", supports_mixers=False),
    dict(name="Moscow Mule",         category="cocktail_classic", price=50, description="Vodka, Ginger Beer & Lime", supports_mixers=False),
    dict(name="Old Fashioned",       category="cocktail_classic", price=30, description="Old Fashioned", supports_mixers=False),
    dict(name="Black Russian",       category="cocktail_classic", price=50, description="Vodka & Kahlua", supports_mixers=False),
    dict(name="White Russian",       category="cocktail_classic", price=50, description="Vodka, Kahlua & Cream", supports_mixers=False),

    # ---- Shots 一口酒 ----
    dict(name="Jagermeister Shot",   category="shot", price=20, description="¥120/6 · ¥200/12", supports_mixers=False),
    dict(name="Tequila Shot",        category="shot", price=44, description="¥260/6 · ¥428/12", supports_mixers=False),
    dict(name="B52 Shot",            category="shot", price=25, description="¥150/6 · ¥280/12", supports_mixers=False),
    dict(name="Captain Morgan Shot", category="shot", price=20, description="¥120/6 · ¥220/12", supports_mixers=False),
    dict(name="Spring Bok Shot",     category="shot", price=25, description="¥150/6 · ¥280/12", supports_mixers=False),

    # ---- Special South Africa Beers 南非特供啤酒 ----
    dict(name="Savana Dry",          category="beer_bottle", price=50, description="South African cider — also ¥280/6pk · ¥500/12pk", supports_mixers=False),
    dict(name="Hunters Dry",         category="beer_bottle", price=50, description="South African cider — also ¥280/6pk · ¥500/12pk", supports_mixers=False),
    dict(name="Hunters Gold",        category="beer_bottle", price=50, description="South African cider — also ¥280/6pk · ¥500/12pk", supports_mixers=False),

    # ---- Beers 啤酒 ----
    dict(name="Corona 330ml",        category="beer_bottle", price=40, description="Corona Extra 330ml", supports_mixers=False),
    dict(name="Heineken 330ml",      category="beer_bottle", price=40, description="Heineken 330ml", supports_mixers=False),
    dict(name="Hoegaarden 330ml",    category="beer_bottle", price=40, description="Hoegaarden White 330ml", supports_mixers=False),

    # ---- Draft Beers 生啤 ----
    dict(name="Qingdao Lager 500ml", category="beer_draft", price=50, description="Qingdao draught lager 500ml", supports_mixers=False),
    dict(name="Amstel Lager",        category="beer_draft", price=50, description="Amstel draught lager", supports_mixers=False),

    # ---- Vodka 伏特加 (We bar prices, 4 mixers included) ----
    dict(name="SKYY Vodka",          category="vodka", price=680,  description="¥680/bottle · ¥55/glass — 蓝天伏特加 (4 mixers included)", supports_mixers=True,
         allowed_mixers=MIXERS, mixer_included_qty=4, mixer_extra_price=10),
    dict(name="Absolut Vodka",       category="vodka", price=680,  description="¥680/bottle · ¥55/glass — 绝对伏特加 (4 mixers included)", supports_mixers=True,
         allowed_mixers=MIXERS, mixer_included_qty=4, mixer_extra_price=10),
    dict(name="Grey Goose",          category="vodka", price=1180, description="¥1180/bottle — 灰雁伏特加 (4 mixers included)", supports_mixers=True,
         allowed_mixers=MIXERS, mixer_included_qty=4, mixer_extra_price=10),

    # ---- Gin 金酒 (We bar prices, 4 mixers included) ----
    dict(name="Bombay Sapphire",         category="gin", price=680, description="¥680/bottle · ¥55/glass — 孟买蓝宝石 (4 mixers included)", supports_mixers=True,
         allowed_mixers=MIXERS, mixer_included_qty=4, mixer_extra_price=10),
    dict(name="Hendrick's Gin",          category="gin", price=880, description="¥880/bottle · ¥65/glass — 亨利爵士 (4 mixers included)", supports_mixers=True,
         allowed_mixers=MIXERS, mixer_included_qty=4, mixer_extra_price=10),
    dict(name="Gordon's London Dry Gin", category="gin", price=680, description="¥680/bottle (4 mixers included)", supports_mixers=True,
         allowed_mixers=MIXERS, mixer_included_qty=4, mixer_extra_price=10),

    # ---- Rum 朗姆酒 (We bar prices, 4 mixers included) ----
    dict(name="Myers's Dark Rum",           category="rum", price=680,  description="¥680/bottle · ¥65/glass — 美雅士黑朗姆酒 (4 mixers included)", supports_mixers=True,
         allowed_mixers=MIXERS, mixer_included_qty=4, mixer_extra_price=10),
    dict(name="Zacapa 23",                  category="rum", price=1480, description="¥1480/bottle — 萨卡帕23年 (4 mixers included)", supports_mixers=True,
         allowed_mixers=MIXERS, mixer_included_qty=4, mixer_extra_price=10),
    dict(name="Captain Morgan Spiced Gold", category="rum", price=680,  description="¥680/bottle (4 mixers included)", supports_mixers=True,
         allowed_mixers=MIXERS, mixer_included_qty=4, mixer_extra_price=10),
    dict(name="Captain Morgan Dark Rum",    category="rum", price=680,  description="¥680/bottle (4 mixers included)", supports_mixers=True,
         allowed_mixers=MIXERS, mixer_included_qty=4, mixer_extra_price=10),
    dict(name="Captain Morgan White Rum",   category="rum", price=680,  description="¥680/bottle (4 mixers included)", supports_mixers=True,
         allowed_mixers=MIXERS, mixer_included_qty=4, mixer_extra_price=10),

    # ---- Cognac & Brandy 白兰地 (We bar prices, 4 mixers included) ----
    dict(name="Hennessy VSOP",       category="brandy", price=1280, description="¥1280/bottle — 轩尼诗VSOP (4 mixers included)", supports_mixers=True,
         allowed_mixers=MIXERS, mixer_included_qty=4, mixer_extra_price=10),
    dict(name="Hennessy XO",         category="brandy", price=3980, description="¥3980/bottle — 轩尼诗XO (4 mixers included)", supports_mixers=True,
         allowed_mixers=MIXERS, mixer_included_qty=4, mixer_extra_price=10),
    dict(name="Martell Cordon Bleu", category="brandy", price=2800, description="¥2800/bottle — 马爹利蓝带 (4 mixers included)", supports_mixers=True,
         allowed_mixers=MIXERS, mixer_included_qty=4, mixer_extra_price=10),
    dict(name="Martell Noblige",     category="brandy", price=1380, description="¥1380/bottle — 马爹利名士 (4 mixers included)", supports_mixers=True,
         allowed_mixers=MIXERS, mixer_included_qty=4, mixer_extra_price=10),
    dict(name="Martell XO",          category="brandy", price=3880, description="¥3880/bottle — 马爹利XO (4 mixers included)", supports_mixers=True,
         allowed_mixers=MIXERS, mixer_included_qty=4, mixer_extra_price=10),
    dict(name="KWV 5 Years",         category="brandy", price=680,  description="¥680/bottle (4 mixers included)", supports_mixers=True,
         allowed_mixers=MIXERS, mixer_included_qty=4, mixer_extra_price=10),
    dict(name="KWV 10 Years",        category="brandy", price=780,  description="¥780/bottle (4 mixers included)", supports_mixers=True,
         allowed_mixers=MIXERS, mixer_included_qty=4, mixer_extra_price=10),

    # ---- Whisky & Single Malt 威士忌 / 单一麦芽 (We bar prices, 4 mixers included) ----
    dict(name="Johnnie Walker Black Label",        category="whiskey", price=680,  description="¥680/bottle · ¥50/glass — 黑方12年 (4 mixers included)", supports_mixers=True,
         allowed_mixers=MIXERS, mixer_included_qty=4, mixer_extra_price=10),
    dict(name="Jameson Irish Whiskey",             category="whiskey", price=780,  description="¥780/bottle · ¥60/glass — 爱尔兰占美醇 (4 mixers included)", supports_mixers=True,
         allowed_mixers=MIXERS, mixer_included_qty=4, mixer_extra_price=10),
    dict(name="Chivas Regal 12 Years",             category="whiskey", price=680,  description="¥680/bottle — 芝华士12年 (4 mixers included)", supports_mixers=True,
         allowed_mixers=MIXERS, mixer_included_qty=4, mixer_extra_price=10),
    dict(name="Johnnie Walker Red Label",          category="whiskey", price=680,  description="¥680/bottle — 红方 (4 mixers included)", supports_mixers=True,
         allowed_mixers=MIXERS, mixer_included_qty=4, mixer_extra_price=10),
    dict(name="Johnnie Walker Gold Label",         category="whiskey", price=1380, description="¥1380/bottle — 金方 (4 mixers included)", supports_mixers=True,
         allowed_mixers=MIXERS, mixer_included_qty=4, mixer_extra_price=10),
    dict(name="Johnnie Walker Blue Label",         category="whiskey", price=2580, description="¥2580/bottle — 蓝方 (4 mixers included)", supports_mixers=True,
         allowed_mixers=MIXERS, mixer_included_qty=4, mixer_extra_price=10),
    dict(name="Talisker 10 Years",                 category="whiskey", price=980,  description="¥980/bottle · ¥70/glass — 泰斯卡10年 Single Malt (4 mixers included)", supports_mixers=True,
         allowed_mixers=MIXERS, mixer_included_qty=4, mixer_extra_price=10),
    dict(name="Jura 10 Years",                     category="whiskey", price=980,  description="¥980/bottle · ¥70/glass — 朱拉小岛10年 Single Malt (4 mixers included)", supports_mixers=True,
         allowed_mixers=MIXERS, mixer_included_qty=4, mixer_extra_price=10),
    dict(name="Glenfiddich 12 Years",              category="whiskey", price=1080, description="¥1080/bottle · ¥75/glass — 格兰菲迪12年 Single Malt (4 mixers included)", supports_mixers=True,
         allowed_mixers=MIXERS, mixer_included_qty=4, mixer_extra_price=10),
    dict(name="Laphroaig 10 Years",                category="whiskey", price=1180, description="¥1180/bottle · ¥80/glass — 拉弗格10年 Single Malt (4 mixers included)", supports_mixers=True,
         allowed_mixers=MIXERS, mixer_included_qty=4, mixer_extra_price=10),
    dict(name="Macallan 12 Years",                 category="whiskey", price=1280, description="¥1280/bottle · ¥90/glass — 麦卡伦双桶12年 Single Malt (4 mixers included)", supports_mixers=True,
         allowed_mixers=MIXERS, mixer_included_qty=4, mixer_extra_price=10),
    dict(name="Glenlivet 12 Years",                category="whiskey", price=1280, description="¥1280/bottle · ¥90/glass — 格兰威特12年 Single Malt (4 mixers included)", supports_mixers=True,
         allowed_mixers=MIXERS, mixer_included_qty=4, mixer_extra_price=10),
    dict(name="Auchentoshan 18 Years",             category="whiskey", price=1680, description="¥1680/bottle — 欧肯特轩18年 Single Malt (4 mixers included)", supports_mixers=True,
         allowed_mixers=MIXERS, mixer_included_qty=4, mixer_extra_price=10),
    dict(name="Glenmorangie Sherry Cask 12 Years", category="whiskey", price=980,  description="¥980/bottle · ¥70/glass — 格兰杰12年 Single Malt (4 mixers included)", supports_mixers=True,
         allowed_mixers=MIXERS, mixer_included_qty=4, mixer_extra_price=10),
    dict(name="Glenfarclas 12 Years 1L",           category="whiskey", price=980,  description="¥980/bottle · ¥70/glass — 格兰花格12年 1L Single Malt (4 mixers included)", supports_mixers=True,
         allowed_mixers=MIXERS, mixer_included_qty=4, mixer_extra_price=10),
    dict(name="Dalmore 12 Years",                  category="whiskey", price=1680, description="¥1680/bottle — 达摩12年 Single Malt (4 mixers included)", supports_mixers=True,
         allowed_mixers=MIXERS, mixer_included_qty=4, mixer_extra_price=10),
    dict(name="Ardbeg 10 Years",                   category="whiskey", price=1280, description="¥1280/bottle · ¥80/glass — 阿德贝哥10年 Single Malt (4 mixers included)", supports_mixers=True,
         allowed_mixers=MIXERS, mixer_included_qty=4, mixer_extra_price=10),
    dict(name="The Balvenie DoubleWood 12 Years",  category="whiskey", price=1580, description="¥1580/bottle — 百富12年双桶 Single Malt (4 mixers included)", supports_mixers=True,
         allowed_mixers=MIXERS, mixer_included_qty=4, mixer_extra_price=10),
    dict(name="The Balvenie Single Barrel 12 Years", category="whiskey", price=2680, description="¥2680/bottle — 百富12年单桶 Single Malt (4 mixers included)", supports_mixers=True,
         allowed_mixers=MIXERS, mixer_included_qty=4, mixer_extra_price=10),
    dict(name="The Balvenie Sherry Cask 15 Years", category="whiskey", price=3880, description="¥3880/bottle — 百富15年雪莉桶 Single Malt (4 mixers included)", supports_mixers=True,
         allowed_mixers=MIXERS, mixer_included_qty=4, mixer_extra_price=10),

    # ---- Bourbon 波本 (We bar prices, 4 mixers included) ----
    dict(name="Jack Daniel's",                     category="whiskey", price=680,  description="¥680/bottle · ¥50/glass — 杰克丹尼 (4 mixers included)", supports_mixers=True,
         allowed_mixers=MIXERS, mixer_included_qty=4, mixer_extra_price=10),
    dict(name="Wild Turkey",                       category="bourbon", price=780,  description="¥780/bottle · ¥60/glass — 威凤凰波本 (4 mixers included)", supports_mixers=True,
         allowed_mixers=MIXERS, mixer_included_qty=4, mixer_extra_price=10),
    dict(name="Maker's Mark",                      category="bourbon", price=980,  description="¥980/bottle · ¥80/glass — 美格波本 (4 mixers included)", supports_mixers=True,
         allowed_mixers=MIXERS, mixer_included_qty=4, mixer_extra_price=10),
    dict(name="Jim Beam",                          category="whiskey", price=680,  description="¥680/bottle — 占边波本 (4 mixers included)", supports_mixers=True,
         allowed_mixers=MIXERS, mixer_included_qty=4, mixer_extra_price=10),

    # ---- Japanese Whisky 日威 (We bar prices, 4 mixers included) ----
    dict(name="Yamazaki 1923",                     category="japanese_whiskey", price=2880, description="¥2880/bottle — 山崎1923 (4 mixers included)", supports_mixers=True,
         allowed_mixers=MIXERS, mixer_included_qty=4, mixer_extra_price=10),
    dict(name="Hibiki",                            category="japanese_whiskey", price=2680, description="¥2680/bottle — HIBIKI響 (4 mixers included)", supports_mixers=True,
         allowed_mixers=MIXERS, mixer_included_qty=4, mixer_extra_price=10),

    # ---- Tequila 龙舌兰 (We bar prices, 4 mixers included) ----
    dict(name="Olmeca Golden",      category="tequila", price=680, description="¥680/bottle · ¥55/glass — 奥美加金龙舌兰 (4 mixers included)", supports_mixers=True,
         allowed_mixers=MIXERS, mixer_included_qty=4, mixer_extra_price=10),
    dict(name="1800 Silver",        category="tequila", price=780, description="¥780/bottle · ¥65/glass — 典藏1800银 (4 mixers included)", supports_mixers=True,
         allowed_mixers=MIXERS, mixer_included_qty=4, mixer_extra_price=10),
    dict(name="1800 Gold",          category="tequila", price=780, description="¥780/bottle — 典藏1800金 (4 mixers included)", supports_mixers=True,
         allowed_mixers=MIXERS, mixer_included_qty=4, mixer_extra_price=10),
    dict(name="Jose Cuervo Gold",   category="tequila", price=680, description="¥680/bottle (4 mixers included)", supports_mixers=True,
         allowed_mixers=MIXERS, mixer_included_qty=4, mixer_extra_price=10),
    dict(name="Jose Cuervo Silver", category="tequila", price=680, description="¥680/bottle (4 mixers included)", supports_mixers=True,
         allowed_mixers=MIXERS, mixer_included_qty=4, mixer_extra_price=10),
    dict(name="Camino Real Gold",   category="tequila", price=680, description="¥680/bottle (4 mixers included)", supports_mixers=True,
         allowed_mixers=MIXERS, mixer_included_qty=4, mixer_extra_price=10),
    dict(name="Camino Real Silver", category="tequila", price=680, description="¥680/bottle (4 mixers included)", supports_mixers=True,
         allowed_mixers=MIXERS, mixer_included_qty=4, mixer_extra_price=10),

    # ---- Champagne 香槟 ----
    dict(name="Moët & Chandon",  category="champagne", price=1680, description="¥1680/bottle", supports_mixers=False),

    # ---- Liqueurs 力娇酒 (We bar standard bottle prices, 4 mixers included) ----
    dict(name="Jagermeister",     category="liqueur", price=680, description="¥680/bottle (4 mixers included)", supports_mixers=True,
         allowed_mixers=MIXERS, mixer_included_qty=4, mixer_extra_price=10),
    dict(name="AMARULA",          category="liqueur", price=680, description="¥680/bottle (4 mixers included)", supports_mixers=True,
         allowed_mixers=MIXERS, mixer_included_qty=4, mixer_extra_price=10),
    dict(name="Baileys Original", category="liqueur", price=680, description="¥680/bottle (4 mixers included)", supports_mixers=True,
         allowed_mixers=MIXERS, mixer_included_qty=4, mixer_extra_price=10),

    # ---- Water & Soft Drinks 水和饮料 ----
    dict(name="Coca-Cola",              category="soft", price=25, description="Regular Coca-Cola", supports_mixers=False),
    dict(name="Coca-Cola Zero Sugar",   category="soft", price=25, description="Sugar-free Coke", supports_mixers=False),
    dict(name="Sprite",                 category="soft", price=25, description="Sprite", supports_mixers=False),
    dict(name="Soda Water",             category="soft", price=25, description="Soda Water", supports_mixers=False),
    dict(name="Tonic Water",            category="soft", price=25, description="Tonic Water", supports_mixers=False),
    dict(name="Ginger Ale",             category="soft", price=25, description="Ginger Ale", supports_mixers=False),
    dict(name="Evian Mineral Water",    category="soft", price=25, description="Evian still mineral water", supports_mixers=False),
    dict(name="Orange Juice",           category="soft", price=35, description="Fresh orange juice", supports_mixers=False),
    dict(name="Apple Juice",            category="soft", price=35, description="Apple juice", supports_mixers=False),
    dict(name="Pineapple Juice",        category="soft", price=35, description="Pineapple juice", supports_mixers=False),

    # ---- Coffee & Tea 咖啡和茶 ----
    dict(name="Espresso",        category="coffee", price=25, description="Single espresso", supports_mixers=False),
    dict(name="Americano",       category="coffee", price=30, description="Americano coffee", supports_mixers=False),
    dict(name="Café Latte",      category="coffee", price=35, description="Milk latte", supports_mixers=False),
    dict(name="Cappuccino",      category="coffee", price=35, description="Cappuccino", supports_mixers=False),
    dict(name="Café Mocha",      category="coffee", price=35, description="Mocha coffee", supports_mixers=False),
    dict(name="Hot Chocolate",   category="coffee", price=35, description="Hot chocolate", supports_mixers=False),
    dict(name="Rooibos Tea",     category="tea",    price=25, description="South African rooibos tea", supports_mixers=False),
    dict(name="Black Tea",       category="tea",    price=25, description="Black tea", supports_mixers=False),

    # ---- White Wine 白葡萄酒 ----
    dict(name="Sauvignon Blanc",              category="wine", price=68,  description="¥68 glass · ¥228 bottle", supports_mixers=False),

    # ---- Sparkling Wine 起泡酒 ----
    dict(name="Moscato Sparkling 2017",       category="wine", price=188, description="¥188/bottle — Sparkling", supports_mixers=False),
    dict(name="Sauvignon Blanc Sparkling",    category="wine", price=228, description="¥228/bottle — Sparkling", supports_mixers=False),

    # ---- Red Wine 红葡萄酒 ----
    dict(name="LA BURG Classic",              category="wine", price=48,  description="¥48 glass · ¥168 bottle — Red Wine", supports_mixers=False),
    dict(name="LA BURG Gold",                 category="wine", price=58,  description="¥58 glass · ¥188 bottle — Red Wine", supports_mixers=False),
    dict(name="LA BURG Yourko",               category="wine", price=58,  description="¥58 glass · ¥188 bottle — Red Wine", supports_mixers=False),
    dict(name="LA BURG 1031 SYRAH",           category="wine", price=98,  description="¥98 glass · ¥388 bottle — Red Wine", supports_mixers=False),
    dict(name="Rupert & Rothschild Merlot-Cab Sauv", category="wine", price=96, description="¥96 glass · ¥336 bottle — Red Wine", supports_mixers=False),
    dict(name="LA BURG Platinum Cab Sauv",    category="wine", price=98,  description="¥98 glass · ¥338 bottle — Red Wine", supports_mixers=False),
]


def seed(user_id: int, dry_run: bool, db, update_existing: bool = True):
    existing = db.query(DrinkItem).filter(DrinkItem.business_id == user_id, DrinkItem.event_id == None).all()
    existing_by_name = {i.name.strip().lower(): i for i in existing}
    print(f"Found {len(existing)} existing master items for user_id={user_id}")

    added = 0
    updated = 0
    skipped = 0
    for raw_item in LABURG_MENU:
        item = dict(raw_item)
        key = item["name"].strip().lower()
        allowed = item.pop("allowed_mixers", [])
        mixer_included_qty = item.pop("mixer_included_qty", 0)
        mixer_extra_price = item.pop("mixer_extra_price", 0)

        if key in existing_by_name:
            if update_existing:
                rec = existing_by_name[key]
                changed = False
                if rec.price != item["price"]:
                    rec.price = item["price"]
                    changed = True
                if rec.category != item["category"]:
                    rec.category = item["category"]
                    changed = True
                if rec.description != item["description"]:
                    rec.description = item["description"]
                    changed = True
                if rec.supports_mixers != item["supports_mixers"]:
                    rec.supports_mixers = item["supports_mixers"]
                    changed = True
                if (rec.allowed_mixers or []) != (allowed or []):
                    rec.allowed_mixers = allowed if allowed else []
                    changed = True
                if (rec.mixer_included_qty or 0) != mixer_included_qty:
                    rec.mixer_included_qty = mixer_included_qty
                    changed = True
                if (rec.mixer_extra_price or 0) != mixer_extra_price:
                    rec.mixer_extra_price = mixer_extra_price
                    changed = True
                if changed:
                    print(f"  ~ UPDATE: {item['name']} ({item['category']}) -> ¥{item['price']} (mixers={mixer_included_qty})")
                    updated += 1
                else:
                    skipped += 1
            else:
                skipped += 1
            continue

        if dry_run:
            print(f"  [DRY RUN] would insert: {item['name']} ({item['category']}) ¥{item['price']} (mixers={mixer_included_qty})")
            added += 1
            continue

        drink = DrinkItem(
            business_id=user_id,
            event_id=None,
            is_active=True,
            allowed_mixers=allowed if allowed else [],
            mixer_included_qty=mixer_included_qty,
            mixer_extra_price=mixer_extra_price,
            **item,
        )
        db.add(drink)
        print(f"  + INSERT: {item['name']} ({item['category']}) ¥{item['price']} (mixers={mixer_included_qty})")
        added += 1

    # Also ensure any other custom liquor items owned by this user have 4 mixers included
    for rec in existing:
        if rec.category in LIQUOR_CATEGORIES:
            if not rec.supports_mixers or (rec.mixer_included_qty or 0) != 4:
                rec.supports_mixers = True
                rec.mixer_included_qty = 4
                if not rec.allowed_mixers:
                    rec.allowed_mixers = MIXERS
                if not rec.mixer_extra_price:
                    rec.mixer_extra_price = 10

    if not dry_run:
        db.commit()

    print(f"\n{'[DRY RUN] ' if dry_run else ''}Done for user_id={user_id} — {added} inserted, {updated} updated, {skipped} unchanged.")


def main():
    parser = argparse.ArgumentParser(description="Seed and update LA BURG + We bar drink menu")
    parser.add_argument("--user-id", type=int, default=None, help="Target organizer user ID")
    parser.add_argument("--all-orgs", action="store_true", help="Seed/update all organizers who have master items (plus 3 and 90)")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        if args.all_orgs:
            uids = {r[0] for r in db.query(DrinkItem.business_id).distinct().all() if r[0]}
            uids.update([3, 90])
            for uid in sorted(uids):
                u = db.query(User).filter(User.id == uid).first()
                if u:
                    seed(uid, args.dry_run, db, update_existing=True)
        elif args.user_id:
            seed(args.user_id, args.dry_run, db, update_existing=True)
        else:
            user = db.query(User).filter(User.role.in_(["organizer", "business"])).first()
            if not user:
                user = db.query(User).filter(User.id == 1).first()
            if not user:
                print("ERROR: No organizer/business user found. Pass --user-id explicitly.")
                sys.exit(1)
            print(f"Targeting user: {user.email} (id={user.id}, role={user.role})")
            seed(user.id, args.dry_run, db, update_existing=True)
    finally:
        db.close()


if __name__ == "__main__":
    main()
