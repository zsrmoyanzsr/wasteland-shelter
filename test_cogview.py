import requests, json, sys
key = "290f8a6257184726b47ca816a6d746a6.HCBWWu22rhohiB5L"
# 智谱 CogView-4 文生图 API
url = "https://open.bigmodel.cn/api/paas/v4/images/generations"
headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
payload = {
    "model": "cogview-4-250304",
    "prompt": "二次元风格,一个废土女幸存者角色头像,半身像,看向镜头,精致五官,高质量立绘,简洁纯色背景",
    "size": "1024x1024"
}
try:
    r = requests.post(url, headers=headers, json=payload, timeout=60)
    print("status:", r.status_code)
    data = r.json()
    if "data" in data and len(data["data"]) > 0:
        url_img = data["data"][0].get("url", "")
        print("got image url:", url_img[:80] + "..." if url_img else "NO URL")
        # 下载
        if url_img:
            ir = requests.get(url_img, timeout=30)
            with open("/tmp/cogview_test.png", "wb") as f:
                f.write(ir.content)
            print("downloaded:", len(ir.content), "bytes")
    else:
        print("response:", json.dumps(data, ensure_ascii=False)[:300])
except Exception as e:
    print("ERROR:", e)
