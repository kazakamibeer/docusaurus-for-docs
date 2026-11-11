---
sidebar_position: 2
title: 【画像認識ハンズオン】Step 1
---

# Step 1 詳細手順：ローカル PC（WSL）で画像から人物を検出する

[[image-video-recognition-google-cloud-handson]] の Step 1 を、普段 Python を使わない人でも進められるように詳しく書いた手順書です。

## 0. この手順書について

### このステップで作るもの

写真を1枚読み込み、写っている人物（と他の物体）を AI で見つけて、枠とラベルを描いた画像を保存する Python プログラムです。

```text
sample.jpg（入力）  →  main.py（YOLO で検出）  →  result.jpg（枠付きの画像）
                                                 →  画面に「何が・どれくらいの自信で・どこに」を表示
```

### かかる時間

| 作業                               | 目安                                   |
| ---------------------------------- | -------------------------------------- |
| 環境の準備（第1〜2章）             | 30〜60分（ほとんどがダウンロード待ち） |
| プログラムの作成と実行（第3〜4章） | 30分                                   |
| 結果の読み方と練習（第5〜6章）     | 1〜2時間                               |

### 前提

- Windows 11 の PC に、WSL2 の Ubuntu が入っていること（確かめ方は 1-1）
- インターネットに接続できること（ライブラリと AI モデルのダウンロードに使います。合計で約400MB）
- ディスクの空きが 5GB 以上あること
- WSL での開発が会社のルールで認められていること

### Windows ではなく WSL で動かす理由

この PC では、Windows 11 の **Smart App Control**（スマート アプリ コントロール）がオンになっています。署名のないプログラムを止める仕組みで、AI の計算に使う PyTorch の `torch.dll` が読み込めません。Windows で動かそうとすると、次のようなエラーになります。

```text
OSError: [WinError 4551] アプリケーション制御ポリシーによってこのファイルがブロックされました。
Error loading "...\torch\lib\torch.dll" or one of its dependencies.
```

WSL の中で動く Linux のプログラムは、この仕組みの対象外です。そのため、この手順書ではすべての作業を **WSL の Ubuntu** の中で行います。

### この手順書で選んでいる方法と、その理由

このあとの Step 2〜8 でつまずかないように、最初から次の方法を選んでいます。

| 選んだ方法                                               | 理由（どの Step につながるか）                                                                                          |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **WSL2 の Ubuntu** で動かす                              | Windows では PyTorch が動きません。また、Step 6 の Docker イメージも Linux なので、ローカルとクラウドの環境がそろいます |
| プロジェクトは **WSL の中（`~/dev/`）** に置く           | Windows のフォルダ（`/mnt/c/...`）に置くと、ファイルの読み書きがとても遅くなります                                      |
| Python は **uv で入れる**（apt の Python は使わない）    | Python 本体とライブラリをプロジェクトごとに管理でき、Ubuntu の Python とぶつかりません                                  |
| uv は **0.13.7** を入れる                                | Step 4・6 の Dockerfile で使う uv と同じ版にするためです                                                                |
| Python は **3.13** にそろえる                            | Step 6 の Docker イメージ（`python:3.13-slim`）と同じ版にするためです                                                   |
| PyTorch は **CPU 版** を入れる                           | Linux で普通に入れると GPU 版（数GB）になります。CPU 版は約200MBで、Step 6 の Docker イメージとも同じになります         |
| ライブラリは **`uv add`** で入れ、`uv.lock` を残す       | Step 6 で、Docker の中に同じ版のライブラリをそのまま再現します（`uv sync --frozen`）                                    |
| **`lap`** も今のうちに入れる                             | Step 2 の追跡（ByteTrack）で必要です。あとから自動で入れようとして失敗することがあります                                |
| ファイルはすべて**プロジェクトの一番上のフォルダ**に置く | Step 6 の Dockerfile は、一番上にある `yolo11n.pt`・`video.py` などをコピーします                                       |
| **Git** で変更を記録する                                 | Step 7 で、CPU 版と GPU 版の設定をブランチで分けます                                                                    |

## 1. ツールを準備する

### 1-1. Ubuntu のターミナルを開く

コマンドを打つ画面を「ターミナル」と呼びます。この手順書のコマンドは、すべて **Ubuntu のターミナル**で実行します。

