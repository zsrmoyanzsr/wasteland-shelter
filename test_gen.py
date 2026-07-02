import requests, json

# 思路1: 用 zswd/free 的一些公开图像代理(不稳定但试试)
# 思路2: pollinations.ai —— 完全免费、免key的AI生图服务!
print("=== 试 pollinations.ai (免key免费AI生图) ===")
import urllib.parse
prompt = "anime girl survivor portrait, head and shoulders, looking at viewer, detailed face, post apocalyptic, clean solid color background, high quality"
seed = 42
url = f"https://image.pollinations.ai/prompt/{urllib.parse.quote(prompt)}?width=512&height=512&seed={seed}&nologo=true"
try:
    r = requests.get(url, timeout=90)
    print("status:", r.status_code, "type:", r.headers.get("content-type"), "size:", len(r.content))
    if r.status_code == 200 and "image" in r.headers.get("content-type",""):
        with open("/tmp/pollinations_test.png","wb") as f: f.write(r.content)
        print("SAVED /tmp/pollinations_test.png")
    else:
        print("resp head:", r.text[:200])
except Exception as e:
    print("ERR:", e)
