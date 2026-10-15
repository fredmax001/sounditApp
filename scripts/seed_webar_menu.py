#!/usr/bin/env python3
"""Transcribe the supplied WE BAR menu (组合 5.pdf, image-only) into the drink_items
table via the import/confirm endpoint. Convention: bottle price = item price
("杯/瓶 X/Y" glass/bottle prices -> bottle price, glass price in description).
Transcribed from the 10-page menu file supplied by the owner; organizer can
edit prices/items in the Drinks tab afterwards."""
import sys, os, json, urllib.request
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

BASE = 'http://localhost:8000/api/v1'
import requests

def login(email, pw):
    r = requests.post(f'{BASE}/auth/login', json={'email': email, 'password': pw}, timeout=30)
    r.raise_for_status()
    return r.json()['access_token']

def b(cat, name, bottle, glass=None, desc='', mixers=None, included=0):
    d = desc or (f'Glass ¥{glass} / bottle ¥{bottle}' if glass else '')
    return {
        'name': name, 'category': cat, 'price': float(bottle), 'description': d or None,
        'supports_mixers': bool(mixers), 'allowed_mixers': mixers or None,
        'mixer_included_qty': included if mixers else 0, 'mixer_extra_price': 0,
    }

MIX = ['Red Bull', 'Tonic Water', 'Schweppes', 'Cola', 'Soda Water', 'Ginger Ale']