1. スタートメニューで「Ubuntu」と入力し、出てきた「Ubuntu」を開きます（Windows ターミナルのタブの「∨」から「Ubuntu」を選んでも開けます）
2. 次のように表示されていれば準備完了です

```text
ユーザー名@PC名:~$
```

`PS C:\...>` と表示される画面は Windows の PowerShell です。ここでコマンドを打つと Windows で動いてしまい、PyTorch が止められます。**行頭が `ユーザー名@PC名:` になっていることを毎回確認します。**

Ubuntu が見つからない場合は、WSL が入っていません。PowerShell で `wsl --install -d Ubuntu-24.04` を実行すると入りますが、会社の PC では情報システム担当に確認してから行います。

この手順書のコマンドは、灰色の枠の中身をコピーしてターミナルに貼り付け、Enter キーで実行します。`#` で始まる行は説明（コメント）なので、貼り付けても何も起きません。Ubuntu のターミナルでは、`Ctrl + Shift + V` で貼り付けられます（右クリックでも貼り付けられます）。

#### 最低限の Linux の操作

| コマンド              | 意味                                                      |
| --------------------- | --------------------------------------------------------- |
| `pwd`                 | 今いるフォルダを表示する                                  |
| `ls`                  | 今いるフォルダのファイルを一覧する                        |
| `cd フォルダ名`       | フォルダに移動する（`cd ~` で自分のホームフォルダに戻る） |
| `mkdir -p フォルダ名` | フォルダを作る（すでにあってもエラーにならない）          |
| `cat ファイル名`      | ファイルの中身を表示する                                  |
| `cp 元 先`            | ファイルをコピーする                                      |
| `explorer.exe .`      | 今いるフォルダを Windows のエクスプローラーで開く         |

`~` は自分のホームフォルダ（`/home/ユーザー名`）を表します。Windows の C ドライブは `/mnt/c` として見えます。

### 1-2. OpenCV が使うライブラリを入れる

OpenCV（画像を扱うライブラリ）は、Ubuntu の部品をいくつか使います。

```bash
sudo apt update
sudo apt install -y libgl1 libglib2.0-0t64
```

`sudo` を付けたコマンドは、Ubuntu のパスワードを聞かれます（WSL を最初に設定したときに決めたもの。Windows のパスワードとは別です）。入力中は画面に何も表示されませんが、そのまま入力して Enter を押します。すでに入っている場合は、何も変わりません。

### 1-3. uv を入れる

**uv** は、Python 本体とライブラリ（追加の部品）をまとめて管理するツールです。これ1つで Python のインストールまで済みます。

```bash
curl -LsSf https://astral.sh/uv/0.13.7/install.sh | sh
source $HOME/.local/bin/env
uv --version
```

`uv 0.13.7` と表示されれば成功です。

- 2行目は、入れたばかりの uv を今のターミナルで使えるようにするものです。次にターミナルを開いたときからは不要です。
- Windows 側に uv を入れていても、WSL の uv とは別物です。この手順書では WSL の uv だけを使います。

URL の `0.13.7` は、Step 4・6 の Dockerfile で使う uv の版（`ghcr.io/astral-sh/uv:0.13.7`）とそろえています。`uv.lock` の書き方は uv の版によって変わることがあり、Docker の中の uv がローカルより古いと、`uv.lock` を読めずにビルドが失敗するためです。あとで `uv self update` などで uv を新しくしたときは、Dockerfile の版も同じ数字に書き換えます。

> **Python を別に入れなくてよいの？**
> 入れなくて構いません。次の章で、uv が Python 3.13 を自動でダウンロードします。Ubuntu に最初から入っている Python（`python3`）とは分けて使うので、影響しません。

### 1-4. Git の初期設定をする

**Git** は、ファイルの変更履歴を残すツールです。Ubuntu には最初から入っています。記録に残す名前とメールアドレスを設定します（初めて使う場合だけ）。

```bash
git config --global user.name "あなたの名前"
git config --global user.email "あなたのメールアドレス"
```

### 1-5. VS Code を入れる（推奨）

**VS Code** は、プログラムを書くためのエディタです。色分けや入力補完があると、間違いに気づきやすくなります。VS Code は Windows 側に入れ、WSL の中のファイルを編集できるようにします。

