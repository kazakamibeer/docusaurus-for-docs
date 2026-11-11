---
sidebar_position: 3
title: 【画像認識ハンズオン】Step 2
---

# Step 2 詳細手順：ローカル PC（WSL）で動画から人物を検出・追跡する

[[image-video-recognition-google-cloud-handson]] の Step 2 を、普段 Python を使わない人でも進められるように詳しく書いた手順書です。[[image-video-recognition-step1-local-image-detection]]（Step 1）が終わっていることが前提です。

## 0. この手順書について

### このステップで作るもの

動画を読み込み、映っている人物を1フレームずつ検出し、同じ人物に同じ番号（追跡 ID）を付け続ける Python プログラム `video.py` です。結果は3つのファイルに保存します。

```text
sample.mp4（入力）  →  video.py（YOLO で検出 + ByteTrack で追跡）  →  out/output.mp4        枠・追跡 ID・人数・FPS を描いた動画
                                                                     →  out/detections.jsonl  フレームごと・人物ごとの検出結果
                                                                     →  out/summary.json      人物ごとのまとめ
```

### かかる時間

| 作業                               | 目安     |
| ---------------------------------- | -------- |
| 動画の基本を知る（第1章）          | 20分     |
| 準備とプログラムの作成（第2〜3章） | 30分     |
| 実行と結果の読み方（第4〜5章）     | 1時間    |
| 練習問題（第6章）                  | 1〜2時間 |

### 前提

- Step 1 が終わっていて、`~/dev/image-recognition-handson` で `uv run python main.py` が動くこと
- コマンドは、Step 1 と同じく **Ubuntu のターミナル**（行頭が `ユーザー名@PC名:`）で実行すること

### このステップの作り方と、その理由

`video.py` は、Step 6 でクラウドの VM（Docker の中）でもそのまま使います。そのため、最初から次のように作ります。

| 作り方                                                                                       | 理由（どの Step につながるか）                                                           |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 画面への表示は `--show` を付けたときだけにする                                               | VM や Docker には画面がありません（Step 6）                                              |
| 枠を描いた動画は、常にファイルに書き出す                                                     | 画面が無くても結果を確認できるようにするためです                                         |
| フレームごとの結果（`detections.jsonl`）と人物ごとのまとめ（`summary.json`）を分けて保存する | Step 4 で、細かいデータは Cloud Storage、まとめだけを Firestore に入れます               |
| `summary.json` の形を、Step 4 の API が受け取る形に合わせておく                              | Step 4 で、このファイルをそのまま API に送ります                                         |
| クラウドへの送信処理は入れない                                                               | 認識処理とクラウド連携を分けておくと、ローカルでもクラウドでも同じ `video.py` を使えます |
| 処理を `run()` という関数にまとめる                                                          | Step 6 の `run_job.py` が `from video import run` で呼び出します                         |
| 人物だけ（`classes=[0]`）を検出する                                                          | Step 1 の練習 6-2 と同じです。Step 3 の人数カウントもこれを前提にします                  |

### Web カメラについて

ハンズオン計画の初版では Web カメラでの実行も予定していましたが、WSL からは Web カメラを直接使えません。代わりに、**Windows のカメラアプリで録画した動画ファイル**を使います（4-4）。

## 1. 動画を扱う前に知っておくこと

### 1-1. 動画は画像の連続

動画は、少しずつ違う画像（**フレーム**）をパラパラ漫画のように並べたものです。

| 用語                     | 意味                                   | 例                                 |
| ------------------------ | -------------------------------------- | ---------------------------------- |
| フレーム                 | 動画を構成する1枚1枚の画像             |                                    |
| FPS（Frames Per Second） | 1秒あたりのフレーム数                  | 30 FPS なら1秒に30枚。1分で1,800枚 |
| 解像度                   | 1フレームの大きさ（横×縦のピクセル数） | 1280×720、1920×1080                |
| フレーム番号             | 先頭から数えて何枚目か（0 から数える） | 30 FPS の動画の 90 番は、3秒目     |

`video.py` は、動画から1フレームずつ取り出して、Step 1 と同じように YOLO で検出します。

