# 高中词根联想 · 英语词汇

单文件（自包含）高中英语词汇学习网页应用。词库内嵌于 `index.html`，双击即可离线使用。

## 功能板块

- 单词学习 / 短句学习 / 语法学习
- **音标学习**（48 个国际音标：总表 + 听音辨音 + 认读音标）
- 词库检索 / 待复习 / 已掌握
- 小测验 / 听力测试 / 口语跟读 / 默写练习 / 测试卷 / 语法测试

## 数据来源

绿宝书系列版（主词库）+ 20 天背完高考核心词汇（高频标记 / 真题例句 / 20 天计划）+ 海豚版（校补）。共 3559 词、含音标与例句。

## 本地运行

双击 `启动.bat`（启动本地服务器，支持口语跟读），或直接双击 `index.html`。

## 手机端访问（GitHub Pages）

部署到 GitHub Pages 后，手机浏览器访问：

```
https://x13502239474-oss.github.io/english-vocabulary/
```

> 说明：学习进度存在浏览器 localStorage 中，按域名隔离，不同设备/浏览器互不相通。

## 构建

- `build_data.py`：从 EPUB 生成 `data/words.json`、`data/sents.json`、`data/meta.json`。
- `build_app.py`：从 `_template.html` 注入词库，生成 `index.html`（单文件自包含）。
- `push-github.bat`：一键推送到 GitHub（绕过代理直连）。

## 修改注意

修改界面/功能时，应改 `_template.html`，再运行 `build_app.py` 重新生成 `index.html`，
否则重跑构建会丢失对 `index.html` 的手工改动。
