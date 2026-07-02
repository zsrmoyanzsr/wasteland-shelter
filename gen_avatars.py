import requests, urllib.parse, time, os

# 统一风格 prompt: 废土幸存者、半身像、二次元精致、纯色背景(便于圆形裁剪)
# 不同角色特征保证多样性
characters = [
    ("brave scout girl, short brown hair, green eyes", "ffd5dc"),
    ("cute medic girl, long pink hair, blue eyes", "b6e3f4"),
    ("cool soldier woman, black ponytail, red eyes", "c0aede"),
    ("gentle engineer girl, glasses, blonde bun", "ffdfbf"),
    ("fierce scavenger girl, white short hair, golden eyes", "d1f4d6"),
    ("mysterious trader woman, purple long hair, violet eyes", "f4d1e8"),
    ("young farmer girl, orange twin tails, green eyes", "d4f1f4"),
    ("veteran hunter woman, silver hair, sharp eyes", "fce4b6"),
    ("cheerful mechanic girl, cyan bob cut, amber eyes", "e4d1f4"),
    ("stoic leader woman, dark blue hair, grey eyes", "d1f4e4"),
    ("wild raider girl, red messy hair, one eye covered", "f4e4d1"),
    ("kind nurse girl, lavender hair, soft smile", "d1e4f4"),
]

base = "anime style digital painting, {desc}, post-apocalyptic wasteland survivor, head and shoulders portrait, looking at viewer, beautiful detailed face, high quality, clean solid {bg} background, centered composition, game character avatar"
outdir = "public/avatars"
os.makedirs(outdir, exist_ok=True)

for i, (desc, bg) in enumerate(characters):
    prompt = base.format(desc=desc, bg=bg)
    url = f"https://image.pollinations.ai/prompt/{urllib.parse.quote(prompt)}?width=512&height=512&seed={i*7+100}&nologo=true&model=flux"
    fn = f"{outdir}/girl_{i}.png"
    # 已存在则跳过(可断点续传)
    if os.path.exists(fn) and os.path.getsize(fn) > 5000:
        print(f"[{i+1}/12] {fn} 已存在,跳过")
        continue
    try:
        r = requests.get(url, timeout=180)
        if r.status_code == 200 and len(r.content) > 5000:
            with open(fn, "wb") as f: f.write(r.content)
            print(f"[{i+1}/12] OK {len(r.content)//1024}KB -> girl_{i}.png")
        else:
            print(f"[{i+1}/12] FAIL status={r.status_code} size={len(r.content)}")
    except Exception as e:
        print(f"[{i+1}/12] ERR: {e}")
    time.sleep(1)  # 礼貌间隔
print("DONE")