1. Windows に VS Code を入れる（PowerShell で `winget install --id Microsoft.VisualStudioCode -e`。すでに入っていれば不要）
2. VS Code の拡張機能で「**WSL**」（Microsoft 製）を入れる
3. 第2章でプロジェクトを作ったあとに、Ubuntu のターミナルで `code .` を実行すると、WSL の中のフォルダを開いた VS Code が起動する
4. 拡張機能の「**Python**」（Microsoft 製）を、「WSL: Ubuntu にインストール」のボタンで入れる

## 2. プロジェクトを作る

### 2-1. 置き場所を決める

プロジェクトのフォルダは、WSL の中の次の場所に作ります。

```text
~/dev/image-recognition-handson
```

Windows のエクスプローラーからは、`\\wsl.localhost\Ubuntu\home\ユーザー名\dev\image-recognition-handson` として見えます。

次の場所は避けます。

| 避ける場所                              | 理由                                                                                            |
| --------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `/mnt/c/...`（Windows のフォルダ）      | WSL から Windows のフォルダへの読み書きは遅く、ライブラリのインストールや実行に時間がかかります |
| この手順書がある Obsidian の Vault の中 | ライブラリのファイルが数千個あり、Vault が重くなります                                          |

Windows 側にプロジェクトを作りかけていた場合（`C:\Users\ユーザー名\dev\image-recognition-handson` など）、そのフォルダは使いません。不要なら削除して構いません。

### 2-2. フォルダを作り、プロジェクトを初期化する

```bash
mkdir -p ~/dev/image-recognition-handson
cd ~/dev/image-recognition-handson

# Python 3.13 を使うアプリのプロジェクトとして初期化する
uv init --app --no-package --python 3.13
```

`--app --no-package` は、「配布用のパッケージではなく、このフォルダでそのまま動かすプログラム」として作る指定です。uv 0.13 では、付けないと `src/` フォルダの中にファイルを置く形（パッケージの形）で作られ、`main.py` ができません。

`uv init` で、次のファイルができます。

| ファイル          | 中身                                                                |
| ----------------- | ------------------------------------------------------------------- |
| `pyproject.toml`  | プロジェクトの設定。使うライブラリの一覧がここに書かれる            |
| `.python-version` | 使う Python の版（`3.13`）。Step 6 の Docker でもこのファイルを使う |
| `main.py`         | 練習用のプログラム（第3章で書き換える）                             |
| `README.md`       | プロジェクトの説明を書くファイル                                    |
| `.gitignore`      | Git に入れないファイルの一覧                                        |
| `.git` フォルダ   | Git の記録（`ls -a` で見える）                                      |

`.python-version` の中身が `3.13` になっていることを確認します。

```bash
cat .python-version
```

### 2-3. PyTorch を CPU 版にする設定を入れる

AI の計算を行う **PyTorch** は、Linux でそのまま入れると GPU 版になり、数GBのダウンロードになります。このハンズオンのローカルと Step 6 の VM では GPU を使わないので、CPU 版（約200MB）を使うように設定します。

次のコマンドは、`pyproject.toml` の末尾に設定を書き足します。`EOF` の行まで、まとめてコピーして貼り付けます。

```bash
cat >> pyproject.toml <<'EOF'

[[tool.uv.index]]
name = "pytorch-cpu"
url = "https://download.pytorch.org/whl/cpu"
explicit = true

[tool.uv.sources]
torch = [{ index = "pytorch-cpu" }]
torchvision = [{ index = "pytorch-cpu" }]
EOF
```

書き足した内容の意味は次のとおりです。

- `[[tool.uv.index]]`：PyTorch の CPU 版の置き場所（`pytorch-cpu`）を登録する
- `[tool.uv.sources]`：`torch` と `torchvision` だけは、その置き場所から入れる

GPU を使う Step 7 では、この設定を外して GPU 版のイメージを作ります。

### 2-4. ライブラリを入れる

```bash
uv add torch torchvision opencv-python ultralytics lap
```

入れるライブラリは次のとおりです。

