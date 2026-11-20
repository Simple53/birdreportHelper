#!/usr/bin/env python3
"""Build birdreport-exporter.user.js and console-export.js from src/core.js + taxonomy_zh_dict.json."""

from pathlib import Path
import json

ROOT = Path(__file__).resolve().parent
CORE_PATH = ROOT / "src" / "core.js"
DICT_PATH = ROOT / "taxonomy_zh_dict.json"
USERSCRIPT_PATH = ROOT / "birdreport-exporter.user.js"
CONSOLE_PATH = ROOT / "console-export.js"

PLACEHOLDER = "/*__TAXONOMY_DICT__*/ { orders: {}, families: {}, genera: {} }"

USERSCRIPT_HEADER = """// ==UserScript==
// @name         中国观鸟记录中心 - 郑四总鸟种首加时间线 & 全量记录一键导出
// @namespace    https://github.com/Simple53/birdreportHelper
// @version      1.3.0
// @description  一键分页拉取中国观鸟记录中心全量记录，按郑四总鸟种首加时间线关联首见地点，补全目/科/属/种与拉丁学名，支持导出多表 Excel (.xlsx) / CSV / JSON。
// @author       Simple53
// @homepageURL  https://github.com/Simple53/birdreportHelper
// @supportURL   https://github.com/Simple53/birdreportHelper/issues
// @updateURL    https://raw.githubusercontent.com/Simple53/birdreportHelper/main/birdreport-exporter.user.js
// @downloadURL  https://raw.githubusercontent.com/Simple53/birdreportHelper/main/birdreport-exporter.user.js
// @match        https://www.birdreport.cn/*
// @match        http://www.birdreport.cn/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

"""

CONSOLE_HEADER = """// ============================================================================
// 中国观鸟记录中心 - 免安装控制台一键导出脚本 (v1.3.0)
// 使用方法：
//   1. 浏览器登录 https://www.birdreport.cn/member/index.html
//   2. 按 F12 打开开发者工具 -> 切换到 Console（控制台）
//   3. 复制本文件全部内容粘贴进去并回车，即弹出可视化一键导出面板
// ============================================================================
window.__BREX_AUTO_OPEN__ = true;
"""


def main():
    core_src = CORE_PATH.read_text(encoding="utf-8")
    if PLACEHOLDER not in core_src:
        raise RuntimeError(f"Placeholder not found in {CORE_PATH}")

    tax_dict = json.loads(DICT_PATH.read_text(encoding="utf-8"))
    tax_js = json.dumps(tax_dict, ensure_ascii=False, separators=(",", ":"))
    bundled = core_src.replace(PLACEHOLDER, tax_js, 1)

    USERSCRIPT_PATH.write_text(USERSCRIPT_HEADER + bundled, encoding="utf-8")
    CONSOLE_PATH.write_text(CONSOLE_HEADER + bundled, encoding="utf-8")

    print(
        f"Built successfully:\n"
        f"  - {USERSCRIPT_PATH.name} ({USERSCRIPT_PATH.stat().st_size:,} bytes)\n"
        f"  - {CONSOLE_PATH.name} ({CONSOLE_PATH.stat().st_size:,} bytes)\n"
        f"  Taxonomy coverage: {len(tax_dict['orders'])} orders, "
        f"{len(tax_dict['families'])} families, {len(tax_dict['genera'])} genera"
    )


if __name__ == "__main__":
    main()
