---
sidebar_position: 4
title: ローカルで確認して公開する
---

# ローカルで確認して公開する

追加したページは、GitHub に push するとサイトに反映されます。
push する前に、自分の PC で表示を確認しておくと安心です。

## 公開までの流れ

1. ファイルを追加・編集する
2. 自分の PC で表示を確認する（任意、ただしおすすめ）
3. `main` ブランチに push する
4. GitHub Actions が自動でサイトを作り直し、GitHub Pages に公開する

公開の状況は、GitHub のリポジトリページの「Actions」タブで確認できます。
緑のチェックが付けば公開完了です。赤い × が付いた場合は、サイトの更新に失敗しています。

## 自分の PC で確認する

### 準備（最初の1回だけ）

Node.js 18 以上が必要です。
WSL を使っている場合は、Windows 版ではなく WSL 側に Node.js を入れてください（nvm を使うと簡単です）。

```bash
# Node.js がどちらに入っているか確認する
which node
# /home/... と表示されれば WSL 側の Node.js なので OK
# /mnt/c/... と表示される場合は Windows 版なので、WSL 側に入れ直す
```

リポジトリの `docs` フォルダで、必要なパッケージをインストールします。

```bash
cd docs
npm ci
```

### 確認用のサーバーを起動する

```bash
cd docs
npm start
```

起動したら、ブラウザで次の URL を開きます。

```text
http://localhost:3000/docusaurus-for-docs/
```

ファイルを保存すると、ブラウザの表示も自動で更新されます。
止めるときはターミナルで `Ctrl + C` を押します。

### 公開前の最終チェック

`npm start` はリンク切れがあっても動きますが、公開時のビルドはリンク切れがあると失敗します。
push する前に、次のコマンドでエラーが出ないことを確認してください。

```bash
cd docs
npm run build
```

最後に `[SUCCESS] Generated static files in "build".` と表示されれば問題ありません。

:::danger リンク切れがあると公開に失敗します
`Docusaurus found broken links!` と表示された場合は、存在しないページへのリンクがあります。
エラーの `linking to` の後ろに、リンク先が表示されます。
ファイル名やフォルダ名を変えたときに起きやすいので、リンクを正しいパスに直してください。
:::
