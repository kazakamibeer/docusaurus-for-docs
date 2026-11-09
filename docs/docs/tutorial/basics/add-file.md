---
sidebar_position: 1
title: ファイルを追加する
---

# ファイルを追加する

ページを1つ増やすには、Markdown ファイル（`.md`）を1つ追加します。

## ドキュメントを置く場所

リポジトリの中で、ドキュメントを置く場所は `docs/docs/` フォルダです。

```text
docusaurus-for-docs/          ← リポジトリのルート
└── docs/                     ← Docusaurus 本体（設定ファイルなど）
    ├── docusaurus.config.ts  ← サイト全体の設定
    ├── sidebars.ts           ← サイドバー（左メニュー）の設定
    ├── static/img/           ← サイト全体で使う画像
    └── docs/                 ← ★ ドキュメントはここに置く
        ├── tutorial/         ← 「Tutorial」タブの中身
        └── image-recognition/ ← 「DL-画像認識ハンズオン」タブの中身
```

`docs/docs/` の下にあるフォルダが、それぞれ1つのタブに対応しています。
たとえば `docs/docs/tutorial/` に置いたファイルは「Tutorial」タブに表示されます。

## 手順

例として、「Tutorial」タブに `sample.md` というページを追加します。

### 1. ファイルを作る

`docs/docs/tutorial/sample.md` を作り、次のように書きます。

```md title="docs/docs/tutorial/sample.md"
---
sidebar_position: 10
title: サンプルページ
---

# サンプルページ

ここに本文を書きます。
```

### 2. ブラウザで確認する

ローカルで確認する場合は、[ローカルで確認して公開する](./publish.md) の手順でサイトを起動します。
左メニューに「サンプルページ」が増えていれば成功です。

## 先頭の `---` で囲んだ部分（フロントマター）

ファイルの先頭で `---` に囲まれた部分を **フロントマター** と呼びます。
ページの設定を書く場所で、書かなくても動きますが、次の3つはよく使います。

| 項目 | 意味 | 例 |
|---|---|---|
| `title` | ページのタイトル。左メニューとブラウザのタブに表示されます | `title: サンプルページ` |
| `sidebar_position` | 左メニューでの並び順。小さい数字ほど上に表示されます | `sidebar_position: 1` |
| `sidebar_label` | 左メニューだけ、タイトルとは別の名前にしたいときに使います | `sidebar_label: サンプル` |

`sidebar_position` を書かないファイルは、ファイル名の順に並びます。

## ファイル名のルール

- ファイル名は **半角英数字とハイフン** にするのがおすすめです（例：`api-design.md`）。
  ファイル名がそのまま URL になるため、日本語にすると URL が読みにくくなります。
- 日本語の名前は、フロントマターの `title` に書きます。
- 拡張子は `.md` を使います。

ファイル名と URL は次のように対応します。

| ファイルの場所 | ページの URL |
|---|---|
| `docs/docs/tutorial/intro.md` | `/docs/tutorial/intro` |
| `docs/docs/tutorial/basics/add-file.md` | `/docs/tutorial/basics/add-file` |

:::warning ファイル名や場所を変えるときの注意
ファイル名やフォルダを変えると URL も変わります。
ほかのページからそのページへのリンクがあると、リンク切れになってサイトの更新が失敗します。
名前を変えたときは、リンクも一緒に直してください。
:::
