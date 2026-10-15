import json, sys, urllib.request, urllib.parse
KEY = "DEMO_KEY"
NUT = {"Energy":"kcal","Protein":"p","Carbohydrate, by difference":"c","Total lipid (fat)":"f","Fiber, total dietary":"fib"}
def search(q, dt="SR Legacy,Foundation", n=3):
    url = "https://api.nal.usda.gov/fdc/v1/foods/search?" + urllib.parse.urlencode({"api_key":KEY,"query":q,"dataType":dt,"pageSize":n})
    d = json.load(urllib.request.urlopen(url, timeout=30))
    out=[]
    for f in d.get("foods",[]):
        m={}
        for n_ in f.get("foodNutrients",[]):
            nm=n_.get("nutrientName"); u=n_.get("unitName","")
            if nm in NUT and (nm!="Energy" or u=="KCAL"): m[NUT[nm]]=n_.get("value")
        out.append((f["fdcId"], f["description"], f.get("dataType"), f.get("servingSize"), f.get("servingSizeUnit"), m))
    return out
for q in sys.argv[1:]:
    dt="Branded" if q.startswith("B:") else "SR Legacy"
    qq=q[2:] if q.startswith("B:") else q
    print("##", qq)
    for r in search(qq, dt): print("  ", r)