| ライブラリ             | 役割                                                     | 使う Step |
| ---------------------- | -------------------------------------------------------- | --------- |
| `torch`・`torchvision` | PyTorch（AI の計算）。2-3 の設定で CPU 版が入る          | 1〜7      |
| `opencv-python`        | 画像・動画の読み書き、図形や文字の描画                   | 1〜6      |
| `ultralytics`          | YOLO（物体検出の AI モデル）を簡単に使うためのライブラリ | 1〜7      |
| `lap`                  | 追跡（ByteTrack）の計算に使う                            | 2〜       |

`torch` と `torchvision` は `ultralytics` を入れると自動で入りますが、2-3 の設定を確実に効かせるため、名前を書いて入れます。Python 3.13 が無い場合は、このときに uv が自動でダウンロードします。ダウンロードは合計で約400MB、`.venv` フォルダは約1.3GBになり、数分かかります。

このコマンドで、次のものが増えます。

| できるもの                         | 中身                                       | 扱い                                                  |
| ---------------------------------- | ------------------------------------------ | ----------------------------------------------------- |
| `.venv` フォルダ                   | このプロジェクト専用の Python とライブラリ | 中身は触らない。Git に入れない                        |
| `uv.lock`                          | 入ったライブラリの正確な版の一覧           | 消さない。Step 6 の Docker で同じ版を再現するのに使う |
| `pyproject.toml` の `dependencies` | 入れたライブラリの名前                     | `uv add` で自動的に書き換わる                         |

CPU 版の PyTorch が入ったことを確認します。

```bash
uv run python -c "import torch; print(torch.__version__)"
```

`2.15.0+cpu` のように、最後に `+cpu` が付いていれば成功です（数字は入れた時期によって変わります）。

### 2-5. Ultralytics の利用状況の送信を止める

Ultralytics は、初期設定で匿名の利用状況を送信します。業務の PC では止めておきます。

```bash
uv run python -c "from ultralytics import settings; settings.update({'sync': False}); print(settings['sync'])"
```

`False` と表示されれば成功です。設定は `~/.config/Ultralytics/settings.json` に保存されます。次のコマンドで中身を確認できます。

```bash
cat ~/.config/Ultralytics/settings.json
```

WSL の中では `uv run yolo settings sync=False` でも同じ設定ができます（Windows では `yolo` コマンドが Smart App Control に止められます）。

### 2-6. Git に入れないファイルを追加し、最初の記録を残す

人が写った画像や動画を誤って Git に入れないように、`.gitignore` に追記します（ハンズオン計画の 3-1「使う映像のルール」）。`EOF` の行まで、まとめてコピーして貼り付けます。

```bash
cat >> .gitignore <<'EOF'

# 画像・動画・結果（人が写るため Git に入れない）
*.jpg
*.png
*.mp4
out/
out_*/

# AI モデル（再ダウンロードできる）
*.pt

# 秘密情報
.env
EOF
```

`.venv` は、`uv init` が作った `.gitignore` に最初から書かれています。

ここまでの状態を Git に記録します。Step 7 で GPU 版の設定に切り替えたあと、この状態に戻れるようにするためです。

```bash
git add -A
git commit -m "Step 1: プロジェクトを作成（PyTorch CPU 版）"
```

### 2-7. VS Code でプロジェクトを開く（任意）

```bash
code .
```

VS Code が開いたら、プロジェクトの Python 環境を選びます。入力補完が効くようになります。

1. `Ctrl + Shift + P` を押し、`Python: Select Interpreter` と入力して選ぶ
2. 一覧から `.venv` を含むもの（`./.venv/bin/python`）を選ぶ

選ばなくても、プログラムの実行には影響しません。

## 3. プログラムを書く

### 3-1. 練習用の画像を用意する

最初は、Ultralytics の公式ドキュメントで使われているサンプル画像（バスと歩行者の写真）を使います。公開されている画像なので、人が写っていても練習に使えます。

```bash
curl -L -o sample.jpg https://ultralytics.com/images/bus.jpg
```

プロジェクトのフォルダに `sample.jpg` ができます。VS Code の左のファイル一覧で `sample.jpg` をクリックするか、`explorer.exe .` でフォルダを開いてダブルクリックし、人が何人写っているか自分の目で数えておきます（第5章で AI の結果と比べます）。

自分で撮った写真を使う場合は、写っている人全員の許可を取ったものだけにします。Windows のフォルダにある写真は、次のようにコピーします。

```bash
cp /mnt/c/Users/ユーザー名/Pictures/写真.jpg my_photo.jpg
```

