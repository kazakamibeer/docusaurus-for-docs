---
sidebar_position: 2
title: フォルダを追加する
---

# フォルダを追加する

ページが増えてきたら、フォルダを作ってまとめます。
タブの中にフォルダを作ると、左メニューに折りたためるグループ（カテゴリ）ができます。

## 手順

例として、「Tutorial」タブに「設計書」というグループを作り、その中にページを2つ置きます。

### 1. フォルダとファイルを作る

```text
docs/docs/tutorial/
└── design/                 ← 新しいフォルダ
    ├── _category_.json     ← グループの設定（任意）
    ├── api-design.md
    └── table-design.md
```

フォルダの中に Markdown ファイルを置くだけで、左メニューに `design` というグループが表示されます。

### 2. グループの名前と並び順を決める（`_category_.json`）

フォルダ名は URL に使われるため、半角英数字にしておくのがおすすめです。
左メニューに日本語の名前を出したいときは、フォルダの中に `_category_.json` を置きます。

```json title="docs/docs/tutorial/design/_category_.json"
{
  "label": "設計書",
  "position": 3,
  "link": {
    "type": "generated-index",
    "description": "システム設計に関するドキュメントです。"
  }
}
```

| 項目 | 意味 |
|---|---|
| `label` | 左メニューに表示されるグループ名 |
| `position` | 左メニューでの並び順。小さい数字ほど上に表示されます |
| `link` | グループ名をクリックしたときに、中のページ一覧を表示します（任意） |

`link` の `description` に書いた文章は、ページ一覧の上に表示されます。
このチュートリアルの「基本の使い方」「Tips」も、この仕組みでページ一覧を出しています。

## フォルダの中にフォルダを作る

フォルダの中にさらにフォルダを作ることもできます。
左メニューもその形のまま入れ子になります。

```text
docs/docs/tutorial/
└── design/
    ├── _category_.json
    ├── api-design.md
    └── batch/              ← フォルダの中のフォルダ
        ├── _category_.json
        └── daily-batch.md
```

:::tip 深くしすぎない
入れ子が深すぎると、目的のページを探しにくくなります。
2〜3階層までにしておくと見通しがよくなります。
:::
