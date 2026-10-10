"""Illustrated scene boards, using the existing brand renderer and local font."""
import json
import math
import shutil
from pathlib import Path
from build_identity import build_svg, get_base64_data_uri, FONT_PATH
from scene_v2_primitives import knesset_svg

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output'/'scene-designs-v2-2026-10-09'
SRC=OUT/'internal-src'
SRC.mkdir(parents=True,exist_ok=True)
C='#F7F8EF'; G='#006838'; D='#073E2A'; L='#B5F36B'; S='#A7BAB0'; P='#E5EBDD'; M='#388D62'; T='#536B5E'

def txt(s,x,y,size=40,color=D,weight=800,anchor='end',**kw):
    return dict(type='text',text=s,x=x,y=y,size=size,fill=color,weight=weight,anchor=anchor,direction='rtl',**kw)
def rect(x,y,w,h,color,rx=0,**kw):
    return dict(type='rect',x=x,y=y,width=w,height=h,fill=color,rx=rx,**kw)
def circ(x,y,r,color,**kw):
    return dict(type='circle',cx=x,cy=y,r=r,fill=color,**kw)
def raw(s): return dict(type='raw',svg=s)
def path(d,fill='none',stroke=None,width=2,**kw):
    return dict(type='path',d=d,fill=fill,stroke=stroke or 'none',strokeWidth=width,**kw)
def line(x1,y1,x2,y2,c,w=2):
    return dict(type='line',x1=x1,y1=y1,x2=x2,y2=y2,stroke=c,strokeWidth=w)
def group(name,elements,transform=None):
    d=dict(type='group',id=name,elements=elements)
    if transform:d['transform']=transform
    return d
def pill(s,x,y,w,bg=L,fg=D,size=28):
    return [rect(x,y,w,62,bg,31),txt(s,x+w/2,y+42,size,fg,800,'middle')]
def arrow(d,color=L,width=7,end=None):
    e=[path(d,stroke=color,width=width)]
    if end:
        x,y,rotation=end
        e.append(group('arrow-head-'+str(x)+'-'+str(y),[
            path('M-15 -17L0 0L15 -17',stroke=color,width=width)
        ],f'translate({x} {y}) rotate({rotation})'))
    return e

def chair(x,y,w,color=G,shadow=D):
    return raw(f'<g transform="translate({x} {y}) scale({w/100})"><rect x="12" y="3" width="76" height="57" rx="22" fill="{color}"/><rect x="8" y="48" width="84" height="18" rx="9" fill="{shadow}"/><rect x="14" y="50" width="72" height="16" rx="8" fill="{color}"/><path d="M25 63V86M75 63V86" stroke="{color}" stroke-width="11" stroke-linecap="round"/></g>')

def people(x,y,w,color=C,accent=L):
    return raw(f'<g transform="translate({x} {y}) scale({w/300})"><circle cx="52" cy="57" r="27" fill="{color}"/><path d="M8 156V128Q8 94 52 94Q96 94 96 128V156Z" fill="{color}"/><circle cx="248" cy="57" r="27" fill="{color}"/><path d="M204 156V128Q204 94 248 94Q292 94 292 128V156Z" fill="{color}"/><circle cx="150" cy="37" r="34" fill="{accent}"/><path d="M96 164V124Q96 80 150 80Q204 80 204 124V164Z" fill="{accent}"/></g>')

def bubble(x,y,w,h,color=C,side='right',outline=None):
    tail= f'M{w*.72} {h-5}L{w*.78} {h+33}L{w*.48} {h-5}Z' if side=='right' else f'M{w*.28} {h-5}L{w*.22} {h+33}L{w*.52} {h-5}Z'
    stroke=f' stroke="{outline}" stroke-width="5"' if outline else ''
    return raw(f'<g transform="translate({x} {y})"><path d="{tail}" fill="{color}"{stroke}/><rect width="{w}" height="{h}" rx="{min(w,h)*.22}" fill="{color}"{stroke}/></g>')

charts=[]
def arc(name,bands,cx=540,base=1180,r=422,dot=None,explode=0):
    assert sum(n for n,c in bands)==120
    points=[]
    for count,ratio in zip([16,20,24,28,32],[.51,.6325,.755,.8775,1]):
        for j in range(count):
            a=math.pi-j*math.pi/(count-1)
            points.append((a,r*ratio,cx+r*ratio*math.cos(a),base-r*ratio*math.sin(a)))
    points.sort(key=lambda p:(-p[0],p[1]))
    els=[];idx=0
    for band,(n,color) in enumerate(bands):
        sub=points[idx:idx+n]
        mean=sum(p[0] for p in sub)/n
        dx=explode*math.cos(mean);dy=-explode*math.sin(mean)
        for a,rp,x,y in sub:
            idx+=1
            els.append(circ(round(x+dx,3),round(y+dy,3),dot or round(r*.033,3),color,id=f'{name}-seat-{idx:03}'))
    charts.append(dict(id='parliament-'+name,seats=120,bands=bands))
    return group('parliament-'+name,els)

