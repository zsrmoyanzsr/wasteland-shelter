# 头像/立绘图目录

把女性角色立绘 PNG 放进这个文件夹,然后在 `manifest.json` 里列出文件名,
游戏会自动加载并显示在居民卡片、详情、招募界面。

## 使用步骤

1. 把图片放进本目录(`public/avatars/`),例如 `girl1.png`、`anime_a.png`
2. 编辑 `manifest.json`,把文件名加进去:
   ```json
   ["girl1.png", "anime_a.png", "soldier_girl.png"]
   ```
3. 刷新游戏页面即可看到立绘

## 要求
- 格式: PNG / JPG / WEBP
- 建议尺寸: 正方形(如 256×256、512×512),脸部居中
- 人物脸部最好占图片主体,头像会做圆形裁剪
- 立绘是"头部+肩部"的半身像效果最好

## 图片来源建议(个人自用)
- 用 AI 绘画工具生成(Stable Diffusion / NovelAI / 即梦 / 文心一格等),
  prompt 例: `anime girl portrait, upper body, looking at viewer, detailed face, high quality`
- 从开源图站找(CC0):  pixabay / unsplash(真人) 
- 自己画

## 没有图也能玩
如果 `manifest.json` 不存在、为空、或图片加载失败,
游戏会**自动回退**到程序化绘制的扁平风女性头像(代码在 `src/ui/avatar.js`),
每个角色根据 id 生成固定的发型/发色/五官,风格统一。