### 3-2. 最低限の Python の読み方

プログラムを読むのに必要な決まりは、次の5つだけです。

| 書き方                     | 意味                                                                                      |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| `# ここは説明`             | `#` から行末までは説明（コメント）。実行されない                                          |
| `CONF = 0.25`              | `CONF` という名前に `0.25` を入れる（変数）。あとで `CONF` と書くと `0.25` として使われる |
| `for box in result.boxes:` | 検出したものを1つずつ取り出して、下の字下げした部分を繰り返す                             |
| 行頭の字下げ（空白4つ）    | どこまでが `for` や `if` の中身かを表す。**ずれるとエラーになる**                         |
| `print(...)`               | 画面に表示する                                                                            |

### 3-3. main.py を書き換える

VS Code で `main.py` を開き、中身をすべて消して、次の内容に置き換えて保存します。

```python
"""Step 1：画像から人物などを検出し、結果を表示・保存する。"""
from ultralytics import YOLO

IMAGE_PATH = "sample.jpg"  # 調べる画像
MODEL_PATH = "yolo11n.pt"  # 使う AI モデル（初回は自動でダウンロードされる）
CONF = 0.25                # 信頼度のしきい値。これより自信の低い検出は捨てる

# AI モデルを読み込む
model = YOLO(MODEL_PATH)

# 画像を AI に渡して検出する
results = model(IMAGE_PATH, conf=CONF)

for result in results:
    person_count = 0

    # 見つかったものを1つずつ取り出して表示する
    for box in result.boxes:
        class_id = int(box.cls[0])            # 何か（番号）
        class_name = model.names[class_id]    # 何か（名前。0 なら "person"）
        confidence = float(box.conf[0])       # どれくらい自信があるか（0〜1）
        x1, y1, x2, y2 = box.xyxy[0].tolist()  # どこにあるか（枠の左上と右下の座標）

        print({
            "class": class_name,
            "confidence": round(confidence, 3),
            "bbox": [round(v) for v in (x1, y1, x2, y2)],
        })

        if class_id == 0:  # 0 番は person（人物）
            person_count += 1

    print(f"人物の数: {person_count}")

    # 枠とラベルを描いた画像を保存する
    result.save(filename="result.jpg")
    print("result.jpg に保存しました")
```

ハンズオン計画の Step 1 のサンプルコードに、次の2点を加えています。

- 画像の名前・モデル・しきい値を先頭にまとめ、練習（第6章）で書き換えやすくした
- 人物の数を数えて表示するようにした

## 4. 実行する

プロジェクトのフォルダ（`~/dev/image-recognition-handson`）で、次のコマンドを実行します。VS Code の中でターミナルを開く場合は `Ctrl + @` を押します（WSL で開いた VS Code なら、Ubuntu のターミナルが開きます）。

```bash
uv run python main.py
```

`uv run` を付けると、このプロジェクト専用の Python（`.venv`）で実行されます。「仮想環境を有効にする（activate）」操作は不要です。

### 初回の実行で起きること

1. AI モデル `yolo11n.pt`（約5MB）がプロジェクトのフォルダにダウンロードされる
2. 枠のラベルを描くためのフォントが、`~/.config/Ultralytics` にダウンロードされる
3. 検出が行われ、結果が表示される

2回目からはダウンロードしません。ダウンロードされた `yolo11n.pt` は、Step 6 で Docker イメージに含めるので**消さずに残しておきます**。

### 表示の例

画面には、次のような内容が表示されます（2026年11月に WSL で実行した結果です。時間の数値は PC によって、信頼度の数値はライブラリの版によって少し変わります）。

```text
Downloading https://github.com/ultralytics/assets/releases/download/v8.4.0/yolo11n.pt to 'yolo11n.pt': 100% ━━━━━━━━━━━━ 5.4MB

image 1/1 /home/ユーザー名/dev/image-recognition-handson/sample.jpg: 640x480 4 persons, 1 bus, 318.9ms
Speed: 57.3ms preprocess, 318.9ms inference, 38.5ms postprocess per image at shape (1, 3, 640, 480)
{'class': 'bus', 'confidence': 0.94, 'bbox': [4, 229, 796, 728]}
{'class': 'person', 'confidence': 0.888, 'bbox': [671, 395, 810, 879]}
{'class': 'person', 'confidence': 0.878, 'bbox': [47, 400, 239, 904]}
{'class': 'person', 'confidence': 0.856, 'bbox': [223, 409, 344, 860]}
{'class': 'person', 'confidence': 0.622, 'bbox': [0, 556, 69, 872]}
人物の数: 4
result.jpg に保存しました
```