def dots(name,count,x,y,cols,gap,r,color):
    return group(name,[circ(x+(i%cols)*gap,y+(i//cols)*gap,r,color,id=f'{name}-seat-{i+1:03}') for i in range(count)])

def frame(label,dark=False,note=''):
    fg=C if dark else D
    return [txt(label,990,128,31,fg,800),line(84,175,996,175,M if dark else '#CBDBCA'),
            circ(93,118,9,L if dark else G),rect(119,109,44,18,L if dark else G,9),
            line(84,1773,996,1773,M if dark else '#CBDBCA'),
            *( [txt(note,990,1828,25,L if dark else T,600)] if note else [] )]

scenes=[]
def save(id,title,els,dark=False):
    scenes.append(dict(id=id,title=title,width=1080,height=1920,background=G if dark else C,elements=els))

# Opening: a place and a visual question, not a repeated chart cover.
e=frame('الافتتاحية',True)
e += [txt('كيف يعني؟!',996,377,135,C,950),txt('خلّيني أشرحلك.',996,491,69,C,700),
      circ(564,986,423,D),raw(knesset_svg(72,650,936,610)),
      bubble(102,582,220,172,L,'left'),txt('؟',212,731,137,G,950,'middle'),
      raw('<path d="M180 559l-20-29M140 598l-34-4M318 562l21-24" fill="none" stroke="#B5F36B" stroke-width="8" stroke-linecap="round"/>'),
      txt('الكنيست',958,1323,52,C,900)]
e += arrow('M537 1212C537 1300 495 1355 495 1441',L,7,(495,1441,0))
e += [arc('intro',[(120,C)],cx=542,base=1688,r=218,dot=7.2),
      chair(505,1620,76,L,D)]
save('01-opening','كيف يعني؟',e,True)

# Seat layout: a magnified chair, its group, and the overall chamber.
e=frame('المقاعد')
e += [txt('البرلمان',996,346,136,G,950),
      txt('من الداخل',996,504,133,C,950,stroke=G,strokeWidth=5),
      circ(540,1125,268,P),arc('seats',[(120,G)],base=1166),
      chair(463,1010,154,G,D),
      txt('مقاعد البرلمان',540,1235,39,D,850,'middle'),
      line(540,1315,540,1382,S,3),line(227,1382,853,1382,S,3),
      line(227,1382,227,1430,S,3),line(853,1382,853,1430,S,3),
      rect(82,1430,290,254,P,40),rect(394,1430,290,254,P,40),rect(706,1430,290,254,P,40),
      chair(802,1460,96,G,D),txt('مقعد',853,1640,36,D,850,'middle'),
      dots('detail-group',9,478,1479,3,60,15,G),txt('كتلة',539,1640,36,D,850,'middle'),
      raw(knesset_svg(108,1460,237,152)),txt('برلمان',227,1640,36,D,850,'middle')]
save('02-seats','البرلمان من الداخل',e)

# Blocs: a slightly exploded hemicycle, with grouped seats enlarged below.
e=frame('الكتل',True,'توزيع توضيحي')
e += [txt('كتل مختلفة',996,359,111,C,950),txt('داخل البرلمان',996,477,61,C,700),
      arc('blocs',[(50,C),(8,S),(8,L),(54,'#83CF9C')],base=1121,r=390,explode=30),
      bubble(410,1032,260,107,D,'right'),txt('الكتل',540,1110,54,C,900,'middle'),
      path('M167 1223V1262H913V1223',stroke=M,width=5)]
for x,label,color,name in [(101,'كتلة',C,'a'),(345,'كتلة',S,'b'),(589,'كتلة',L,'c'),(833,'كتلة','#83CF9C','d')]:
    e += [rect(x-16,1346,194,280,D,38),dots('bloc-icon-'+name,9,x+31,1400,3,43,11.5,color),
          txt(label,x+81,1580,32,C,850,'middle')]
save('03-blocs','كتل داخل البرلمان',e,True)

# Coalition: two zones inside a single parliamentary boundary.
e=frame('الائتلاف',False,'رسم توضيحي للعلاقة داخل البرلمان')
e += [txt('داخل الائتلاف',996,350,102,G,950),txt('وخارجه',996,500,127,C,950,stroke=G,strokeWidth=5),
      rect(72,666,936,922,P,70),txt('البرلمان',950,757,41,G,850),
      rect(562,826,400,634,G,58),rect(118,826,400,634,C,58),
      bubble(617,855,290,100,L),txt('داخل الائتلاف',762,923,30,D,850,'middle'),
      bubble(173,855,290,100,P,'left'),txt('خارج الائتلاف',318,923,30,D,850,'middle'),
      dots('coalition-inside',62,602,1020,8,46,12.5,C),
      dots('coalition-outside',58,158,1020,8,46,12.5,S),
      path('M320 1465V1516H761V1465',stroke=G,width=4),
      txt('الجميع أعضاء في البرلمان',540,1675,47,G,850,'middle')]
save('04-coalition','داخل الائتلاف وخارجه',e)

# Negotiation: speech, a shared table and a visible join of groups, no numeric formula.
e=frame('التفاهمات',True,'توزيع توضيحي')
e += [txt('تفاهمات',996,365,151,C,950),
      txt('بين الكتل',996,487,94,G,900,stroke=C,strokeWidth=4.5),
      bubble(115,657,430,246,C,'right'),bubble(491,731,459,246,L,'left'),
      people(205,682,224,G,D),people(604,769,212,G,D),
      path('M238 1006C239 1091 380 1125 459 1175',stroke=C,width=6),
      path('M796 1066C795 1130 697 1155 623 1175',stroke=L,width=6),
      rect(340,1155,400,122,D,61),txt('مساحة مشتركة',540,1235,39,C,850,'middle'),
      arc('understanding',[(58,M),(54,C),(8,L)],base=1690,r=328,dot=10.8),
      raw('<path d="M464 1624H616M484 1658H596" stroke="#B5F36B" stroke-width="13" stroke-linecap="round"/>')]
save('05-understanding','تفاهمات بين الكتل',e,True)

# Multiple paths: equal cards and equivalent types of parliamentary composition.
e=frame('الاحتمالات',False,'أمثلة توضيحية')
e += [txt('أكثر من',996,348,133,G,950),txt('احتمال',996,506,141,C,950,stroke=G,strokeWidth=5),
      circ(919,691,32,G),line(919,723,919,1606,S,5)]
for name,y,bands,label in [('first',644,[(48,G),(72,S)],'تشكيل'),
                          ('second',998,[(30,D),(30,L),(60,G)],'تشكيل آخر'),
                          ('third',1352,[(30,D),(30,S),(30,L),(30,G)],'تشكيل مختلف')]:
    e += [rect(84,y,744,298,P,42),line(828,y+149,919,y+149,S,5),circ(919,y+149,12,G),
          arc('option-'+name,bands,cx=330,base=y+242,r=200,dot=6.4),
          txt(label,790,y+160,31,D,850),
          path(f'M655 {y+190}H790',stroke=G,width=5)]
save('06-possibilities','أكثر من احتمال',e)

# Full picture: architecture, seats and dialogue connected as a single diagram.
e=frame('الخلاصة',True)
e += [txt('المشهد',996,349,144,C,950),txt('الكامل',996,509,149,G,950,stroke=C,strokeWidth=5.5),
      path('M342 717C132 755 137 1158 222 1335C310 1538 757 1590 910 1390C1048 1207 974 801 779 730',stroke=M,width=7),
      rect(306,586,478,309,D,70),raw(knesset_svg(315,591,460,277)),
      bubble(755,958,235,138,L,'left'),people(797,975,151,G,D),
      bubble(84,954,235,138,C,'right'),
      raw('<path d="M125 998H260M125 1031H233M125 1064H207" stroke="#006838" stroke-width="12" stroke-linecap="round"/>'),
      arc('whole',[(40,C),(40,L),(40,S)],base=1381,r=278,dot=9),
      chair(496,1290,88,C,D),
      rect(84,1553,912,144,D,44),
      txt('مقاعد',884,1648,51,C,900,'middle'),circ(728,1631,7,L),
      txt('كتل',579,1648,51,C,900,'middle'),circ(456,1631,7,L),
      txt('تفاهمات',275,1648,51,C,900,'middle')]
save('07-overview','المشهد الكامل',e,True)

font=get_base64_data_uri(FONT_PATH)
for scene in scenes:
    (SRC/(scene['id']+'.svg')).write_text(build_svg(scene,font),encoding='utf-8')
(SRC/'scene-spec.json').write_text(json.dumps(dict(scenes=scenes,charts=charts),ensure_ascii=False,indent=2),encoding='utf-8')
shutil.copyfile(ROOT/'output'/'scene-designs-2026-10-09'/'internal-src'/'render.cjs',SRC/'render.cjs')
print('Prepared seven illustrated boards; no printed numbers or logos.')
