"""Seven editorial stills, drawn with the existing identity SVG renderer."""
import json
import math
from pathlib import Path

from build_identity import build_svg, get_base64_data_uri, FONT_PATH

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output' / 'scene-designs-2026-10-09'
SRC = OUT / 'internal-src'
SRC.mkdir(parents=True, exist_ok=True)

CREAM = '#F7F8EF'
GREEN = '#006838'
DEEP = '#073E2A'
LIME = '#B5F36B'
SAGE = '#A7BAB0'
PALE = '#E5EBDD'
MUTED = '#536B5E'
CHARCOAL = '#24352D'
MIDGREEN = '#398D63'

def text(s, x, y, size=40, fill=DEEP, weight=700, anchor='end', direction='rtl', **kw):
    return dict(type='text', text=s, x=x, y=y, size=size, fill=fill,
                weight=weight, anchor=anchor, direction=direction, **kw)

def num(s, x, y, size=130, fill=GREEN, **kw):
    return text(str(s), x, y, size, fill, weight=950, anchor='middle', direction='ltr', **kw)

def rect(x, y, w, h, fill, rx=0, **kw):
    return dict(type='rect', x=x, y=y, width=w, height=h, fill=fill, rx=rx, **kw)

def line(x1, y1, x2, y2, color, width=2):
    return dict(type='line', x1=x1, y1=y1, x2=x2, y2=y2, stroke=color, strokeWidth=width)

def circle(x,y,r,color):
    return dict(type='circle', cx=x, cy=y, r=r, fill=color)

def pill(s, x, y, w, color=DEEP, bg=LIME, size=27):
    return [rect(x,y,w,60,bg,30), text(s,x+w/2,y+41,size,color,800,'middle')]

charts = []
def parliament(name, bands, cx=540, baseline=1150, radius=436, dot=None):
    assert sum(n for n,c in bands) == 120
    points=[]
    for count, ratio in zip([16,20,24,28,32],[.51,.6325,.755,.8775,1]):
        r=radius*ratio
        for j in range(count):
            angle=math.pi-j*math.pi/(count-1)
            points.append((angle,r,cx+r*math.cos(angle),baseline-r*math.sin(angle)))
    points.sort(key=lambda p:(-p[0],p[1]))
    colors=[c for n,c in bands for _ in range(n)]
    seats=[]
    for i,((a,r,x,y),color) in enumerate(zip(points,colors)):
        seats.append(dict(type='circle', id=f'{name}-seat-{i+1:03}', cx=round(x,3),
                          cy=round(y,3),r=dot or round(radius*.033,2),fill=color))
    charts.append(dict(id='parliament-'+name, seats=120, bands=bands))
    return dict(type='group',id='parliament-'+name,elements=seats)

def base(index, dark=False, footer='الكنيست · شرح بصري'):
    fg=CREAM if dark else DEEP
    sub=LIME if dark else MUTED
    return [
        text('المقاعد والتفاهمات',996,120,31,fg,850),
        num(f'{index:02} / 07',138,118,25,fg),
        circle(988,172,5,LIME if dark else GREEN),
        line(84,172,965,172,MIDGREEN if dark else '#CAD8C8',2),
        line(84,1765,996,1765,MIDGREEN if dark else '#CAD8C8',2),
        text(footer,996,1824,24,sub,600),
        text('شرح بصري',84,1824,22,sub,600,'start'),
    ]

scenes=[]
def save(name,title,elements,dark=False):
    scenes.append(dict(id=name,title=title,width=1080,height=1920,
                       background=GREEN if dark else CREAM,elements=elements))

# 01 — The opening introduces the chamber, without a spokesperson.
e=base(1,True)
e += [text('كيف تتشكّل',996,380,118,CREAM,950),
      text('أغلبية؟',996,567,171,GREEN,950,stroke=CREAM,strokeWidth=5.5),
      text('من المقاعد إلى التفاهمات',992,678,45,CREAM,600)]
e += pill('120 مقعداً · نقطة البداية',84,760,440)
e += [parliament('opening',[(120,CREAM)],baseline=1380),
      num('120',540,1342,154,LIME),
      text('مقعداً في الكنيست',540,1414,31,CREAM,700,'middle'),
      text('كل نقطة تمثّل مقعداً واحداً.',996,1570,42,CREAM,750),
      text('نقرأ الأرقام… ثم نفهم العلاقة بينها.',996,1656,36,CREAM,600)]
save('01-opening','كيف تتشكل أغلبية؟',e,True)

