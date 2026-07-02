# 部署指南 · 让别人玩你的游戏

> 游戏已构建为纯静态文件(`dist/`),零后端依赖,可部署到任何静态托管。

---

## 方式 A:Netlify Drop(最快,无需账号,30秒)

**最适合临时分享,拖一下就有公开网址。**

1. 打开浏览器访问 **https://app.netlify.com/drop**
2. 把项目的 `dist/` 文件夹**直接拖到页面**上
3. 立即得到一个公开网址,如 `https://wasteland-shelter-xxx.netlify.app`
4. 把网址发给别人就能玩

**注意**: Drop 是临时部署,网址一段时间不访问可能失效。要永久保留用方式 B。

---

## 方式 B:Vercel(推荐,永久免费,自动更新)

### 准备:先构建
```bash
cd D:/project/60s
npm install
npm run build      # 生成 dist/
```

### 方法 1:命令行部署(推荐)
```bash
npm i -g vercel    # 装 CLI(或用 npx vercel)
vercel             # 首次会让你登录(用 GitHub/邮箱),然后自动部署
                    # 得到 https://wasteland-shelter-xxx.vercel.app
vercel --prod      # 正式发布(永久固定网址)
```

### 方法 2:GitHub + Vercel 自动部署(最省心)
1. 把项目推到 GitHub
2. 去 https://vercel.com → New Project → 选你的仓库
3. Vercel 自动识别 Vite(已配 vercel.json),点 Deploy
4. **以后每次 git push,Vercel 自动重新部署**,别人永远玩到最新版

---

## 方式 C:GitHub Pages(免费,适合开源)

```bash
# 1. 推到 GitHub(假设仓库名 wasteland-shelter)
# 2. 改 vite.config.js 的 base(重要!否则资源404):
#    base: "/wasteland-shelter/"  (你的仓库名)
# 3. 构建 + 部署:
npm run build
npx gh-pages -d dist
# 4. 访问 https://你的用户名.github.io/wasteland-shelter/
```

---

## 方式 D:局域网分享(同一WiFi,临时)

```bash
npm run dev    # 启动后终端会显示 Network: http://192.168.x.x:5180
               # 同一WiFi下,别人手机/电脑输这个IP就能玩(你电脑得开着)
```

---

## 构建说明

- `npm run build` 生成 `dist/`(约1.4MB,含13张内联立绘)
- **零外部依赖**: 立绘内联在JS里,avatars目录是双保险
- **存档在浏览器**: 用 localStorage,每个玩家独立存档
- `vercel.json` 已配好 SPA 重写规则(防止刷新404)

## 手机适配

游戏是竖屏 H5,手机浏览器直接打开就能玩。触摸操作已支持(点击/拖拽)。
建议手机"添加到主屏幕",体验接近原生App。