items = [
    # Signature cocktails (¥88 / ¥98)
    b('cocktail_signature', 'WEWE 桂花金酒', 88, desc='Gin, jasmine syrup, egg white, lemon juice'),
    b('cocktail_signature', '梅法克制自己', 88, desc='Whiskey, plum liqueur, grapefruit juice, passion fruit'),
    b('cocktail_signature', '原来是你', 88, desc='Flavour vodka, fragon syrup, lemon, bitters'),
    b('cocktail_signature', '我想要占据你', 88, desc='Brandy, campari, vermouth Rosso, kahlua'),
    b('cocktail_signature', '果然就是你', 88, desc='Rum, melon liqueur, triple sec, lime'),
    b('cocktail_signature', '我以为你不会出现', 98, desc='Vodka, chambord liqueur, lemon juice'),
    b('cocktail_signature', '翩翩是你', 98, desc='Gin, lavender liqueur, butterfly tea, lavender syrup'),
    b('cocktail_signature', '一念之间', 98, desc='Whiskey, montenegro, aperol, lemon juice'),
    b('cocktail_signature', '全部都是你', 98, desc='Gin, mango, pineapple, vanilla'),
    b('cocktail_signature', '开往早晨的午夜', 98, desc='Rum, passion fruit, black rum, mint'),
    # Classic cocktails
    b('cocktail_classic', 'Daiquiri 大吉利', 68, desc='Rum, lime juice, sugar'),
    b('cocktail_classic', 'Pina Colada 椰林飘香', 68, desc='Rum, Malibu, coconut milk, pineapple juice'),
    b('cocktail_classic', 'Cosmopolitan 大都会', 68, desc='Vodka, Cointreau, cranberry, lemon juice'),
    b('cocktail_classic', 'Whiskey Sour 威士忌酸', 78, desc='Whiskey, lemon juice, sugar'),
    b('cocktail_classic', 'Negroni 内格罗尼', 88, desc='Gin, campari, vermouth Rosso'),
    b('cocktail_classic', 'Old Fashioned 古典', 88, desc='Bourbon whiskey, bitter, sugar cube'),
    b('cocktail_classic', 'Black Godfather 教父', 88, desc='Whiskey, Disaronno, bitter'),
    b('cocktail_classic', 'Long Island Ice Tea 长岛冰茶', 88, desc='Gin, vodka, rum, tequila, triple sec, coke'),
    # Mocktails
    b('mocktail', 'Sweetheart 浆果甜心', 58, desc='Cranberry, strawberry, apple, lemon'),
    b('mocktail', 'Cinderella 灰姑娘', 58, desc='Passion fruit, orange juice, lemon, soda'),
    # Coffee / tea / juice
    b('coffee', 'Espresso 浓缩', 25), b('coffee', 'Americano 美式', 25),
    b('coffee', 'Flat White 澳白', 28), b('coffee', 'Latte 拿铁', 30),
    b('coffee', 'Coconut Latte 生椰拿铁', 32), b('coffee', 'Coconut Americano 椰青美式', 35),
    b('coffee', 'Orange Americano 冰橙美式', 35), b('coffee', 'Rose Sea Salt Latte 玫瑰海盐拿铁', 38),
    b('non_alcoholic', 'Coconut Water 冰酷椰子水', 28), b('non_alcoholic', 'Matcha Latte 抹茶拿铁', 28),
    b('tea', 'Lychee Jasmine Kombucha 荔枝茉莉康普茶', 48),
    b('tea', 'Pineapple Lavender Kombucha 菠萝薰衣草康普茶', 48),
    b('tea', 'Pomelo Mint Kombucha 蜜柚薄荷康普茶', 48),
    b('tea', 'Green Tea 西湖龙井 (pot)', 45, desc='¥25 per cup / ¥45 per pot'),
    b('tea', 'Jasmine Tea 茉莉花茶 (pot)', 45, desc='¥25 per cup / ¥45 per pot'),
    b('juice', 'Fresh Orange/Apple/Pear Juice 鲜榨果汁', 36, desc='Orange, apple or pear — can be mixed'),
    b('juice', 'Berry Blush 莓来眼去', 38, desc='Pear, melon, strawberry, raspberry'),
    b('juice', 'No-Banana Green 禁止蕉绿', 46, desc='Avocado, spinach, ice cream, coconut'),
    # Beer
    b('beer_craft', 'German Style Wheat 德式小麦 (500ml)', 30, desc='1.25L ¥68 / 3L ¥168'),
    b('beer_craft', 'Longjing Lager 龙井拉格 (500ml)', 35, desc='1.25L ¥88 / 3L ¥188'),
    b('beer_craft', 'Asahi Super Dry 朝日 (500ml)', 38, desc='1.25L ¥98 / 3L ¥198'),
    b('beer_craft', 'IPA 印度单色艾尔 (500ml)', 48, desc='1.25L ¥118 / 3L ¥268'),
    b('beer_bottle', 'Tsingtao 金青岛 (296ml)', 25),
    b('beer_bottle', 'Corona 科罗纳 (300ml)', 28),
    b('beer_bottle', 'Guinness 健力士黑啤 (440ml)', 30),
    b('beer_bottle', 'Ayinger 艾英格小麦 (500ml)', 55),
    b('beer_bottle', 'Warsteiner 沃斯坦无醇 (330ml)', 28),
    # Whiskey / single malt
    b('whiskey', 'Black Label 12Y 尊尼获加黑牌', 680, glass=50, mixers=MIX, included=4),
    b('whiskey', 'Jameson 爱尔兰占美醇', 780, glass=60, mixers=MIX, included=4),
    b('whiskey', 'Talisker 10Y 泰斯卡 (Skye)', 980, glass=70, mixers=MIX, included=4),
    b('whiskey', 'Jura 10Y 朱拉小岛', 980, glass=70, mixers=MIX, included=4),
    b('whiskey', 'Glenfiddich 12Y 格兰菲迪', 1080, glass=75, mixers=MIX, included=4),
    b('whiskey', 'Laphroaig 10Y 拉弗格 (Islay)', 1180, glass=80, mixers=MIX, included=4),
    b('whiskey', 'Macallan Double Cask 12Y 麦卡伦', 1280, glass=90, mixers=MIX, included=4),
    b('whiskey', 'Glenlivet 12Y 格兰威特 (Speyside)', 1280, glass=90, mixers=MIX, included=4),
    b('whiskey', 'Auchentoshan 18Y 欧肯特轩 (Lowland)', 1680, mixers=MIX, included=4),
    b('whiskey', 'Glenmorangie Sherry Cask 12Y 格兰杰', 980, glass=70, mixers=MIX, included=4),
    b('whiskey', 'Glenfarclas 12Y 1L 格兰花格', 980, glass=70, mixers=MIX, included=4),
    b('whiskey', 'Dalmore 12Y 达摩 (Highland)', 1680, mixers=MIX, included=4),
    b('whiskey', 'Ardbeg 10Y 阿德贝哥 (Islay)', 1280, glass=80, mixers=MIX, included=4),
    b('whiskey', 'Balvenie Doublewood 12Y 百富双桶', 1580, mixers=MIX, included=4),
    b('whiskey', 'Balvenie Singlewood 12Y 百富单桶', 2680, mixers=MIX, included=4),
    b('whiskey', 'Balvenie Sherry Cask 15Y 百富雪莉桶', 3880, mixers=MIX, included=4),
    # Bourbon / Japanese / brandy / tequila / vodka / gin / rum
    b('bourbon', "Jack Daniel's 杰克丹尼", 680, glass=50, mixers=MIX, included=4),
    b('bourbon', 'Wild Turkey 威凤凰', 780, glass=60, mixers=MIX, included=4),
    b('bourbon', "Maker's Mark 美格", 980, glass=80, mixers=MIX, included=4),
    b('japanese_whiskey', 'Yamazaki 1923 山崎', 2880, mixers=MIX, included=4),
    b('japanese_whiskey', 'Hibiki 響', 2680, mixers=MIX, included=4),
    b('brandy', 'Hennessy VSOP 轩尼诗', 1280, mixers=MIX, included=4),
    b('brandy', 'Hennessy XO 轩尼诗', 3980, mixers=MIX, included=4),
    b('brandy', 'Martell Cordon Bleu 马爹利蓝带', 2800, mixers=MIX, included=4),
    b('brandy', 'Martell Noblige 马爹利名士', 1380, mixers=MIX, included=4),
    b('brandy', 'Martell XO 马爹利', 3880, mixers=MIX, included=4),
    b('tequila', 'Olmeca Gold 奥美加金龙舌兰', 680, glass=55, mixers=MIX, included=4),
    b('tequila', '1800 Silver 典藏1800银', 780, glass=65, mixers=MIX, included=4),
    b('vodka', 'SKYY 蓝天伏特加', 680, glass=55, mixers=MIX, included=4),
    b('vodka', 'Absolut 绝对伏特加', 680, glass=55, mixers=MIX, included=4),
    b('vodka', 'Grey Goose 灰雁', 1180, mixers=MIX, included=4),
    b('gin', 'Bombay Gin 孟买蓝宝石', 680, glass=55, mixers=MIX, included=4),
    b('gin', 'Hendricks Gin 亨利爵士', 880, glass=65, mixers=MIX, included=4),
    b('rum', "Myers's Rum 美雅士黑朗姆", 680, glass=65, mixers=MIX, included=4),
    b('rum', 'Zacapa 23 萨卡帕23年', 1480, mixers=MIX, included=4),
]

def main():
    token = login('org.seed@soundit-events.com', 'TestPass123!')
    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    r = requests.post(f'{BASE}/tables/business/drinks/import/confirm', headers=headers, data=json.dumps(items), timeout=60)
    r.raise_for_status()
    data = r.json()
    print(f'imported {data["created"]} WE BAR drinks')

    # Make the menu visible for the demo event (event 3)
    ev = requests.get(f'{BASE}/tables/events/3/drinks', timeout=30).json()
    print(f'public event menu now: {len(ev["items"])} items')

if __name__ == '__main__':
    main()
