# Step 1 詳細手順：ローカル PC で画像から人物を検出する

[[image-video-recognition-google-cloud-handson]] の Step 1 を、普段 Python を使わない人でも進められるように詳しく書いた手順書です。

## 0. この手順書について

### このステップで作るもの

写真を1枚読み込み、写っている人物（と他の物体）を AI で見つけて、枠とラベルを描いた画像を保存する Python プログラムです。

```text
sample.jpg（入力）  →  main.py（YOLO で検出）  →  result.jpg（枠付きの画像）
                                                 →  画面に「何が・どれくらいの自信で・どこに」を表示
```

### かかる時間

| 作業 | 目安 |
|---|---|
| 環境の準備（第1〜2章） | 30〜60分（ほとんどがダウンロード待ち） |
| プログラムの作成と実行（第3〜4章） | 30分 |
| 結果の読み方と練習（第5〜6章） | 1〜2時間 |

### 前提

- Windows 11 の PC（このハンズオンは Windows で進めます）
- インターネットに接続できること（ライブラリと AI モデルのダウンロードに使います）
- ディスクの空きが 5GB 以上あること
- 管理者権限は基本的に不要です（会社の PC でソフトのインストールが制限されている場合は、第1章の各ツールについて情報システム担当に確認してください）

### この手順書で選んでいる方法と、その理由

このあとの Step 2〜8 でつまずかないように、最初から次の方法を選んでいます。

| 選んだ方法 | 理由（どの Step につながるか） |
|---|---|
| WSL や DevContainer を使わず **Windows で直接動かす** | Step 2 で Web カメラを使います。WSL やコンテナからはカメラを使うのに手間がかかります |
| Python は **uv で入れる**（python.org のインストーラーは使わない） | Python 本体とライブラリをプロジェクトごとに管理でき、PC に入っている他の Python とぶつかりません |
| Python は **3.12** にそろえる | Step 6 の Docker イメージ（`python:3.12-slim`）と同じ版にするためです |
| ライブラリは **`uv add`** で入れ、`uv.lock` を残す | Step 6 で、Docker の中に同じ版のライブラリをそのまま再現します（`uv sync --frozen`） |
| **`lap`** も今のうちに入れる | Step 2 の追跡（ByteTrack）で必要です。あとから自動で入れようとして失敗することがあります |
| ファイルはすべて**プロジェクトの一番上のフォルダ**に置く | Step 6 の Dockerfile は、一番上にある `yolo11n.pt`・`video.py` などをコピーします |
| コマンドは **PowerShell** で打つ | Windows に最初から入っています。Step 4 の `gcloud` も PowerShell で使えます |

## 1. ツールを準備する

### 1-1. ターミナル（PowerShell）を開く

コマンドを打つ画面を「ターミナル」と呼びます。この手順書では Windows に最初から入っている **PowerShell** を使います。

1. スタートボタンを右クリックし、「ターミナル」を選びます
2. 開いた画面に `PS C:\Users\ユーザー名>` のように表示されていれば準備完了です

この手順書のコマンドは、灰色の枠の中身をコピーしてターミナルに貼り付け、Enter キーで実行します。`#` で始まる行は説明（コメント）なので、貼り付けても何も起きません。

### 1-2. uv を入れる

**uv** は、Python 本体とライブラリ（追加の部品）をまとめて管理するツールです。これ1つで Python のインストールまで済みます。

```powershell
winget install --id=astral-sh.uv -e
```

`winget` が使えない場合は、公式のインストーラーを使います。

