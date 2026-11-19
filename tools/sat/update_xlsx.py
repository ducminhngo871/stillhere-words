"""Cập nhật workbook duyệt SAT từ data/sat/sat.json và satq.json.
Cách dùng: python tools/sat/update_xlsx.py data/sat workbooks/du-lieu-tu-vung-SAT.xlsx
"""
import json, sys, os
from openpyxl import load_workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
DATA=sys.argv[1] if len(sys.argv)>1 else 'data/sat'
d=json.load(open(os.path.join(DATA,'sat.json'))); Q=json.load(open(os.path.join(DATA,'satq.json')))
vi={x['core']:(x.get('vi',''),x.get('ex','')) for x in d['words']}
path=sys.argv[2] if len(sys.argv)>2 else 'workbooks/du-lieu-tu-vung-SAT.xlsx'
wb=load_workbook(path)
Y=PatternFill('solid',fgColor='FFF6D6'); H=PatternFill('solid',fgColor='1B2F6B')
th=Side(style='thin',color='D5DEEC'); BD=Border(left=th,right=th,top=th,bottom=th)
for name in ['Hay gặp',"Barron's"]:
    ws=wb[name]
    for r in range(2,ws.max_row+1):
        core=str(ws.cell(r,2).value).lower(); prep=ws.cell(r,3).value
        if prep: core=core[:-(len(prep)+1)]
        v,e=vi.get(core,('',''))
        if v: ws.cell(r,6).value=v; ws.cell(r,7).value=e; ws.cell(r,6).fill=Y; ws.cell(r,7).fill=Y
old=[n for n in wb.sheetnames if n.startswith('WIC mới')]
idx=wb.sheetnames.index(old[0]) if old else 4
for n in old: del wb[n]
claude=[w for w in d['wic'] if w['src']=='claude']
ws=wb.create_sheet(f'WIC mới ({len(claude)} câu)',idx)
ws.append(['Từ mục tiêu','Dạng câu','Đoạn văn','A','B','C','D','Đáp án','Manh mối','Giải thích các lựa chọn'])
for c in ws[1]: c.font=Font(name='Arial',bold=True,color='FFFFFF'); c.fill=H; c.alignment=Alignment(wrap_text=True); c.border=BD
byw={q['w']:q for q in Q}; L='ABCD'
for wq in claude:
    q=byw[wq['root']]; why={o[0]:(o[1],o[2]) for o in q['opts']}
    expl='\n'.join(f"{L[i]}. {o}: {'Đúng' if why[o][0]=='OK' else why[o][0]} – {why[o][1]}" for i,o in enumerate(wq['opts']))
    stem=wq['stem'].replace('[[','“').replace(']]','”').replace('____','______')
    ws.append([q['w'],'Most nearly mean' if wq['mnm'] else 'Điền chỗ trống',stem]+wq['opts']+[L[wq['ans']],f"{q['clue']}: {q['key']}",expl])
for row in ws.iter_rows(min_row=2):
    for c in row: c.font=Font(name='Arial',size=10); c.alignment=Alignment(wrap_text=True,vertical='top'); c.border=BD; c.fill=Y
for i,wd in enumerate([14,14,60,14,14,14,14,8,40,70],1): ws.column_dimensions[get_column_letter(i)].width=wd
ws.freeze_panes='A2'; ws.auto_filter.ref=ws.dimensions
wb.save(path); print('xlsx updated', len(claude))
