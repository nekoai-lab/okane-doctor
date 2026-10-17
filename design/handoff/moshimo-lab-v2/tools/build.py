# usage: python3 -I build.py <template> <sample-data.json> <handoff dir>
import json, sys, html
tpl, data_path, out = sys.argv[1:4]
d = json.load(open(data_path))['data']
work = next(w for w in d['work'] if w['level'] == 'answer')
sample = {
  'version': json.load(open(data_path))['version'], 'baseDate': '2026-10-17',
  'savings': d['savings'], 'coverage': d['coverage'], 'deathSource': d['deathSource'],
  'sickness': [{'id': s['id'], 'months': s['months'], 'low': s['need']['low'], 'high': s['need']['high'],
                'verdict': s['savingsVerdict'], 'assumptions': s['need']['assumptions'], 'sources': s['need']['sources']} for s in d['sickness']],
  'death': [{k: p[k] for k in ('age', 'year', 'children', 'low', 'high', 'middle', 'verdict', 'assumptions')} for p in work['points']],
}
# 現行 src/wizard/labels.ts の INCOME_LABEL / ASSETS_LABEL。サンプルは inc=lt400・as=lt100
income = ["400万円以下", "400〜600万円", "600〜800万円", "800〜1000万円", "1000万円以上", "答えたくない"]
assets = ["100万円以下", "100〜300万円", "300〜500万円", "500〜1000万円", "1000万円以上", "分からない"]
opts = lambda xs: ''.join(f'<option{" selected" if i == 0 else ""}>{html.escape(x)}</option>' for i, x in enumerate(xs))
s = open(tpl).read().replace('__SAMPLE__', json.dumps(sample, ensure_ascii=False)).replace('__INCOME__', opts(income)).replace('__ASSETS__', opts(assets))
open(f'{out}/index.html', 'w').write(s.replace('__ASSET__', 'assets/'))
open(f'{out}/prototype/index.html', 'w').write(s.replace('__ASSET__', '../assets/'))
print('built', len(sample['death']), 'ages,', len(sample['sickness']), 'sickness')