```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

インストールが終わったら、**ターミナルをいったん閉じて開き直し**、次のコマンドで確認します。

```powershell
uv --version
```

`uv 0.x.x` のように版が表示されれば成功です。この版は Step 4・6 の Dockerfile（`ghcr.io/astral-sh/uv:0.8.0` の部分）に合わせるので、メモしておきます。

> **python.org から Python を入れなくてよいの？**
> 入れなくて構いません。次の章で、uv が Python 3.12 を自動でダウンロードします。すでに別の Python が入っていても、uv はプロジェクトごとに分けて使うので影響しません。

### 1-3. Git を入れる（推奨）

**Git** は、ファイルの変更履歴を残すツールです。Step 1 では必須ではありませんが、後半で「CPU 版と GPU 版でブランチを分ける」（Step 7）などに使います。入れておくと、次の章の `uv init` が Git の準備も自動で行います。

```powershell
winget install --id Git.Git -e
```

### 1-4. VS Code を入れる（推奨）

**VS Code** は、プログラムを書くためのエディタです。メモ帳でも書けますが、色分けや入力補完があると、間違いに気づきやすくなります。

```powershell
winget install --id Microsoft.VisualStudioCode -e
```

インストール後にターミナルを開き直し、Python 用の拡張機能を入れます。

```powershell
code --install-extension ms-python.python
```

## 2. プロジェクトを作る

### 2-1. 置き場所を決める

プロジェクトのフォルダは次の場所に作ります。

```text
C:\Users\ユーザー名\dev\image-recognition-handson
```

次の場所は避けます。

| 避ける場所 | 理由 |
|---|---|
| OneDrive で同期しているフォルダ（デスクトップ・ドキュメントが同期対象のことも多い） | ライブラリのファイルが数千個あり、同期が重くなったり、壊れたりします |
| この手順書がある Obsidian の Vault の中 | Vault が大量のファイルを読み込んで重くなります |
| 日本語や空白を含むパス | 一部のライブラリが正しく動かないことがあります。ユーザー名が日本語なら `C:\dev\image-recognition-handson` にします |

### 2-2. フォルダを作り、プロジェクトを初期化する

```powershell
# ユーザーのフォルダに dev フォルダを作り、その中にプロジェクトのフォルダを作る
cd $HOME
mkdir dev
cd dev
mkdir image-recognition-handson
cd image-recognition-handson