### 1-2. 検出と追跡の違い

|                      | 検出（Detection）              | 追跡（Tracking）                                                |
| -------------------- | ------------------------------ | --------------------------------------------------------------- |
| 分かること           | そのフレームのどこに人がいるか | 前のフレームのどの人と同じ人か                                  |
| フレーム間のつながり | なし（毎回ばらばら）           | あり（同じ人に同じ ID）                                         |
| できること           | 「今、何人いるか」             | 「何人が通ったか」「1人が何秒いたか」「どこからどこへ動いたか」 |

検出だけだと、10秒間ずっと同じ人が映っていても「300フレームで1人ずつ見つけた」としか分かりません。追跡を加えると、「ID 3 の人が 0 秒から 10 秒までいた」と分かります。

### 1-3. ByteTrack のしくみ（ざっくり）

このハンズオンでは、Ultralytics に入っている **ByteTrack** という追跡方法を使います。

1. 前のフレームまでの動きから、各人物が「次はこのあたりに来るはず」と予測する
2. 今のフレームの検出結果のうち、予測した位置と枠がよく重なるものを「同じ人」とみなし、同じ ID を付ける
3. 信頼度の低い検出も、予測と重なれば同じ人として使う（人が一瞬隠れたときに ID が途切れにくい）
4. どの予測とも重ならない検出には、新しい ID を付ける

そのため、次のような場面では ID がずれることがあります。Step 3 でこれを確かめます。

- 2人がすれ違って重なる → ID が入れ替わる（ID の取り違え）
- 人が物陰に長く隠れる → 出てきたときに新しい ID になる

## 2. 準備する

### 2-1. プロジェクトのフォルダに移動する

```bash
cd ~/dev/image-recognition-handson
```

`lap`（ByteTrack が使う部品）が入っていることを確認します。Step 1 で入れています。

```bash
grep lap pyproject.toml
```

`"lap>=0.5.14",` のような行が表示されれば準備完了です。表示されない場合は `uv add lap` を実行します。

### 2-2. 画面表示に使う部品を入れる

`--show`（処理中の映像を画面に表示する）を使うには、Ubuntu の部品が2つ必要です。Ubuntu 24.04 の WSL には最初から入っていないことがあります。

```bash
sudo apt install -y libsm6 libice6
```

入っていないと、`--show` を付けたときに `Could not load the Qt platform plugin "xcb"` というエラーになります。`--show` を使わない場合は不要です。

### 2-3. 練習用の動画を用意する

最初は、Ultralytics が人数カウントのデモに使っている公開のサンプル動画を使います。人が歩いている短い動画です。

```bash
curl -L -o sample.mp4 https://github.com/ultralytics/assets/releases/download/v0.0.0/People-counting-compressed.mp4
```

### 2-4. 動画の情報を調べる

処理する前に、動画の FPS・フレーム数・解像度を確認します。`video_info.py` を作ります。

```bash
cat > video_info.py <<'EOF'
"""動画の FPS・フレーム数・解像度を表示する。"""
import sys

import cv2

path = sys.argv[1] if len(sys.argv) > 1 else "sample.mp4"
cap = cv2.VideoCapture(path)
if not cap.isOpened():
    raise SystemExit(f"動画を開けません: {path}")

fps = cap.get(cv2.CAP_PROP_FPS)
frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
print(f"FPS: {fps:.2f}")
print(f"フレーム数: {frames}")
print(f"解像度: {width} x {height}")
print(f"長さ: {frames / fps:.1f} 秒")
EOF

uv run python video_info.py sample.mp4
```

サンプル動画では、次のように表示されます。

```text
FPS: 50.00
フレーム数: 250
解像度: 1280 x 720
長さ: 5.0 秒
```

1秒に50枚、全部で250枚の画像が並んだ、5秒の動画です。`video.py` は、この250枚それぞれに検出と追跡を行います。表示された値をメモしておきます（5-5 で、処理の速さと比べます）。

## 3. プログラムを書く

### 3-1. video.py を作る