# 02 — Absolute majority is a seat count, not a claim about every confidence vote.
e=base(2,footer='المصدر: الكنيست · القوانين الأساسية')
e += [num('120',795,428,220,GREEN),
      text('مقعداً في الكنيست',988,530,66,DEEP,850),
      parliament('majority',[(59,SAGE),(61,GREEN)],baseline=1145),
      num('61',540,1096,159,GREEN),
      text('أغلبية مطلقة',540,1166,36,DEEP,850,'middle'),
      num('59',170,1235,53,MUTED),num('61',912,1235,53,GREEN),
      text('المقاعد الأخرى',170,1283,24,MUTED,600,'middle'),
      text('أكثر من النصف',912,1283,24,GREEN,600,'middle'),
      rect(84,1380,912,144,DEEP,36),
      num('61 + 59 = 120',540,1477,63,CREAM),
      text('61 مقعداً = أغلبية مطلقة من مجموع الأعضاء.',996,1598,34,DEEP,800),
      text('ليست شرطاً لكل تصويت؛',996,1658,30,MUTED,600),
      text('تختلف الأغلبية المطلوبة بحسب القرار.',996,1713,30,MUTED,600)]
save('02-majority','أغلبية المقاعد',e)

# 03 — Unnamed blocs keep the illustration explicitly hypothetical.
e=base(3)
e += [text('كيف تتوزّع',996,355,115,GREEN,950),
      text('المقاعد؟',996,505,132,CREAM,950,stroke=GREEN,strokeWidth=5),]
e += pill('مثال افتراضي',84,552,262)
e += [parliament('blocs',[(50,CHARCOAL),(8,SAGE),(8,LIME),(54,GREEN)],baseline=1115),
      num('120',540,1082,127,GREEN),
      text('مجموع المقاعد',540,1140,28,DEEP,700,'middle')]
for x,y,label,count,color in [(560,1210,'الكتلة أ',50,CHARCOAL),(84,1210,'الكتلة ب',54,GREEN),
                            (560,1378,'الكتلة ج',8,SAGE),(84,1378,'الكتلة د',8,LIME)]:
    e += [rect(x,y,436,136,'#EDF1E6',27),circle(x+400,y+68,12,color),
          text(label,x+374,y+80,34,DEEP,800),num(count,x+80,y+95,70,DEEP)]
e += [num('50 + 54 + 8 + 8 = 120',540,1620,55,GREEN),
      text('مثال حسابي، وليس استطلاعاً أو نتيجة انتخابات.',996,1705,31,MUTED,600)]
save('03-blocs','توزيع افتراضي للمقاعد',e)

# 04 — All seats remain visible; government support is not the only parliamentary role.
e=base(4,footer='المصدر: الكنيست · عمل البرلمان')
e += [text('داخل الائتلاف',996,335,103,GREEN,950),
      text('وخارجه',996,476,129,CREAM,950,stroke=GREEN,strokeWidth=5)]
e += pill('توزيع توضيحي',84,532,275)
e += [parliament('roles',[(58,SAGE),(62,GREEN)],baseline=1080),
      num('120',540,1049,128,GREEN),
      text('جميعهم في البرلمان',540,1110,30,DEEP,750,'middle')]
for x,title,color,lines in [
    (560,'داخل الائتلاف',GREEN,['كتل تتفق على دعم الحكومة','وتشارك في عمل الائتلاف.']),
    (84,'خارج الائتلاف',MUTED,['كتل تواصل العمل البرلماني','دون الانضمام إلى الائتلاف.'])]:
    e += [rect(x,1200,436,330,PALE,32),rect(x+30,1232,376,6,color,3),
          text(title,x+406,1311,41,DEEP,900)]
    for i,s in enumerate(lines):
        e.append(text(s,x+406,1393+i*57,27,DEEP,600))
e += [text('التشريع والرقابة والتصويت',996,1620,43,GREEN,850),
      text('أدوار لجميع أعضاء البرلمان.',996,1690,37,DEEP,650)]
save('04-coalition','داخل الائتلاف وخارجه',e)

# 05 — Two quantities merge into a 62-seat group; the visual retains all 120 seats.
e=base(5,True)
e += [text('ماذا يحدث',996,345,117,CREAM,950),
      text('عند الجمع؟',996,486,125,GREEN,950,stroke=CREAM,strokeWidth=5.5)]