# Python 3.12 を使うプロジェクトとして初期化する
uv init --python 3.12
```

`dev` フォルダがすでにある場合、`mkdir dev` はエラーになりますが、そのまま進めて構いません。

`uv init` で、次のファイルができます。

| ファイル | 中身 |
|---|---|
| `pyproject.toml` | プロジェクトの設定。使うライブラリの一覧がここに書かれる |
| `.python-version` | 使う Python の版（`3.12`）。Step 6 の Docker でもこのファイルを使う |
| `main.py` | 練習用のプログラム（第3章で書き換える） |
| `README.md` | プロジェクトの説明を書くファイル |
| `.gitignore` | Git に入れないファイルの一覧（Git が入っている場合だけ作られる） |

`.python-version` の中身が `3.12` になっていることを確認します。

```powershell
Get-Content .python-version
```

### 2-3. ライブラリを入れる

```powershell
uv add opencv-python ultralytics lap
```

入れるライブラリは次のとおりです。

| ライブラリ | 役割 | 使う Step |
|---|---|---|
| `opencv-python` | 画像・動画の読み書き、図形や文字の描画 | 1〜6 |
| `ultralytics` | YOLO（物体検出の AI モデル）を簡単に使うためのライブラリ | 1〜7 |
| `lap` | 追跡（ByteTrack）の計算に使う | 2〜 |

`ultralytics` と一緒に、AI の計算を行う **PyTorch** などが自動で入ります。PyTorch は数百MBあるので、数分かかります。Windows に入る PyTorch は CPU 版です（GPU は Step 7 でクラウドの GPU を使います）。

このコマンドで、次のものが増えます。

| できるもの | 中身 | 扱い |
|---|---|---|
| `.venv` フォルダ | このプロジェクト専用の Python とライブラリ | 中身は触らない。Git に入れない |
| `uv.lock` | 入ったライブラリの正確な版の一覧 | 消さない。Step 6 の Docker で同じ版を再現するのに使う |
| `pyproject.toml` の `dependencies` | 入れたライブラリの名前 | `uv add` で自動的に書き換わる |

Python 3.12 が PC に無い場合は、このときに uv が自動でダウンロードします。

### 2-4. Ultralytics の利用状況の送信を止める

Ultralytics は、初期設定で匿名の利用状況を送信します。業務の PC では止めておきます。

```powershell
uv run yolo settings sync=False
```

設定は `C:\Users\ユーザー名\AppData\Roaming\Ultralytics\settings.json` に保存されます。

### 2-5. Git に入れないファイルを追加する

人が写った画像や動画を誤って Git に入れないように、`.gitignore` に追記します（ハンズオン計画の 3-1「使う映像のルール」）。VS Code でプロジェクトを開きます。

```powershell
code .
```

左のファイル一覧から `.gitignore` を開き（無ければ新しく作り）、末尾に次を追記して保存します。

```text
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
```

`.venv` は、`uv init` が作った `.gitignore` に最初から書かれています。

### 2-6. VS Code に Python 環境を教える（任意）

VS Code の入力補完を効かせるため、プロジェクトの Python 環境を選びます。

1. `Ctrl + Shift + P` を押し、`Python: Select Interpreter` と入力して選ぶ
2. 一覧から `.venv` を含むもの（`.\.venv\Scripts\python.exe`）を選ぶ

選ばなくても、プログラムの実行には影響しません。

## 3. プログラムを書く

### 3-1. 練習用の画像を用意する

最初は、Ultralytics の公式ドキュメントで使われているサンプル画像（バスと歩行者の写真）を使います。公開されている画像なので、人が写っていても練習に使えます。

```powershell
Invoke-WebRequest -Uri https://ultralytics.com/images/bus.jpg -OutFile sample.jpg
```

プロジェクトのフォルダに `sample.jpg` ができます。ダブルクリックで開き、人が何人写っているか自分の目で数えておきます（第5章で AI の結果と比べます）。

自分で撮った写真を使う場合は、写っている人全員の許可を取ったものだけにします。

### 3-2. 最低限の Python の読み方

プログラムを読むのに必要な決まりは、次の5つだけです。

| 書き方 | 意味 |
|---|---|
| `# ここは説明` | `#` から行末までは説明（コメント）。実行されない |
| `CONF = 0.25` | `CONF` という名前に `0.25` を入れる（変数）。あとで `CONF` と書くと `0.25` として使われる |
| `for box in result.boxes:` | 検出したものを1つずつ取り出して、下の字下げした部分を繰り返す |
| 行頭の字下げ（空白4つ） | どこまでが `for` や `if` の中身かを表す。**ずれるとエラーになる** |
| `print(...)` | 画面に表示する |

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

プロジェクトのフォルダ（`image-recognition-handson`）で、次のコマンドを実行します。VS Code の中でターミナルを開く場合は、`Ctrl + @` を押します。

```powershell
uv run python main.py
```

`uv run` を付けると、このプロジェクト専用の Python（`.venv`）で実行されます。「仮想環境を有効にする（activate）」操作は不要です。

### 初回の実行で起きること

1. AI モデル `yolo11n.pt`（約5MB）がプロジェクトのフォルダにダウンロードされる
2. 枠のラベルを描くためのフォントが、`AppData\Roaming\Ultralytics` にダウンロードされることがある
3. 検出が行われ、結果が表示される

2回目からはダウンロードしません。ダウンロードされた `yolo11n.pt` は、Step 6 で Docker イメージに含めるので**消さずに残しておきます**。

### 表示の例

画面には、だいたい次のような内容が表示されます（数値や人数は一例です）。

```text
image 1/1 C:\Users\...\image-recognition-handson\sample.jpg: 640x480 4 persons, 1 bus, 52.3ms
Speed: 3.1ms preprocess, 52.3ms inference, 1.2ms postprocess per image at shape (1, 3, 640, 480)
{'class': 'bus', 'confidence': 0.94, 'bbox': [17, 230, 801, 768]}
{'class': 'person', 'confidence': 0.89, 'bbox': [48, 399, 245, 903]}
...
人物の数: 4
result.jpg に保存しました
```