VS Code で新しいファイル `video.py` を作り（`code video.py` でも開けます）、次の内容を貼り付けて保存します。ハンズオン計画の Step 2 のコードと同じものです。Step 3〜6 もこのコードを前提にしているので、**このステップでは書き換えずに使います**。

```python
"""動画から人物を検出・追跡し、結果をファイルに保存する。"""
import argparse
import json
import re
import time
from pathlib import Path

import cv2
from ultralytics import YOLO

PERSON_CLASS_ID = 0  # COCO の「person」


def make_video_id(source: str) -> str:
    """ファイル名から、英数字・_・- だけの ID を作る。"""
    stem = f"camera{source}" if source.isdigit() else Path(source).stem
    return re.sub(r"[^A-Za-z0-9_-]", "_", stem)[:64] or "video"


def run(source: str, out_dir: Path, *, model_path: str = "yolo11n.pt", conf: float = 0.4,
        show: bool = False, detect_only: bool = False) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    model = YOLO(model_path)
    cap = cv2.VideoCapture(int(source) if source.isdigit() else source)
    if not cap.isOpened():
        raise SystemExit(f"映像を開けません: {source}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    size = (int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)))
    writer = cv2.VideoWriter(str(out_dir / "output.mp4"), cv2.VideoWriter_fourcc(*"mp4v"), fps, size)

    tracks: dict[int, dict] = {}  # 追跡 ID ごとのまとめ
    frame_number = 0
    with open(out_dir / "detections.jsonl", "w", encoding="utf-8") as log:
        while True:
            ok, frame = cap.read()
            if not ok:
                break

            start = time.perf_counter()
            if detect_only:
                result = model(frame, classes=[PERSON_CLASS_ID], conf=conf, verbose=False)[0]
            else:
                result = model.track(frame, persist=True, tracker="bytetrack.yaml",
                                     classes=[PERSON_CLASS_ID], conf=conf, verbose=False)[0]
            proc_fps = 1 / (time.perf_counter() - start)

            boxes = result.boxes
            ids = boxes.id.int().tolist() if boxes.id is not None else [None] * len(boxes)
            for track_id, xyxy, score in zip(ids, boxes.xyxy.tolist(), boxes.conf.tolist()):
                # フレームごとの検出結果（細かいデータはファイルに残す）
                log.write(json.dumps({
                    "frame": frame_number,
                    "tracking_id": track_id,
                    "confidence": round(score, 3),
                    "bbox": [round(v) for v in xyxy],
                }) + "\n")
                if track_id is not None:
                    t = tracks.setdefault(track_id, {"first": frame_number, "last": frame_number, "max_conf": 0.0})
                    t["last"] = frame_number
                    t["max_conf"] = max(t["max_conf"], score)

            annotated = result.plot()
            cv2.putText(annotated, f"persons: {len(boxes)}  FPS: {proc_fps:.1f}", (10, 30),
                        cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
            writer.write(annotated)

            if show:
                cv2.imshow("Detection", annotated)
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break
            frame_number += 1

    cap.release()
    writer.release()
    if show:
        cv2.destroyAllWindows()

    # 人物ごとのまとめ（Step 4 で Firestore に保存するのはこれだけ）
    summary = {
        "video_id": make_video_id(source),
        "fps": round(fps, 2),
        "frame_count": frame_number,
        "person_tracks": [
            {
                "tracking_id": tid,
                "first_seen_sec": round(t["first"] / fps, 2),
                "last_seen_sec": round(t["last"] / fps, 2),
                "duration_sec": round((t["last"] - t["first"] + 1) / fps, 2),
                "max_confidence": round(t["max_conf"], 3),
            }
            for tid, t in sorted(tracks.items())
        ],
    }
    summary_path = out_dir / "summary.json"
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    return summary_path


def main() -> None:
    parser = argparse.ArgumentParser(description="動画から人物を検出・追跡する")
    parser.add_argument("--source", default="sample.mp4", help="動画ファイルのパス、またはカメラ番号（0 など）")
    parser.add_argument("--out-dir", default="out", help="結果の保存先フォルダ")
    parser.add_argument("--conf", type=float, default=0.4, help="信頼度のしきい値")
    parser.add_argument("--show", action="store_true", help="画面に表示する（VM・Docker では付けない）")
    parser.add_argument("--detect-only", action="store_true", help="追跡せず検出だけ行う（比較用）")
    args = parser.parse_args()

    path = run(args.source, Path(args.out_dir), conf=args.conf, show=args.show, detect_only=args.detect_only)
    print(f"保存しました: {path}")


if __name__ == "__main__":
    main()
```

