---
sidebar_position: 2
title: コードブロックを書く
---

# コードブロックを書く

コマンドやプログラム、設定ファイルの中身は、コードブロックで書きます。

## 書き方の基本

バッククォート3つ（` ``` `）で前後を囲みます。
最初の ` ``` ` の後ろに言語名を書くと、色分けされます。

````md
```python
def hello(name):
    print(f"こんにちは、{name}さん")
```
````

表示例：

```python
def hello(name):
    print(f"こんにちは、{name}さん")
```

よく使う言語名は次のとおりです。

| 言語名 | 用途 |
|---|---|
| `bash` | Linux のコマンド |
| `powershell` | Windows のコマンド |
| `python` / `java` / `ts` / `js` | プログラム |
| `sql` | SQL |
| `json` / `yaml` | 設定ファイル |
| `text` | 色分けしない普通の文字 |

## ファイル名を付ける

言語名の後ろに `title="ファイル名"` を書くと、上にファイル名が表示されます。

````md
```json title="config.json"
{
  "name": "sample",
  "version": "1.0.0"
}
```
````

表示例：

```json title="config.json"
{
  "name": "sample",
  "version": "1.0.0"
}
```

## 行番号を付ける

言語名の後ろに `showLineNumbers` を書くと、行番号が表示されます。

````md
```sql showLineNumbers
SELECT id, name
FROM users
WHERE deleted_at IS NULL;
```
````

表示例：

```sql showLineNumbers
SELECT id, name
FROM users
WHERE deleted_at IS NULL;
```

## 特定の行を目立たせる

言語名の後ろに `{行番号}` を書くと、その行の背景色が変わります。
`{1,3}` のように複数書いたり、`{2-4}` のように範囲で書いたりもできます。

````md
```bash {2}
cd docs
npm run build
```
````

表示例：

```bash {2}
cd docs
npm run build
```

## 文章の中に短いコードを書く

文章の中でコマンド名やファイル名を書くときは、バッククォート1つで囲みます。

```md
`npm start` を実行して、`docs/sidebars.ts` を開きます。
```

表示例：`npm start` を実行して、`docs/sidebars.ts` を開きます。

:::tip コピーボタン
コードブロックの右上にマウスを乗せると、コピーボタンが表示されます。
読む人がコマンドをそのまま貼り付けられるので、手順書ではコマンドをコードブロックで書くのがおすすめです。
:::