最初の2行は Ultralytics が自動で表示するもの、`{...}` 以降は `main.py` が表示しているものです。

`result.jpg` を開き、人物に `person` と数字（信頼度）の付いた枠が描かれていることを確認します。

## 5. 結果を読み解く

### 5-1. 検出結果の3つの要素

| 要素 | プログラムでの名前 | 意味 |
|---|---|---|
| クラス | `class` | 何が見つかったか。`person`、`bus`、`car` など |
| 信頼度 | `confidence` | AI がどれくらい自信を持っているか。0〜1 で、1 に近いほど自信がある |
| 位置 | `bbox` | 枠の位置。`[左上の x, 左上の y, 右下の x, 右下の y]` |

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

たとえば `[48, 399, 245, 903]` なら、左上が `(48, 399)`、右下が `(245, 903)` の枠です。人物の枠では、**y2（枠の下端）がおおよそ足元の位置**になります。Step 3 で「線を越えた人数」を数えるときに、この性質を使います。

### 5-3. 学習済みモデルとクラス番号

`yolo11n.pt` は、COCO という公開データセットで学習済みのモデルです。80種類のものを見分けられ、それぞれに番号が付いています。人物（`person`）は **0 番**です。

| 番号 | 名前 | 番号 | 名前 |
|---|---|---|---|
| 0 | person（人） | 2 | car（車） |
| 1 | bicycle（自転車） | 5 | bus（バス） |

全部の一覧は、次のコマンドで表示できます。

```powershell
uv run python -c "from ultralytics import YOLO; print(YOLO('yolo11n.pt').names)"
```

人や一般的な物体を見つけるだけなら、自分でモデルを学習させる必要はありません。

### 5-4. モデルの大きさ

モデル名の最後の文字は大きさを表します。大きいほど精度が上がり、遅くなります。

| モデル | 大きさ | 特徴 |
|---|---|---|
| `yolo11n.pt` | 最小（nano） | 速い。このハンズオンの基本 |
| `yolo11s.pt` | 小（small） | n より少し精度が高く、少し遅い |
| `yolo11m.pt` | 中（medium） | CPU では動画のリアルタイム処理が難しくなる |
| `yolo11l.pt`・`yolo11x.pt` | 大・特大 | GPU 向け（Step 7 で試す価値がある） |

Ultralytics からは新しい世代のモデルも出ます。名前は変わりますが、使い方は同じです。

## 6. 練習問題

`main.py` の先頭の値を書き換えて、何度も実行してみます。結果は表にメモしておきます。

### 6-1. しきい値を変える

`CONF` を `0.1`、`0.25`、`0.5`、`0.7` に変えて、人物の数がどう変わるかを記録します。

| CONF | 人物の数 | 気づいたこと |
|---|---|---|
| 0.1 | | |
| 0.25 | | |
| 0.5 | | |
| 0.7 | | |

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
- 1行目の `Speed:` の `inference`（推論にかかった時間）はどれくらい増えたか

試し終わったら `"yolo11n.pt"` に戻します。Step 2 以降は `yolo11n.pt` を前提にしています。

### 6-4. 条件の違う画像を試す

`IMAGE_PATH` を別の画像に変えて試します。Step 3 の「精度を確かめる」の予習になります。

- 人が重なっている
- 人が遠くに小さく写っている
- 暗い
- 後ろ向き

画像は、公開データセットの画像か、写っている人の許可を取った写真だけを使います。

## 7. うまくいかないとき