### 3-2. プログラムの読み方

長いプログラムですが、部品ごとに分けると次のようになっています。

| 部分               | 行の目印                             | していること                                                                                                          |
| ------------------ | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| 準備               | `import ...`、`PERSON_CLASS_ID = 0`  | 使う部品を読み込み、人物のクラス番号（0）を決める                                                                     |
| `make_video_id()`  | `def make_video_id`                  | ファイル名から、Step 4 の API が受け付ける文字（英数字・`_`・`-`）だけの ID を作る。`sample.mp4` なら `sample`        |
| `run()` の前半     | `cap = cv2.VideoCapture(...)`        | 動画を開き、FPS と解像度を調べ、書き出し用の動画（`output.mp4`）を用意する                                            |
| フレームの繰り返し | `while True:`                        | 動画が終わるまで、1フレームずつ次の4つを繰り返す                                                                      |
| ① 検出・追跡       | `model.track(...)`                   | 人物だけを検出し、ByteTrack で ID を付ける。`--detect-only` のときは `model(...)` で検出だけ                          |
| ② 記録             | `log.write(...)`                     | 見つけた人物を1人1行で `detections.jsonl` に書き、ID ごとに「最初と最後に見えたフレーム」「最大の信頼度」を覚えておく |
| ③ 描画・保存       | `result.plot()`、`writer.write(...)` | 枠と ID を描き、左上に人数と FPS を書いて、`output.mp4` に1フレーム追加する                                           |
| ④ 表示             | `if show:`                           | `--show` のときだけ画面に出す。`q` キーで途中終了                                                                     |
| まとめ             | `summary = {...}`                    | 覚えておいた ID ごとの情報を、秒に直して `summary.json` に書く                                                        |
| `main()`           | `argparse`                           | コマンドの `--source` などのオプションを受け取り、`run()` を呼ぶ                                                      |

#### 主な Python の書き方（Step 1 で出てこなかったもの）

| 書き方                     | 意味                                                                |
| -------------------------- | ------------------------------------------------------------------- |
| `def 名前(...):`           | 関数（処理のまとまり）を作る。あとで `名前(...)` と書くと呼び出せる |
| `while True:` ／ `break`   | ずっと繰り返す ／ 繰り返しを抜ける                                  |
| `if 条件:`                 | 条件が正しいときだけ、下の字下げした部分を実行する                  |
| `{"frame": 12, ...}`       | 名前と値の組（辞書）。JSON とほぼ同じ形                             |
| `f"persons: {len(boxes)}"` | 文字列の中に `{ }` で値を埋め込む                                   |
| `return 値`                | 関数の結果を返す                                                    |

#### 主なオプション

| オプション      | 初期値       | 意味                                       |
| --------------- | ------------ | ------------------------------------------ |
| `--source`      | `sample.mp4` | 読み込む動画ファイル                       |
| `--out-dir`     | `out`        | 結果を保存するフォルダ                     |
| `--conf`        | `0.4`        | 信頼度のしきい値。Step 1 の `CONF` と同じ  |
| `--show`        | なし         | 付けると、処理中の映像を画面に表示する     |
| `--detect-only` | なし         | 付けると、追跡せず検出だけにする（比較用） |

`--conf` の初期値を Step 1 の 0.25 より高い 0.4 にしているのは、動画では低い信頼度の誤検出がフレームごとに現れ、短い ID が大量にできてしまうためです。

## 4. 実行する

### 4-1. まずは画面表示なしで実行する

```bash
uv run python video.py --source sample.mp4
```

画面表示なしでも、結果は `out/` フォルダに保存されます。処理が終わると、次のように表示されます。

```text
保存しました: out/summary.json
```