e += pill('سيناريو افتراضي',84,540,311)
e += [rect(64,650,952,252,CREAM,42),rect(443,670,132,178,LIME,30),
      num('54',225,815,151,GREEN),num('+',379,804,89,GREEN),
      num('8',509,815,143,GREEN),num('=',648,804,84,GREEN),num('62',839,815,166,GREEN),
      text('مقاعد',225,870,24,DEEP,700,'middle'),text('إضافية',509,870,24,DEEP,700,'middle'),
      text('المجموع',839,870,24,DEEP,700,'middle'),
      parliament('addition',[(58,MIDGREEN),(54,CREAM),(8,LIME)],baseline=1398,radius=416),
      num('61',540,1352,127,CREAM),
      text('مرجع الأغلبية المطلقة',540,1412,26,CREAM,700,'middle'),
      num('62 = 61 + 1',540,1553,76,LIME),
      rect(84,1623,912,90,DEEP,28),
      text('الجمع الحسابي لا يثبت اتفاقاً سياسياً.',540,1681,32,CREAM,750,'middle')]
save('05-addition','54 زائد 8 يساوي 62',e,True)

# 06 — Equal visual treatment for three examples. The remainder is shown explicitly.
e=base(6)
e += [text('ثلاثة أمثلة',996,342,115,GREEN,950),
      text('حسابية',996,487,132,CREAM,950,stroke=GREEN,strokeWidth=5)]
for i,(n,y,title,relation) in enumerate([(62,555,'المثال الأول','أعلى من 61 بمقعد'),
                                       (59,941,'المثال الثاني','أقل من 61 بمقعدين'),
                                       (61,1327,'المثال الثالث','يساوي 61 مقعداً')]):
    e += [rect(64,y,952,344,PALE,34),
          parliament('scenario-'+str(i+1),[(120-n,SAGE),(n,GREEN)],cx=337,baseline=y+278,radius=227,dot=7.35),
          num('120',337,y+263,57,GREEN),
          text(title,976,y+56,28,MUTED,700),
          num(n,842,y+179,127,GREEN),
          text(relation,976,y+236,29,DEEP,800),
          num(f'{n} + {120-n} = 120',842,y+296,32,MUTED),
          line(613,y+36,613,y+308,'#C5D3BF',2)]
e += [text('سيناريوهات توضيحية، وليست توقعات.',996,1720,30,MUTED,650)]
save('06-scenarios','ثلاثة أمثلة حسابية',e)

# 07 — A neutral closing, without names, slogans, endorsements or a voting call.
e=base(7,True)
e += [text('الحساب وحده',996,348,111,CREAM,950),
      text('لا يكفي.',996,523,155,GREEN,950,stroke=CREAM,strokeWidth=5.5),
      text('الأرقام تشرح الاحتمالات.',996,678,47,CREAM,700),
      parliament('closing',[(59,MIDGREEN),(61,CREAM)],baseline=1200),
      num('61',540,1155,143,LIME),
      text('أغلبية المقاعد',540,1216,31,CREAM,750,'middle'),
      rect(84,1330,390,142,CREAM,71),rect(606,1330,390,142,LIME,71),
      text('تفاهمات',279,1426,57,GREEN,900,'middle'),
      text('مقاعد',801,1426,57,GREEN,900,'middle'),
      num('+',540,1426,72,CREAM),
      text('تشكيل الائتلاف يحتاج',996,1603,48,CREAM,850),
      text('تفاهمات بين الكتل.',996,1682,48,CREAM,850)]
save('07-closing','الحساب وحده لا يكفي',e,True)

font=get_base64_data_uri(FONT_PATH)
for scene in scenes:
    (SRC/(scene['id']+'.svg')).write_text(build_svg(scene,font),encoding='utf-8')
(SRC/'scene-spec.json').write_text(json.dumps(dict(scenes=scenes,charts=charts),ensure_ascii=False,indent=2),encoding='utf-8')
(SRC/'sources.json').write_text(json.dumps({
    'purpose':'Neutral parliamentary arithmetic explainer. All bloc splits are hypothetical.',
    'sources':[
        'https://main.knesset.gov.il/AR/activity/Pages/Plenum.aspx',
        'https://main.knesset.gov.il/AR/About/pages/KnessetWork.aspx',
        'https://main.knesset.gov.il/EN/activity/documents/BasicLawsPDF/BasicLawTheKnesset.pdf',
        'https://main.knesset.gov.il/EN/activity/Documents/BasicLawsPDF/BasicLawTheGovernment.pdf'],
    'reference':'User-supplied semicircle of parliamentary dots; original vector redraw.',
    'font':'Cairo Variable, existing licensed project font',
    'date':'2026-10-09'
},indent=2),encoding='utf-8')
print('Prepared 7 SVG stills and scene data.')