| 症状 | 原因と対処 |
|---|---|
| `uv : 用語 'uv' は、コマンドレット…として認識されません` | インストール直後でターミナルが古い設定のまま。ターミナルを閉じて開き直す |
| `winget` が見つからない | 1-2 の公式インストーラーのコマンドを使う |
| `uv add` や モデルのダウンロードが `SSL` や `certificate` のエラーで止まる | 会社のネットワークが通信を検査している可能性がある。`$env:UV_NATIVE_TLS = "true"` を実行してから `uv add` をやり直す。モデルは、ブラウザで `https://github.com/ultralytics/assets/releases/download/v8.3.0/yolo11n.pt` を開いてダウンロードし、プロジェクトのフォルダに置く |
| `uv add` がタイムアウトする | プロキシ環境の可能性がある。`$env:HTTPS_PROXY = "http://プロキシのアドレス:ポート"` を設定してからやり直す（アドレスは情報システム担当に確認） |
| フォントのダウンロードでエラーになる | Windows のフォントをコピーして代わりに使う：`Copy-Item C:\Windows\Fonts\arial.ttf "$env:APPDATA\Ultralytics\Arial.ttf"` |
| `FileNotFoundError` や `sample.jpg does not exist` | 実行しているフォルダが違う。`cd $HOME\dev\image-recognition-handson` でプロジェクトのフォルダに移動してから実行する |
| `IndentationError` | 字下げがずれている。3-3 のコードをもう一度まるごと貼り付ける |
| `ModuleNotFoundError: No module named 'ultralytics'` | `uv run` を付けずに `python main.py` と実行している。`uv run python main.py` で実行する |
| `.venv\Scripts\activate` が「スクリプトの実行が無効」と言われる | activate は使わない。`uv run` で実行すれば不要 |
| `result.jpg` に枠が1つも無い | 画像に人や物体が写っていない、または `CONF` が高すぎる。`CONF = 0.25` に戻す |

## 8. 完了条件

- [ ] `uv --version` で版が表示される
- [ ] `.python-version` の中身が `3.12` になっている
- [ ] `uv.lock` があり、`pyproject.toml` に `opencv-python`・`ultralytics`・`lap` が書かれている
- [ ] `uv run python main.py` で、人物の数と検出結果が表示される
- [ ] `result.jpg` で、人物に `person` の枠が付いている
- [ ] 検出結果の3つの要素（クラス・信頼度・位置）を説明できる
- [ ] `CONF` を変えたときに、見落としと誤検出がどう入れ替わるかを説明できる
- [ ] `yolo11n.pt` がプロジェクトのフォルダに残っている

## 9. このあとの Step とのつながり

Step 1 が終わった時点のフォルダは次のようになっています。

```text
image-recognition-handson\
├── .venv\            ← このプロジェクト専用の Python とライブラリ（触らない）
├── .gitignore        ← 画像・動画・モデルを Git に入れない設定
├── .python-version   ← 3.12
├── pyproject.toml    ← 使うライブラリの一覧
├── uv.lock           ← ライブラリの正確な版
├── README.md
├── main.py           ← Step 1 のプログラム
├── yolo11n.pt        ← AI モデル
├── sample.jpg
└── result.jpg
```

このあとの Step で、次のように使います。

| Step 1 で用意したもの | 使う Step | 使い方 |
|---|---|---|
| Windows で直接動かす環境 | Step 2 | Web カメラの映像で人物を追跡する |
| `lap` | Step 2 | 追跡（ByteTrack）に使う |
| `classes=[0]`（6-2） | Step 2・3 | 人物だけを検出・追跡する |
| 枠の y2 ≒ 足元（5-2） | Step 3 | 線を越えた人数を数える |
| `CONF` の練習（6-1） | Step 3 | 精度の評価で、しきい値ごとの見落としと誤検出を比べる |
| `uv add` の手順 | Step 4・5 | Google Cloud 用のライブラリを同じ方法で追加する |
| `.python-version`・`pyproject.toml`・`uv.lock` | Step 6 | Docker の中に同じ Python とライブラリを再現する |
| `yolo11n.pt`（一番上のフォルダ） | Step 6 | Docker イメージに含め、クラウドで毎回ダウンロードしないようにする |
| `.gitignore` | Step 6 | `.gcloudignore` を作るときの参考にする |
| Git | Step 7 | CPU 版と GPU 版の設定をブランチで分ける |

次は Step 2「ローカル PC で動画から人物を検出・追跡する」に進みます。