2026年11月に試したときは、5秒のサンプル動画（250フレーム）の処理に約40秒かかりました。動画の長さの約8倍の時間がかかる計算です。時間は PC の性能によって変わります。処理中は何も表示されませんが、止まっているわけではありません。

### 4-2. 結果の動画を見る

```bash
explorer.exe out
```

Windows のエクスプローラーで `out` フォルダが開きます。`output.mp4` をダブルクリックして再生し、次の点を確認します。

- 人物に枠が付き、枠の上に `id:3 person 0.85` のように ID・クラス・信頼度が表示されている
- 同じ人には、動画の最初から最後まで同じ ID が付いている
- 左上に `persons: 人数  FPS: 数値` が表示されている

### 4-3. 画面に表示しながら実行する

```bash
uv run python video.py --source sample.mp4 --show
```

Windows 11 の **WSLg** という仕組みにより、WSL のプログラムのウィンドウが Windows の画面に表示されます。

- ウィンドウを選んだ状態で `q` キーを押すと、途中で終了します（途中までの結果は保存されます）
- 表示しながらだと、表示しないときより少し遅くなります

ウィンドウが出ずにエラーになる場合は、第7章を見てください。`--show` なしでも結果の確認はできるので、先に進んで構いません。

### 4-4. カメラアプリで録画した動画で試す

1. Windows の「カメラ」アプリを開き、ビデオモードに切り替えて10〜20秒ほど録画する
   - 写る人全員の許可を取ります（ハンズオン計画の 3-1）。1人で、カメラの前を左右に歩くだけでも構いません
2. 録画したファイルを WSL のプロジェクトにコピーする

録画したファイルは、通常 `ピクチャ\カメラ ロール` フォルダに `WIN_日付_時刻_Pro.mp4` のような名前で保存されます。

```bash
# 録画ファイルの一覧を見る（ユーザー名は自分のものに変える）
ls "/mnt/c/Users/ユーザー名/Pictures/Camera Roll/"

# コピーする（ファイル名は一覧に出たものに変える）
cp "/mnt/c/Users/ユーザー名/Pictures/Camera Roll/WIN_20261111_10_00_00_Pro.mp4" camera.mp4

uv run python video_info.py camera.mp4
uv run python video.py --source camera.mp4 --out-dir out_camera
```

- ピクチャフォルダを OneDrive に保存する設定の場合は、`/mnt/c/Users/ユーザー名/OneDrive/Pictures/Camera Roll/` などにあります。エクスプローラーでカメラ ロールを開き、アドレス欄で場所を確かめます
- 結果は `out_camera/` に保存されます（`--out-dir` を変えないと、前の `out/` が上書きされます）
- 録画した動画は人が写っているので、使い終わったら削除します。`.gitignore` により Git には入りません

## 5. 結果を読み解く

### 5-1. 3つのファイル

```bash
ls -la out
```

| ファイル           | 中身                                       | 使う Step                                     |
| ------------------ | ------------------------------------------ | --------------------------------------------- |
| `output.mp4`       | 枠・追跡 ID・人数・FPS を描いた動画        | 目で確認する。Step 4 で Cloud Storage に保存  |
| `detections.jsonl` | フレームごと・人物ごとの検出結果（1行1件） | Step 3 の集計、Step 4 で Cloud Storage に保存 |
| `summary.json`     | 人物（追跡 ID）ごとのまとめ                | Step 4 で API に送り、Firestore に保存        |

### 5-2. detections.jsonl を読む

```bash
head -5 out/detections.jsonl
wc -l out/detections.jsonl
```

`head -5` は先頭の5行を、`wc -l` は行数（＝検出した件数）を表示します。サンプル動画では、次のようになりました（以下、結果の例は2026年11月に試したものです。ライブラリの版によって少し変わります）。

```text
{"frame": 0, "tracking_id": 1, "confidence": 0.709, "bbox": [579, 144, 685, 435]}
{"frame": 0, "tracking_id": 2, "confidence": 0.545, "bbox": [747, 36, 915, 321]}
{"frame": 1, "tracking_id": 1, "confidence": 0.667, "bbox": [575, 138, 691, 459]}
...
321 out/detections.jsonl
```