- 1行目：初回だけ表示される、モデルのダウンロード
- `image 1/1 ...` と `Speed: ...`：Ultralytics が自動で表示するもの。「4 persons, 1 bus」は、人物4人とバス1台を見つけたという意味。`inference` は AI が考えるのにかかった時間
- `{...}` 以降：`main.py` が表示しているもの

5人目の人物（信頼度 0.622、`bbox` の x1 が 0）は、画像の左端で体の一部だけが写っている人です。信頼度が低めなのはそのためです。

`result.jpg` を VS Code の左のファイル一覧でクリックするか、`explorer.exe .` で開いて、人物に `person` と数字（信頼度）の付いた枠が描かれていることを確認します。

## 5. 結果を読み解く

### 5-1. 検出結果の3つの要素

| 要素   | プログラムでの名前 | 意味                                                               |
| ------ | ------------------ | ------------------------------------------------------------------ |
| クラス | `class`            | 何が見つかったか。`person`、`bus`、`car` など                      |
| 信頼度 | `confidence`       | AI がどれくらい自信を持っているか。0〜1 で、1 に近いほど自信がある |
| 位置   | `bbox`             | 枠の位置。`[左上の x, 左上の y, 右下の x, 右下の y]`               |

### 5-2. 座標の読み方

画像の左上が原点 `(0, 0)` です。x は右に行くほど、**y は下に行くほど**大きくなります（数学のグラフとは上下が逆です）。単位はピクセルです。

```text
(0,0) ─────────────────────► x（右へ増える）
  │
  │        (x1, y1)
  │           ┌──────┐
  │           │  人  │
  │           │      │
  │           └──────┘
  │                (x2, y2)
  ▼
  y（下へ増える）
```

たとえば第4章の例の `[47, 400, 239, 904]` なら、左上が `(47, 400)`、右下が `(239, 904)` の枠です。人物の枠では、**y2（枠の下端）がおおよそ足元の位置**になります。Step 3 で「線を越えた人数」を数えるときに、この性質を使います。

### 5-3. 学習済みモデルとクラス番号

`yolo11n.pt` は、COCO という公開データセットで学習済みのモデルです。80種類のものを見分けられ、それぞれに番号が付いています。人物（`person`）は **0 番**です。

| 番号 | 名前              | 番号 | 名前        |
| ---- | ----------------- | ---- | ----------- |
| 0    | person（人）      | 2    | car（車）   |
| 1    | bicycle（自転車） | 5    | bus（バス） |

全部の一覧は、次のコマンドで表示できます。

```bash
uv run python -c "from ultralytics import YOLO; print(YOLO('yolo11n.pt').names)"
```

人や一般的な物体を見つけるだけなら、自分でモデルを学習させる必要はありません。

### 5-4. モデルの大きさ

モデル名の最後の文字は大きさを表します。大きいほど精度が上がり、遅くなります。

| モデル                     | 大きさ       | 特徴                                       |
| -------------------------- | ------------ | ------------------------------------------ |
| `yolo11n.pt`               | 最小（nano） | 速い。このハンズオンの基本                 |
| `yolo11s.pt`               | 小（small）  | n より少し精度が高く、少し遅い             |
| `yolo11m.pt`               | 中（medium） | CPU では動画のリアルタイム処理が難しくなる |
| `yolo11l.pt`・`yolo11x.pt` | 大・特大     | GPU 向け（Step 7 で試す価値がある）        |

Ultralytics からは新しい世代のモデルも出ます。名前は変わりますが、使い方は同じです。

## 6. 練習問題

`main.py` の先頭の値を書き換えて、何度も実行してみます。結果は表にメモしておきます。

### 6-1. しきい値を変える

`CONF` を `0.1`、`0.25`、`0.5`、`0.7` に変えて、人物の数がどう変わるかを記録します。

