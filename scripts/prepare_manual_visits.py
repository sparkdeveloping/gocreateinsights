from __future__ import annotations
import csv, json, re, unicodedata, hashlib, subprocess, tempfile, os, math, shutil
from zipfile import ZipFile
from pathlib import Path
from collections import Counter, defaultdict
from datetime import datetime, date, timedelta
import cv2
import numpy as np
from PIL import Image
from rapidfuzz import fuzz

ROOT=Path(__file__).resolve().parents[1]
MASTER=ROOT/'data/source/gocreate-master-2026-09-09.csv'
SCANS_ZIP=ROOT/'data/source/manual-signins/scans.zip'
OUT_JSON=ROOT/'data/analytics/manual-visits.json'
OUT_CSV=ROOT/'data/source/manual-signins/manual-signin-review.csv'
WORK=ROOT/'.manual-signin-work'
if WORK.exists(): shutil.rmtree(WORK)
PNG_DIR=WORK/'png'; PDF_DIR=WORK/'pdf'; TMP=WORK/'ocr'
for d in (PNG_DIR,PDF_DIR,TMP): d.mkdir(parents=True,exist_ok=True)
if not shutil.which('pdftoppm') or not shutil.which('tesseract'):
    raise SystemExit('Manual scan preparation requires pdftoppm (Poppler) and tesseract on PATH.')
if not SCANS_ZIP.exists():
    raise SystemExit(f'Missing {SCANS_ZIP}')
with ZipFile(SCANS_ZIP) as zf:
    zf.extractall(PDF_DIR)
pdfs=sorted(PDF_DIR.rglob('*.pdf'))
seen_hashes={}
unique_pdfs=[]
for pdf in pdfs:
    digest=hashlib.sha256(pdf.read_bytes()).hexdigest()
    if digest in seen_hashes: continue
    seen_hashes[digest]=pdf.name; unique_pdfs.append(pdf)