1行目と2行目は、0番目のフレームに2人（ID 1 と ID 2）がいたという意味です。3行目は、次のフレームでも ID 1 の人が少し動いた位置にいたことを表しています。

| 項目          | 意味                                                                 |
| ------------- | -------------------------------------------------------------------- |
| `frame`       | フレーム番号（0 から）。秒に直すには FPS で割る                      |
| `tracking_id` | 追跡 ID。`--detect-only` のときは `null`（ID なし）                  |
| `confidence`  | 信頼度                                                               |
| `bbox`        | 枠の位置 `[左上の x, 左上の y, 右下の x, 右下の y]`（Step 1 と同じ） |

JSON Lines（`.jsonl`）は、1行に1つの JSON を書く形式です。行を足していくだけで書けるので、長い動画の記録に向いています。

### 5-3. summary.json を読む

```bash
cat out/summary.json
```

```json
{
  "video_id": "sample",
  "fps": 50.0,
  "frame_count": 250,
  "person_tracks": [
    { "tracking_id": 1, "first_seen_sec": 0.0,  "last_seen_sec": 0.76, "duration_sec": 0.78, "max_confidence": 0.849 },
    { "tracking_id": 2, "first_seen_sec": 0.0,  "last_seen_sec": 2.38, "duration_sec": 2.4,  "max_confidence": 0.795 },
    { "tracking_id": 4, "first_seen_sec": 0.82, "last_seen_sec": 4.66, "duration_sec": 3.86, "max_confidence": 0.876 },
    { "tracking_id": 6, "first_seen_sec": 3.42, "last_seen_sec": 4.98, "duration_sec": 1.58, "max_confidence": 0.898 }
  ]
}
```

（実際のファイルは1項目ずつ改行されています。ここでは読みやすいように詰めています。）

| 項目                              | 意味                                   |
| --------------------------------- | -------------------------------------- |
| `video_id`                        | 動画の ID（ファイル名から作る）        |
| `fps`・`frame_count`              | 元の動画の FPS と、処理したフレーム数  |
| `person_tracks`                   | 追跡 ID ごとのまとめの一覧             |
| `first_seen_sec`・`last_seen_sec` | その ID が最初と最後に見えた時刻（秒） |
| `duration_sec`                    | 見えていた長さ（秒）                   |
| `max_confidence`                  | その ID の検出で一番高かった信頼度     |

この例からは、次のことが読み取れます。

- 5秒の間に、4つの ID（4人分）が記録された
- ID 1 は最初の 0.78 秒だけ映り、画面の外に出た。入れ替わるように、0.82 秒から ID 4 の人が入ってきた
- ID が 1, 2, 4, 6 と飛んでいる：ByteTrack は、新しい人の候補に番号を付けてから、数フレーム続けて見えたものだけを本当の人物として残します。1フレームだけの誤検出などに使われた番号（3 と 5）は、結果に残りません
- ID 2 は 0〜2.38 秒の間ずっと同じ ID ですが、`detections.jsonl` で数えると、この間の120フレームのうち検出されたのは88フレームでした。検出が途切れたフレームがあっても、ByteTrack が予測でつないで同じ ID を保っています

**`person_tracks` の数は、映っていた人数と同じとは限りません。** 1人の ID が途中で途切れて新しい ID になると、1人が2つ以上に数えられます。`duration_sec` がとても短い ID（0.1 秒など）は、誤検出や ID の途切れであることが多いです。

### 5-4. 行数とまとめの数を比べる

`detections.jsonl` の行数と、`summary.json` の `person_tracks` の数を比べます。サンプル動画では、次のとおりでした。

| ファイル                                      | 件数  |
| --------------------------------------------- | ----- |
| `detections.jsonl`（フレームごと）            | 321件 |
| `summary.json` の `person_tracks`（人物ごと） | 4件   |

5秒の動画に、多くても2人しか同時に映っていなくても、フレームごとに記録すると321件になります。30 FPS で3人が映る1分の動画なら、約5,400件です。