| CONF | 人物の数 | 気づいたこと |
| ---- | -------- | ------------ |
| 0.1  |          |              |
| 0.25 |          |              |
| 0.5  |          |              |
| 0.7  |          |              |

- 低くすると：見落としは減るが、人でないものを人と間違える（誤検出）が増える
- 高くすると：誤検出は減るが、見落としが増える

3-1 で自分の目で数えた人数に一番近くなる値はどれかを確かめます。

### 6-2. 人物だけを検出する

`results = model(IMAGE_PATH, conf=CONF)` の行を次のように変えると、人物（0番）だけを探します。

```python
results = model(IMAGE_PATH, conf=CONF, classes=[0])
```

`result.jpg` から、バスなど人物以外の枠が消えることを確認します。Step 2 以降の人物の追跡では、この `classes=[0]` を使います。

### 6-3. モデルを大きくする

`MODEL_PATH` を `"yolo11s.pt"` に変えて実行します（初回はダウンロードされます）。

- 人物の数や信頼度は変わったか
- `Speed:` の行の `inference`（推論にかかった時間）はどれくらい増えたか

試し終わったら `"yolo11n.pt"` に戻します。Step 2 以降は `yolo11n.pt` を前提にしています。

### 6-4. 条件の違う画像を試す

`IMAGE_PATH` を別の画像に変えて試します。Step 3 の「精度を確かめる」の予習になります。

- 人が重なっている
- 人が遠くに小さく写っている
- 暗い
- 後ろ向き

画像は、公開データセットの画像か、写っている人の許可を取った写真だけを使います。

## 7. うまくいかないとき

| 症状                                                                       | 原因と対処                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `アプリケーション制御ポリシーによってこのファイルがブロックされました`     | Windows の PowerShell で実行している。Ubuntu のターミナル（行頭が `ユーザー名@PC名:`）で実行する                                                                                                                                 |
| `uv: command not found`                                                    | インストール直後で、uv の場所が設定されていない。`source $HOME/.local/bin/env` を実行するか、ターミナルを開き直す                                                                                                                |
| `ImportError: libGL.so.1: cannot open shared object file`                  | OpenCV が使う部品が無い。1-2 の `sudo apt install` を実行する                                                                                                                                                                    |
| `uv add` で `torch` のダウンロードが 1GB を超える                          | GPU 版が入ろうとしている。2-3 の設定が `pyproject.toml` の末尾にあるか `cat pyproject.toml` で確かめる                                                                                                                           |
| `torch.__version__` に `+cpu` が付かない                                   | 2-3 の設定より前に PyTorch が入った。設定を確かめてから `uv lock --upgrade-package torch --upgrade-package torchvision` と `uv sync` を実行する                                                                                  |
| `uv add` や モデルのダウンロードが `SSL` や `certificate` のエラーで止まる | 会社のネットワークが通信を検査している可能性がある。会社のルート証明書を Ubuntu に入れる必要がある（入れ方と証明書は情報システム担当に確認）。証明書を入れたあと、`export UV_NATIVE_TLS=true` を実行してから `uv add` をやり直す |
| `uv add` がタイムアウトする                                                | プロキシ環境の可能性がある。`export HTTPS_PROXY=http://プロキシのアドレス:ポート` を実行してからやり直す（アドレスは情報システム担当に確認）                                                                                     |
| モデルのダウンロードだけ失敗する                                           | Windows のブラウザで `https://github.com/ultralytics/assets/releases/download/v8.4.0/yolo11n.pt` を開いてダウンロードし、`cp /mnt/c/Users/ユーザー名/Downloads/yolo11n.pt ~/dev/image-recognition-handson/` でコピーする         |
| フォントのダウンロードでエラーになる                                       | Windows のフォントをコピーして代わりに使う：`mkdir -p ~/.config/Ultralytics && cp /mnt/c/Windows/Fonts/arial.ttf ~/.config/Ultralytics/Arial.ttf`                                                                                |
| `FileNotFoundError` や `sample.jpg does not exist`                         | 実行しているフォルダが違う。`cd ~/dev/image-recognition-handson` でプロジェクトのフォルダに移動してから実行する                                                                                                                  |
| `IndentationError`                                                         | 字下げがずれている。3-3 のコードをもう一度まるごと貼り付ける                                                                                                                                                                     |
| `ModuleNotFoundError: No module named 'ultralytics'`                       | `uv run` を付けずに `python main.py` と実行している。`uv run python main.py` で実行する                                                                                                                                          |
| `sudo` のパスワードが分からない                                            | WSL を最初に設定したときに決めたパスワード。忘れた場合は、PowerShell で `wsl -u root` で入って `passwd ユーザー名` で設定し直す                                                                                                  |
| `git commit` で `Please tell me who you are` と出る                        | 1-4 の Git の初期設定をしてからやり直す                                                                                                                                                                                          |
| `result.jpg` に枠が1つも無い                                               | 画像に人や物体が写っていない、または `CONF` が高すぎる。`CONF = 0.25` に戻す                                                                                                                                                     |

