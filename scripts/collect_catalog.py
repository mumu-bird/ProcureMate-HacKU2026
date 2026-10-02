"""Read live merchant listing pages; save observed prices and timestamped provenance."""
from urllib.request import Request, urlopen
from lxml import html
from datetime import datetime, timezone
from pathlib import Path
import json

sources = [
 ('thermos','https://shop.theclub.com.hk/brand/thermos?clubpoint_product=all',[
  ('gift-flask','Thermos-350毫升真空保溫杯','gift',['简约','实用'],None),
  ('gift-tritan','Thermos - Tritan 710ml','gift',['活力','实用'],None),
  ('gift-purple','Thermos - 480毫升','gift',['温暖','简约'],None),
  ('gift-bottle','Thermos - 500毫升真空控溫瓶 (2色','gift',['简约','实用'],None)]),
 ('logitech','https://shop.theclub.com.hk/brand/logitech?___store=en_US&clubpoint_product=all',[
  ('keyboard-k580','K580 Slim Multi-Device Keyboard (English','keyboard',['administration','developer'],'USB-A'),
  ('combo-mk470','MK470 Ultra-slim Wireless Keyboard and Mouse Combo (English','keyboard',['administration'],'USB-A'),
  ('mouse-m650','SIGNATURE M650','mouse',['administration','developer'],'USB-A'),
  ('mouse-lift','Lift Vertical Ergonomic Mouse','mouse',['designer'],'USB-A'),
  ('webcam-brio','Brio 300','webcam',['administration','developer'],'USB-C'),
  ('headset-zone','ZONE VIBE 100','headset',['designer','developer'],'Bluetooth')]),
 ('business','https://shop.theclub.com.hk/business-needs/new-arrivals.html?___store=en_US',[
  ('dock-belkin','USB-C 6-in-1 Core GaN','dock',['developer','designer'],'USB-C'),
  ('charger-belkin','108W 4-Ports','charger',['developer','designer'],'USB-C'),
  ('headset-jbl','JBL TUNE 670NC','headset',['administration'],'Bluetooth')]),
 ('coffee','https://shop.theclub.com.hk/promotions/coffee-corner/coffee-beans-capsule-ground.html',[
  ('coffee-mocha','NESCAFÉ - 意式莫加','consumable',['咖啡','补货'],'Dolce Gusto'),
  ('coffee-black','NESCAFÉ - 長黑','consumable',['咖啡','补货'],'Dolce Gusto'),
  ('coffee-white','NESCAFÉ - 白咖啡','consumable',['咖啡','补货'],'Dolce Gusto')])
]
rows=[]
for group,url,wanted in sources:
 raw=urlopen(Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=30).read().decode('utf-8')
 start=raw.find('<div class="products-wrapper">')
 tree=html.fromstring(raw[start:] if start>=0 else raw)
 observed=datetime.now(timezone.utc).isoformat()
 for pid,match,category,tags,connector in wanted:
  found=False
  for el in tree.xpath('//li[contains(@class,"product-item")]'):
   anchors=el.xpath('.//a[contains(@class,"product-item-link")]')
   if not anchors: continue
   a=anchors[0];name=' '.join(a.text_content().split())
   if match not in name:continue
   prices=el.xpath('.//*[@data-price-type="finalPrice"]/@data-price-amount')
   if len(prices)!=1:raise ValueError(f'Ambiguous price {name}: {prices}')
   # Only cash-only listings are included, never a points redemption as a cash quote.
   box=' '.join(el.xpath('.//*[contains(@class,"price-box")]//text()'))
   if 'HK$' not in box:raise ValueError(f'Not a cash listing: {name}')
   rows.append(dict(id=pid,name=name,priceCents=round(float(prices[0])*100),category=category,tags=tags,
      connector=connector,sourceUrl=a.get('href'),listingUrl=url,observedAt=observed,
      priceBasis='merchant_listing_snapshot',shippingCents=8000,
      shippingSource='https://shop.theclub.com.hk/shipping-policy?___store=en_US',
      shippingNote='标准住宅/办公派送费规则快照；商品特殊派送与实时库存未验证。测试商户采用该规则，不代表真实下单报价。',
      stockVerified=False,compatibilityNote='采购模板要求，仍需按具体型号确认兼容性。' if connector else None))
   found=True;break
  if not found:raise ValueError(f'Missing product {match}')
 print(group, 'collected')
out=Path(__file__).resolve().parent.parent/'data'/'catalog.json'
out.parent.mkdir(exist_ok=True)
out.write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
print(f'Saved {len(rows)} observed products to {out}')