フレームごとに記録すると件数がすぐに数千件になります。Step 4 で Firestore（書き込み件数で課金される）にはまとめだけを入れ、フレームごとのデータは Cloud Storage にファイルとして置くのは、このためです。

### 5-5. FPS を読む

`output.mp4` の左上の `FPS` は、**1フレームの検出・追跡にかかった時間から計算した処理速度**です。元の動画の FPS（2-4 で調べた値）と比べます。

| 比べた結果                 | 意味                                                                   |
| -------------------------- | ---------------------------------------------------------------------- |
| 処理 FPS ≧ 元の動画の FPS  | リアルタイム（カメラの映像を遅れずに処理）に間に合う                   |
| 処理 FPS ＜ 元の動画の FPS | リアルタイムには間に合わない。録画した動画を後から処理するなら問題ない |

2026年11月に試したときは、処理 FPS はおよそ6〜7でした。サンプル動画は 50 FPS なので、リアルタイムには間に合っていません。CPU だけで動かすと、このくらいが普通です。

この値は Step 7 で、クラウドの CPU・GPU と比べます。

## 6. 練習問題

結果はメモしておきます。Step 3 の「精度を確かめる」と Step 7 の比較で使います。

### 6-1. 検出だけと追跡ありを比べる

```bash
uv run python video.py --source sample.mp4 --detect-only --out-dir out_detect
```

`out/output.mp4`（追跡あり）と `out_detect/output.mp4`（検出だけ）を並べて再生し、違いを確かめます。

- 検出だけでは、枠に ID が付かない
- `out_detect/summary.json` の `person_tracks` は空になる（ID が無いので、人物ごとにまとめられない）
- 処理 FPS はどちらが速いか（追跡の計算はとても軽いので、ほとんど変わらない）

### 6-2. しきい値を変えて、ID の数を比べる

```bash
uv run python video.py --source sample.mp4 --conf 0.25 --out-dir out_conf025
uv run python video.py --source sample.mp4 --conf 0.6 --out-dir out_conf060
```

| conf | person_tracks の数 | duration_sec が 1 秒未満の ID の数 | 気づいたこと |
| ---- | ------------------ | ---------------------------------- | ------------ |
| 0.25 |                    |                                    |              |
| 0.4  |                    |                                    |              |
| 0.6  |                    |                                    |              |

ID の数は、次のコマンドで数えられます。

```bash
uv run python -c "import json; s=json.load(open('out_conf025/summary.json')); t=s['person_tracks']; print(len(t), sum(1 for x in t if x['duration_sec'] < 1))"
```

動画を見て数えた実際の人数と比べ、どの conf が一番近いかを確かめます。

### 6-3. 処理の速さを記録する

次の表を埋めます。Step 7 で、クラウドの VM（CPU・GPU）の結果を右に足していきます。

| 項目                                          | ローカル PC（WSL） |
| --------------------------------------------- | ------------------ |
| 動画の長さ（秒）                              |                    |
| 元の動画の FPS                                |                    |
| 処理 FPS（`output.mp4` の左上の値のおおよそ） |                    |
| 処理にかかった時間（秒）                      |                    |

処理にかかった時間は、コマンドの前に `time` を付けると測れます。最後に表示される `real` が実際にかかった時間です。

```bash
time uv run python video.py --source sample.mp4
```

### 6-4. 自分の動画で ID の途切れを観察する

4-4 の方法で、次のような動画を録画して試します（写る人の許可を取ります）。

- 2人がカメラの前ですれ違う → ID が入れ替わるか
- 1人が物陰（ドアや柱）に隠れてから出てくる → 同じ ID のままか、新しい ID になるか
- カメラから遠ざかって小さくなる → どこで検出されなくなるか

Step 3 の「精度を確かめる」の予習になります。

## 7. うまくいかないとき