## 8. 完了条件

- [ ] Ubuntu のターミナルで `uv --version` が `uv 0.13.7` と表示される
- [ ] `.python-version` の中身が `3.13` になっている
- [ ] `uv.lock` があり、`pyproject.toml` に `torch`・`torchvision`・`opencv-python`・`ultralytics`・`lap` と、PyTorch の CPU 版の設定が書かれている
- [ ] `torch.__version__` の最後に `+cpu` が付いている
- [ ] `uv run python main.py` で、人物の数と検出結果が表示される
- [ ] `result.jpg` で、人物に `person` の枠が付いている
- [ ] 検出結果の3つの要素（クラス・信頼度・位置）を説明できる
- [ ] `CONF` を変えたときに、見落としと誤検出がどう入れ替わるかを説明できる
- [ ] `yolo11n.pt` がプロジェクトのフォルダに残っている
- [ ] Git に最初の記録（コミット）がある（`git log` で確認できる）

## 9. このあとの Step とのつながり

Step 1 が終わった時点のフォルダは次のようになっています（`ls -a` で確認できます）。

```text
~/dev/image-recognition-handson/
├── .git/             ← Git の記録
├── .venv/            ← このプロジェクト専用の Python とライブラリ（触らない）
├── .gitignore        ← 画像・動画・モデルを Git に入れない設定
├── .python-version   ← 3.13
├── pyproject.toml    ← 使うライブラリの一覧と、PyTorch の CPU 版の設定
├── uv.lock           ← ライブラリの正確な版
├── README.md
├── main.py           ← Step 1 のプログラム
├── yolo11n.pt        ← AI モデル
├── sample.jpg
└── result.jpg
```

このあとの Step で、次のように使います。

| Step 1 で用意したもの                          | 使う Step | 使い方                                                                       |
| ---------------------------------------------- | --------- | ---------------------------------------------------------------------------- |
| WSL の Ubuntu の環境                           | Step 2〜5 | 同じ場所で開発を続ける。Step 4 の `gcloud` も WSL に入れる                   |
| `lap`                                          | Step 2    | 追跡（ByteTrack）に使う                                                      |
| `classes=[0]`（6-2）                           | Step 2・3 | 人物だけを検出・追跡する                                                     |
| `explorer.exe .`・`/mnt/c/...` の操作          | Step 2    | カメラアプリで録画した動画を WSL にコピーし、結果の動画を Windows で再生する |
| 枠の y2 ≒ 足元（5-2）                          | Step 3    | 線を越えた人数を数える                                                       |
| `CONF` の練習（6-1）                           | Step 3    | 精度の評価で、しきい値ごとの見落としと誤検出を比べる                         |
| `uv add` の手順                                | Step 4・5 | Google Cloud 用のライブラリを同じ方法で追加する                              |
| `.python-version`・`pyproject.toml`・`uv.lock` | Step 6    | Docker の中に同じ Python とライブラリ（CPU 版の PyTorch を含む）を再現する   |
| uv 0.13.7                                      | Step 4・6 | Dockerfile の uv と同じ版                                                    |
| `yolo11n.pt`（一番上のフォルダ）               | Step 6    | Docker イメージに含め、クラウドで毎回ダウンロードしないようにする            |
| `.gitignore`                                   | Step 6    | `.gcloudignore` を作るときの参考にする                                       |
| Git の記録                                     | Step 7    | GPU 版の設定をブランチで分け、CPU 版の状態に戻れるようにする                 |

次は Step 2「ローカル PC で動画から人物を検出・追跡する」に進みます。
