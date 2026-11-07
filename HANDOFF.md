# 交接文档 · 北境词林 冷调改版收尾

> 本文件让**另一个 WorkBuddy 账号 / agent** 无需阅读历史对话即可继续完成。
> 当前账号积分耗尽（429），卡在「生成图片」，其余工作已全部做完。

## 项目位置
`C:\Users\1\WorkBuddy\2026-11-07-03-00-09\highschool-english\`

## 已经做完（不耗积分，本地文件已落盘）
1. **5 张北境冷调场景已生成并压缩**：`design/assets/` 下有 5 张北境 PNG
   （Nordic 高地 / 霜晨 / 松林 / 城堡门 / 石庭），已由 `design/prepare_north.py`
   裁水印压缩进 `assets/scene-01..05.jpg` 与 `assets/hero.jpg`。
2. **品牌改名「北境词林 / THE NORTHERN LEXICON」**，拉丁卷首题铭 `SYLVA BOREALIS`：
   改在源文件 `design/apply.py`、`design/theme.js`、`design/theme.css`、
   `build_app.py`（页面 title）、`README.md`，已 `apply.py → build_app.py` 重建进 `index.html`。
3. **冷调配色**：`design/theme.css` 的 `:root` 色板整体去暖转冷（冷白纸、钢蓝灰字、黄铜→钢色、朱红留作点睛），
   hero 遮罩由暗蒙版改为浅色蒙版 + 深字，页边静物图临时加了冷滤镜兜底。
4. **场景名改为北境冷调**：`BOREALIS 北境黎明 / PRUINA 霜华清晨 / SILVA 寒松密林 / PORTA 雪堡之门 / ATRIUM 冷石内庭`
   （`design/theme.js` 的 `SCENES` 数组）。
5. 本地已验证：`http://127.0.0.1:8000` 正常，桌面/手机截图在 `design/preview/north-*.png`。

## 剩余唯一任务（需消耗积分：约 5–10 分，1 张图）
把页边静物图 `assets/relics.jpg` 换成**冷调版**（当前是暖色烛光静物，与冷界面略冲突，
虽已加冷滤镜兜底，但 regenerate 后更统一）。

### 用 ImageGen 生成，提示词如下（照抄即可）：
```
Photorealistic museum still-life photograph of medieval knightly objects arranged on pale weathered limestone:
a heavily notched and pitted iron longsword lying diagonally, worn leather grip, tarnished steel crossguard,
beside a kite shield with a faded crimson heraldic cross, a rolled parchment bound with leather cord and a broken red wax seal,
a few iron rivets and a sprig of frosted meadow grass.
Cool clear winter daylight from a high arched window, bright but soft, cool blue-grey shadows,
shallow depth of field, cold muted background of pale stone.
Absolutely no candlelight, no warm tone, no text, no letters, no logo, no watermark, no cartoon, no flat vector, no illustration.
```
- size: `1024x1024`，quality: `high`
- 输出到项目 `assets/` 后，命名为 `relics.jpg` 覆盖原文件（保持文件名不变，代码无需改）。

### 不想换图也行
当前冷滤镜兜底已能看，可直接跳过本步，交付就是「暖静物 + 冷界面」的混搭风。

## 收尾命令（另一个 agent 跑）
```bat
cd C:\Users\1\WorkBuddy\2026-11-07-03-00-09\highschool-english
python design/apply.py        &&  echo 注入完成
python build_app.py           &&  echo 构建完成
python -m http.server 8000 --bind 127.0.0.1
:: 浏览器打开 http://127.0.0.1:8000 验证
```
> 注意：若改了 `design/theme.css` / `theme.js` / `apply.py` 任意源文件，必须重跑 `apply.py` 再 `build_app.py`，
> 因为 `index.html` 由这两步从模板生成。直接改 `index.html` 会被下次构建覆盖。

## 若想重做全部 5 张场景（可选，约 25–50 分）
`design/assets/` 里 5 张北境 PNG 已是冷调。若要更统一/更高清，可重新生成 5 张宽幅场景
（提示词同本轮：北境清冷白日 + 雪峰松林石堡重甲骑士，分别取 黎明/霜晨/松林/城堡门/石庭 五种构图），
生成后用 `design/prepare_north.py` 重新压缩（脚本已写好，会自动按文件名前缀匹配最新 PNG）。

## 已知未做项（与本次无关，原样保留）
- GitHub Pages 未重新部署（`assets/` 整目录需与 `index.html` 一起上传）。
- 深色模式未做（刻意保持单一冷白世界）。
- 麦克风跟读、在线语音、打印样式仅做页面级检查。
