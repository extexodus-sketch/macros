import re, html, json, glob, sys
out = []
for fn in sorted(glob.glob(sys.argv[1] + '/list_*.html')):
    t = open(fn, encoding='utf-8', errors='ignore').read()
    for m in re.finditer(r"<tr>\s*<td class='text_cen'>([A-Z]\d+)</td>\s*<td>(.*?)</td>\s*<td[^>]*>(.*?)</td>\s*<td>(.*?)</td>\s*<td[^>]*>(.*?)</td>", t, flags=re.S):
        fid, name, sci, alt, ep = [html.unescape(re.sub(r'<[^>]+>', '', x)).strip() for x in m.groups()]
        start = t.find('id="proximates' + fid + '"', m.end())
        block = t[start:start + 6000]
        def val(label):
            mm = re.search(re.escape(label) + r'.*?<strong>(.*?)</strong>', block, flags=re.S)
            if not mm: return None
            v = html.unescape(re.sub(r'<[^>]+>', '', mm.group(1))).strip()
            try: return float(v)
            except ValueError: return v
        out.append(dict(id=fid, name=name, alt=alt, ep=ep, kcal=val('Energy, calculated (kcal)'), p=val('Protein (g)'),
                        f=val('Total Fat (g)'), c=val('Carbohydrate, total (g)'), fib=val('Fiber, total dietary (g)')))
json.dump(out, open(sys.argv[2], 'w'), indent=0, ensure_ascii=False)
print(len(out))
for r in out[:3]: print(r)
import collections; print(collections.Counter(r['id'][0] for r in out))