DUPLICATE_SCANS_IGNORED=len(pdfs)-len(unique_pdfs)
for index,pdf in enumerate(unique_pdfs,1):
    target=PNG_DIR/f'{index:03d}_{pdf.stem}'
    subprocess.run(['pdftoppm','-png','-r','150','-singlefile',str(pdf),str(target)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)

GRID_FALLBACK=[700+53*i for i in range(9)]
FULL_PROPS=[0,.0764,.216,.369,.572,.714,.857,1]

def safe_id(prefix:str, raw:str)->str:
    return f"{prefix}_{hashlib.sha1((raw or '').encode('utf-8', errors='ignore')).hexdigest()[:14]}"

def norm(s:str)->str:
    s=unicodedata.normalize('NFKD',s or '').encode('ascii','ignore').decode().lower()
    s=re.sub(r'[^a-z0-9]+',' ',s)
    return re.sub(r'\s+',' ',s).strip()

def clusters(values,gap=2):
    groups=[]
    for v in values:
        v=int(v)
        if not groups or v>groups[-1][-1]+gap: groups.append([v])
        else: groups[-1].append(v)
    return [int(round(np.mean(g))) for g in groups]

def hline_candidates(img):
    h,w=img.shape
    th=cv2.threshold(img,205,255,cv2.THRESH_BINARY_INV)[1]
    hk=cv2.getStructuringElement(cv2.MORPH_RECT,(max(50,w//20),1))
    hor=cv2.morphologyEx(th,cv2.MORPH_OPEN,hk)
    counts=(hor>0).sum(axis=1)
    ys=clusters(np.where(counts>max(120,w*.16))[0],2)
    return ys,hor

def best_grid(ys):
    best=None
    for i in range(0,max(0,len(ys)-8)):
        seq=ys[i:i+9]
        if len(seq)<9: continue
        gaps=np.diff(seq)
        med=float(np.median(gaps)); std=float(np.std(gaps))
        if 38<=med<=68 and std<10:
            score=std+abs(med-53)*.15+abs(seq[0]-720)*.002
            if best is None or score<best[0]: best=(score,seq)
    return best[1] if best else None

def normalize_page(img):
    h,w=img.shape
    ys,_=hline_candidates(img)
    # Find likely grid in either half. If a landscape sheet is upside-down, the 9-line grid is near the top.
    seq=best_grid(ys)
    if w>h and seq and np.mean(seq)<h*.48:
        img=cv2.rotate(img,cv2.ROTATE_180)
        ys,_=hline_candidates(img)
    return img

def table_geometry(img):
    h,w=img.shape
    ys,hor=hline_candidates(img)
    seq=best_grid(ys)
    if not seq:
        # Fixed scanner geometry fallback; this catches slightly skewed pages where morphology loses the rules.
        seq=GRID_FALLBACK.copy()
        # ensure within bounds
        if seq[-1]>=h:
            step=(min(h-80,1140)-max(80,700))/8
            seq=[int(max(80,700)+step*i) for i in range(9)]
    bounds=[]
    for y in seq:
        if y<0 or y>=h: continue
        band=(hor[max(0,y-2):min(h,y+3)].max(axis=0)>0)
        xs=np.where(band)[0]
        groups=[]
        for x in xs:
            x=int(x)
            if not groups or x>groups[-1][-1]+2: groups.append([x])
            else: groups[-1].append(x)
        groups=[g for g in groups if len(g)>.40*w]
        if groups:
            g=max(groups,key=len); bounds.append((g[0],g[-1]))
    if bounds:
        x0=int(np.median([b[0] for b in bounds])); x1=int(np.median([b[1] for b in bounds]))
    else:
        x0=int((.04 if w>h else .005)*w)
        x1=int((.97 if w>h else .95)*w)
    return seq,x0,x1

def crop_pad(crop, width=620, height=160):
    if crop.size==0:
        return Image.new('L',(width,height),255)
    # normalize contrast lightly; do not over-threshold handwriting
    crop=cv2.normalize(crop,None,0,255,cv2.NORM_MINMAX)
    scale=min((width-20)/max(1,crop.shape[1]),(height-20)/max(1,crop.shape[0]))
    nw=max(1,int(crop.shape[1]*scale)); nh=max(1,int(crop.shape[0]*scale))
    resized=cv2.resize(crop,(nw,nh),interpolation=cv2.INTER_CUBIC)
    canvas=np.full((height,width),255,dtype=np.uint8)
    y=(height-nh)//2; x=10
    canvas[y:y+nh,x:x+nw]=resized
    return Image.fromarray(canvas)

def save_tiff(images,path):
    images[0].save(path,save_all=True,append_images=images[1:],compression='tiff_deflate')

def tesseract_pages(path,psm,whitelist=None):
    cmd=['tesseract',str(path),'stdout','--psm',str(psm)]
    if whitelist:
        cmd += ['-c',f'tessedit_char_whitelist={whitelist}']
    out=subprocess.check_output(cmd,stderr=subprocess.DEVNULL).decode('utf-8','ignore')
    parts=out.split('\x0c')
    # Tesseract separates pages with FF, but does not append FF to the final page.
    return [re.sub(r'\s+',' ',p).strip() for p in parts]

def parse_date(raw, previous=None, as_of=date(2026,9,11)):
    s=(raw or '').strip()
    if not s:
        return previous, bool(previous), False
    if re.fullmatch(r'[\^\"\'`.,/\\-]+',s):
        return previous, bool(previous), False
    cleaned=s.replace('O','0').replace('o','0').replace('I','1').replace('l','1').replace('|','1')
    cleaned=re.sub(r'[^0-9/.-]','',cleaned)
    m=re.search(r'(\d{1,2})[/.\-](\d{1,2})(?:[/.\-](\d{2,4}))?',cleaned)
    if not m:
        return previous, bool(previous), False
    a,b,yr=m.groups(); a=int(a); b=int(b)
    explicit_year=bool(yr and len(yr)>=2)
    year=int(yr) if yr else 2026
    if year<100: year+=2000
    if a>12 and b<=12: month,day=b,a
    else: month,day=a,b
    try:
        candidate=date(year,month,day)
    except ValueError:
        return previous,bool(previous),False
    # Scans were produced in 2026; reject implausible OCR dates instead of contaminating ranges.
    if candidate < date(2024,1,1) or candidate > as_of:
        return previous,bool(previous),False
    # Short OCR fragments (for example "4-2" from a written 9/4/26) should not jump months
    # when the previous row on the same physical sheet supplies a credible date.
    if previous and not explicit_year:
        prev=date.fromisoformat(previous)
        if abs((candidate-prev).days) > 7:
            return previous,True,False
    return candidate.isoformat(),False,not explicit_year

def confidence_label(score, status):
    if status=='member': return 'high'
    if status=='review': return 'review'
    if status=='guest': return 'guest'
    return 'unreadable'

with MASTER.open(encoding='utf-8-sig',newline='') as f:
    members=list(csv.DictReader(f))
# normalized member fields
for m in members:
    m['_first']=norm(m.get('firstName','')); m['_last']=norm(m.get('lastName','')); m['_display']=norm(m.get('displayName',''))
last_counts=Counter(m['_last'] for m in members if m['_last'])

row_meta=[]; first_imgs=[]; last_imgs=[]; date_imgs=[]
for page_idx,p in enumerate(sorted(PNG_DIR.glob('*.png')),1):
    img=cv2.imread(str(p),cv2.IMREAD_GRAYSCALE)
    if img is None: continue
    img=normalize_page(img)
    h,w=img.shape; full=w>h
    ylines,x0,x1=table_geometry(img); W=x1-x0
    if len(ylines)<9: continue
    # OCR seven data rows per sheet.
    for rowno in range(1,8):
        y1,y2=ylines[rowno],ylines[rowno+1]
        y1=max(0,y1+3); y2=min(h,y2-3)
        if y2<=y1: continue
        if full:
            date_c=img[y1:y2,x0+2:int(x0+FULL_PROPS[1]*W)-2]
            first_c=img[y1:y2,int(x0+FULL_PROPS[1]*W)+2:int(x0+FULL_PROPS[2]*W)-2]
            last_c=img[y1:y2,int(x0+FULL_PROPS[2]*W)+2:int(x0+FULL_PROPS[3]*W)-2]
        else:
            date_c=np.full((max(1,y2-y1),100),255,dtype=np.uint8)
            first_c=np.full((max(1,y2-y1),100),255,dtype=np.uint8)
            last_c=img[y1:y2,x0+3:int(x0+.20*W)-3]
        first_imgs.append(crop_pad(first_c)); last_imgs.append(crop_pad(last_c)); date_imgs.append(crop_pad(date_c,420,160))
        # ink metric helps retain highly cursive rows when OCR outputs nothing
        name_comb=np.hstack([first_c,last_c]) if full else last_c
        ink=float(np.mean(name_comb<185)) if name_comb.size else 0.0
        row_meta.append({'page':page_idx,'source':p.name,'row':rowno,'fullSheet':full,'ink':round(ink,4)})

save_tiff(first_imgs,TMP/'first.tif'); save_tiff(last_imgs,TMP/'last.tif'); save_tiff(date_imgs,TMP/'date.tif')
first_txt=tesseract_pages(TMP/'first.tif',11)
last_txt=tesseract_pages(TMP/'last.tif',11)
date_txt=tesseract_pages(TMP/'date.tif',7,'0123456789/-.^')
date_alt=tesseract_pages(TMP/'date.tif',11)
# Normalize output lengths. Blank pages still emit form-feed separators; pad defensively.
N=len(row_meta)
for arr in (first_txt,last_txt,date_txt,date_alt):
    if len(arr)<N: arr.extend(['']*(N-len(arr)))

# First pass dates per page, allowing ditto/inherited dates.
last_date_by_page={}
for i,meta in enumerate(row_meta):
    raw_primary=date_txt[i] if i<len(date_txt) else ''
    raw_alt=date_alt[i] if i<len(date_alt) else ''
    prev=last_date_by_page.get(meta['page'])
    d, inherited, year_inferred=parse_date(raw_primary,prev)
    rawd=raw_primary
    if not d or (inherited and raw_alt):
        alt_d, alt_inherited, alt_year_inferred=parse_date(raw_alt,prev)
        if alt_d and not alt_inherited:
            d, inherited, year_inferred, rawd=alt_d, alt_inherited, alt_year_inferred, raw_alt
    if d: last_date_by_page[meta['page']]=d
    meta.update({'ocrFirst':first_txt[i] if i<len(first_txt) else '', 'ocrLast':last_txt[i] if i<len(last_txt) else '', 'ocrDate':rawd, 'visitDate':d, 'dateInherited':inherited, 'yearInferred':year_inferred})

# Fill leading undated rows on a page when the page has exactly one explicit date value later.
page_dates=defaultdict(list)
for r in row_meta:
    if r['visitDate'] and not r['dateInherited']: page_dates[r['page']].append(r['visitDate'])
for r in row_meta:
    if not r['visitDate']:
        unique=sorted(set(page_dates.get(r['page'],[])))
        if len(unique)==1:
            r['visitDate']=unique[0]; r['dateInherited']=True

# Match names conservatively.
results=[]
for r in row_meta:
    fo=norm(r['ocrFirst']); lo=norm(r['ocrLast'])
    alpha=len(re.sub(r'[^a-z]','',fo+lo))
    populated=alpha>=2 or r['ink']>=0.065
    if not populated:
        continue
    best=None; second=None
    if r['fullSheet'] and (fo or lo):
        for idx,m in enumerate(members):
            fs=fuzz.ratio(fo,m['_first']) if fo and m['_first'] else 0.0
            ls=fuzz.ratio(lo,m['_last']) if lo and m['_last'] else 0.0
            fullocr=norm((fo+' '+lo).strip())
            ds=fuzz.ratio(fullocr,m['_display']) if fullocr and m['_display'] else 0.0
            sc=.40*fs+.45*ls+.15*ds
            tup=(sc,fs,ls,ds,idx)
            if best is None or sc>best[0]: second=best; best=tup
            elif second is None or sc>second[0]: second=tup
    elif lo:
        for idx,m in enumerate(members):
            ls=fuzz.ratio(lo,m['_last']) if m['_last'] else 0.0
            tup=(ls,0.0,ls,ls,idx)
            if best is None or ls>best[0]: second=best; best=tup
            elif second is None or ls>second[0]: second=tup
    score=best[0] if best else 0.0; margin=score-(second[0] if second else 0.0)
    status='guest'; match=None; suggestion=None
    if best:
        m=members[best[4]]; unique_last=bool(m['_last'] and last_counts[m['_last']]==1)
        if r['fullSheet']:
            strong=(score>=82 and margin>=4 and best[1]>=65 and best[2]>=80) or (best[1]>=88 and best[2]>=88 and margin>=3)
            review=(score>=68 and best[2]>=60 and best[1]>=45) or (best[1]>=78 and best[2]>=68)
        else:
            strong=score>=95 and unique_last and len(lo)>=4
            review=score>=82 and unique_last and len(lo)>=4
        if strong:
            status='member'; match=m
        elif review:
            status='review'; suggestion=m
        elif alpha<4:
            status='unreadable'
    elif alpha<4:
        status='unreadable'
    # tracker overlap flags only for high-confidence matches
    overlap=False; exact_overlap=False
    if match and r['visitDate']:
        d=r['visitDate']
        overlap='2026-08-03'<=d<='2026-09-09'
        last=(match.get('lastVisitAt') or '')[:10]
        exact_overlap=bool(last and last==d)
    results.append({
        'id':f"scan-{r['page']:03d}-{r['row']}",
        'sourceFile':r['source'], 'sourcePage':r['page'], 'sourceRow':r['row'],
        'visitDate':r['visitDate'], 'dateInherited':r['dateInherited'], 'yearInferred':r['yearInferred'],
        'ocrFirst':r['ocrFirst'], 'ocrLast':r['ocrLast'], 'ocrDate':r['ocrDate'],
        'classification':status,
        'matchConfidence':round(score,1), 'matchMargin':round(margin,1),
        'memberId':safe_id('m', match.get('id') or match.get('externalId') or match.get('displayName') or '') if match else None,
        'memberDisplayName':match.get('displayName') if match else None,
        'suggestedMemberId':safe_id('m', suggestion.get('id') or suggestion.get('externalId') or suggestion.get('displayName') or '') if suggestion else None,
        'suggestedMemberName':suggestion.get('displayName') if suggestion else None,
        'trackerCoverageOverlap':overlap,
        'possibleExactTrackerDuplicate':exact_overlap,
        'scanLayout':'full' if r['fullSheet'] else 'cropped',
    })

# aggregate
known=[r for r in results if r['classification']=='member']
guests=[r for r in results if r['classification']=='guest']
review=[r for r in results if r['classification']=='review']
unread=[r for r in results if r['classification']=='unreadable']
dated=[r for r in results if r['visitDate']]
by_date=Counter(r['visitDate'] for r in dated)
member_counts=Counter(r['memberId'] for r in known if r['memberId'])
member_names={r['memberId']:r['memberDisplayName'] for r in known if r['memberId']}
summary={
    'uniqueScanPages':len(set(r['source'] for r in row_meta)),
    'duplicateScansIgnored':DUPLICATE_SCANS_IGNORED,
    'signInRowsDetected':len(results),
    'datedRows':len(dated),
    'unknownDateRows':len(results)-len(dated),
    'matchedMemberVisits':len(known),
    'matchedMemberPeople':len(member_counts),
    'guestVisits':len(guests),
    'reviewRows':len(review),
    'unreadableRows':len(unread),
    'trackerCoverageStart':'2026-08-03',
    'trackerCoverageEnd':'2026-09-09',
    'manualRowsInsideTrackerCoverage':sum(1 for r in dated if '2026-08-03'<=r['visitDate']<='2026-09-09'),
    'manualRowsBeforeTrackerCoverage':sum(1 for r in dated if r['visitDate']<'2026-08-03'),
    'possibleExactTrackerDuplicates':sum(1 for r in known if r['possibleExactTrackerDuplicate']),
    'manualDateMin':min(by_date) if by_date else None,
    'manualDateMax':max(by_date) if by_date else None,
}
payload={
    'meta':summary,
    'events':results,
    'byDate':[{'date':d,'visits':by_date[d]} for d in sorted(by_date)],
    'matchedMembers':[{'memberId':mid,'displayName':member_names[mid],'manualVisits':count} for mid,count in member_counts.most_common()],
}
OUT_JSON.write_text(json.dumps(payload,indent=2,ensure_ascii=False),encoding='utf-8')
fields=['id','sourceFile','sourceRow','visitDate','ocrDate','ocrFirst','ocrLast','classification','matchConfidence','memberDisplayName','suggestedMemberName','trackerCoverageOverlap','possibleExactTrackerDuplicate','scanLayout']
with OUT_CSV.open('w',encoding='utf-8-sig',newline='') as f:
    w=csv.DictWriter(f,fieldnames=fields); w.writeheader();
    for r in results: w.writerow({k:r.get(k) for k in fields})
print(json.dumps(summary,indent=2))
print('top matched')
for x in payload['matchedMembers'][:20]: print(x)

# Keep only source, review CSV, and generated analytics; raster/OCR intermediates are reproducible.
shutil.rmtree(WORK, ignore_errors=True)