| 症状                                                                         | 原因と対処                                                                                                                                                        |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `映像を開けません: sample.mp4`                                               | ファイル名か、実行しているフォルダが違う。`ls` で `sample.mp4` があるか確かめ、`cd ~/dev/image-recognition-handson` してから実行する                              |
| `映像を開けません` （カメラアプリの動画）                                    | コピーできていないか、動画の形式を読めない。`ls -la camera.mp4` で大きさが 0 でないか確かめる。読めない場合は、カメラアプリの設定でビデオの画質を変えて録画し直す |
| `--source 0` でエラーになる                                                  | WSL からは Web カメラを使えない。カメラアプリで録画した動画を使う（4-4）                                                                                          |
| `ModuleNotFoundError: No module named 'lap'` や `lap` のインストールのエラー | `uv add lap` を実行してからやり直す                                                                                                                               |
| `--show` で `qt.qpa.xcb: could not connect to display`                       | WSLg が動いていない。PowerShell で `wsl --shutdown` を実行し、Ubuntu のターミナルを開き直す。それでもだめなら `--show` なしで実行し、`output.mp4` で確認する      |
| `--show` で `Could not load the Qt platform plugin "xcb"`                    | 画面表示に使う部品が足りない。2-2 の `sudo apt install -y libsm6 libice6` を実行してからやり直す                                                                  |
| `q` を押しても止まらない                                                     | ターミナルではなく、表示されているウィンドウを選んでから `q` を押す。ターミナルで `Ctrl + C` を押しても止まる                                                     |
| `output.mp4` が再生できない                                                  | Windows のメディア プレーヤーで開く。それでも再生できない場合は、処理が途中で止まっていないか（`summary.json` ができているか）を確かめる                          |
| 処理がとても遅い                                                             | CPU だけで動かしているので、ある程度は正常（5-5）。長い動画は、まず10〜20秒のものを使う                                                                           |
| `persons:` の人数が実際より多い・少ない                                      | しきい値の影響。6-2 で `--conf` を変えて確かめる                                                                                                                  |

## 8. 完了条件

- [ ] `out/output.mp4` で、人物に追跡 ID 付きの枠が出ている
- [ ] `detections.jsonl` と `summary.json` の各項目の意味を説明できる
- [ ] 検出と追跡の違いを、`--detect-only` の結果を使って説明できる
- [ ] `person_tracks` の数が実際の人数と違うことがある理由を説明できる
- [ ] 自分の PC での処理 FPS と処理時間を記録した（6-3）
- [ ] カメラアプリで録画した動画でも動いた
- [ ] （任意）`--show` で処理中の映像を画面に表示できた

## 9. このあとの Step とのつながり

Step 2 が終わった時点で、プロジェクトのフォルダには次のファイルが増えています。

```text
~/dev/image-recognition-handson/
├── video.py          ← Step 2 のプログラム（Step 3〜6 で使う）
├── video_info.py     ← 動画の情報を調べる
├── sample.mp4
├── out/              ← 結果（Git には入らない）
│   ├── output.mp4
│   ├── detections.jsonl
│   └── summary.json
└── （Step 1 のファイル）
```

区切りとして、プログラムを Git に記録しておきます。動画と結果は `.gitignore` により記録されません。

```bash
git add video.py video_info.py
git commit -m "Step 2: 動画から人物を検出・追跡する"
```

このあとの Step で、次のように使います。

| Step 2 で作ったもの                  | 使う Step | 使い方                                                        |
| ------------------------------------ | --------- | ------------------------------------------------------------- |
| `video.py`                           | Step 3    | コピーして、線を越えた人数・滞在時間・姿勢の課題を作る        |
| `detections.jsonl`                   | Step 3・4 | Step 3 で精度の確認に使い、Step 4 で Cloud Storage に保存する |
| `summary.json`                       | Step 4    | 認証付きの Cloud Run API に送り、Firestore に保存する         |
| `run()` 関数                         | Step 6    | VM の中で `run_job.py` から呼び出す                           |
| `--show` を付けない実行              | Step 6    | 画面の無い VM・Docker で同じように動かす                      |
| 処理 FPS・処理時間の記録（6-3）      | Step 7    | クラウドの CPU・GPU と比べる                                  |
| ID の途切れ・入れ替わりの観察（6-4） | Step 3    | 精度の評価表につなげる                                        |

次は Step 3「人物の認識を深める」に進みます。
