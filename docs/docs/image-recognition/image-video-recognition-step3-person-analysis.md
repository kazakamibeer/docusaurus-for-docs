---
sidebar_position: 4
title: 【画像認識ハンズオン】Step 3
---

# Step 3 詳細手順：人物の認識を深める（ローカル PC・WSL）

[[image-video-recognition-google-cloud-handson]] の Step 3 を、普段 Python を使わない人でも進められるように詳しく書いた手順書です。[[image-video-recognition-step2-local-video-tracking]]（Step 2）が終わっていることが前提です。

## 0. この手順書について

### このステップでやること

Step 2 で「動画の中の人物を見つけて、ID を付けて追いかける」ところまでできました。Step 3 では、その結果を使って人物ならではの課題を4つ解きます。

| 課題             | 内容                                                                        | 作るプログラム    |
| ---------------- | --------------------------------------------------------------------------- | ----------------- |
| ① 線を越えた人数 | 画面に横線を1本決め、上から下・下から上へ越えた人数を数える                 | `analyze.py`      |
| ② 範囲にいた時間 | 画面に四角い範囲を決め、その中に人物ごとに何秒いたかを測る                  | `analyze.py`      |
| ③ 姿勢           | 関節の位置を推定し、手を挙げている人を見つける                              | `pose.py`         |
| ④ 精度           | どんなときに見落とし・誤検出・ID の取り違えが起きるかを、自分の目で確かめる | `check_frames.py` |

座標を決めるための補助として `frame_grid.py` も作ります。最後に、発展として①②の数え方が正しいかを確かめるテスト（`test_analyze.py`）を書きます。

### かかる時間

| 作業                                         | 目安                                 |
| -------------------------------------------- | ------------------------------------ |
| 考え方を知る（第1章）・座標を決める（第2章） | 30分                                 |
| 線を越えた人数・範囲にいた時間（第3〜4章）   | 1〜2時間                             |
| 姿勢（第5章）                                | 1時間                                |
| 精度を確かめる（第6章）                      | 2〜3時間（動画を用意する時間を含む） |
| 発展：テスト（第7章）                        | 30分                                 |

### 前提

- Step 2 が終わっていて、`~/dev/image-recognition-handson/out/` に `detections.jsonl` と `summary.json` があること
- `sample.mp4`（Step 2 のサンプル動画）と `sample.jpg`（Step 1 のサンプル画像）がプロジェクトのフォルダにあること
- コマンドは、これまでと同じく **Ubuntu のターミナル**（行頭が `ユーザー名@PC名:`）で実行すること

### このステップの作り方と、その理由

| 作り方                                                                        | 理由（どの Step につながるか）                                                                                                                     |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `video.py` は書き換えず、新しいファイルを作る                                 | Step 4〜6 は `video.py` をそのまま使います。課題のための変更を混ぜないためです                                                                     |
| ①②は、動画をもう一度 AI にかけず、Step 2 の `detections.jsonl` を読んで数える | 数えるのは一瞬で終わるので、線や範囲を変えて何度でも試せます。Step 4 で Cloud Storage に置いた `detections.jsonl` も、同じように後から集計できます |
| 数える処理は、モデルを使わない関数に分ける                                    | 座標の並びを与えるだけで正しく数えられるかを確かめられます（第7章のテスト）。ハンズオン計画の第5章「まずは集計のテストから書く」につながります     |
| 人物の位置は「足元」（枠の下端の中央）で判断する                              | Step 1 の 5-2 で確かめたとおり、枠の下端 y2 がおおよそ足元です。頭や枠の中心より、床の上の位置を正しく表します                                     |

## 1. 考え方を知る

### 1-1. 足元の点

人物の枠 `[x1, y1, x2, y2]` から、次の点を「足元」とします。

```text
        (x1, y1)
           ┌──────┐
           │  人  │
           │      │
           └──●───┘ (x2, y2)
              足元 = ((x1 + x2) / 2, y2)
```

線や範囲との位置関係は、すべてこの足元の点で判断します。

### 1-2. 線を越えたかどうか

人物ごとに「前のフレームの足元の y」を覚えておき、今のフレームの足元の y と比べます。

| 前のフレーム           | 今のフレーム       | 判断                       |
| ---------------------- | ------------------ | -------------------------- |
| 線より上（y が小さい） | 線の上か、線より下 | 上から下へ越えた（`down`） |
| 線の上か、線より下     | 線より上           | 下から上へ越えた（`up`）   |
| それ以外               |                    | 越えていない               |

同じ人が線の前後でうろうろしても数えすぎないように、**1人（1つの ID）は向きごとに1回まで**しか数えません。

注意点として、数えるのは「ID の数」です。Step 2 で見たとおり、1人の ID が途中で変わると、同じ人が2回数えられることがあります（第6章で確かめます）。

### 1-3. 範囲にいた時間

足元の点が範囲の中にあったフレームの数を、人物ごとに数えます。秒に直すには FPS で割ります（50 FPS の動画で100フレームなら2秒）。

検出が途切れたフレームは数えられないので、実際より短めになることがあります。Step 2 の 5-3 で見た例では、ID 7 の人は40フレームの間に16フレームしか検出されていませんでした。

## 2. 線と範囲の座標を決める

線や範囲は、ピクセルの座標で指定します。どこに引けばよいかを知るために、動画の1フレームに目盛りを描いた画像を作ります。

### 2-1. frame_grid.py を作る

プロジェクトのフォルダに移動し、VS Code で `frame_grid.py` を作って次の内容を保存します（`code frame_grid.py` で開けます）。

```python
"""動画の1フレームに座標の目盛りを描いて保存する（線や範囲の座標を決めるため）。"""
import argparse

import cv2


def main() -> None:
    parser = argparse.ArgumentParser(description="動画の1フレームを目盛り付きで保存する")
    parser.add_argument("--source", default="sample.mp4", help="動画ファイル")
    parser.add_argument("--frame", type=int, default=0, help="取り出すフレーム番号")
    parser.add_argument("--step", type=int, default=100, help="目盛りの間隔（ピクセル）")
    parser.add_argument("--out", default="frame_grid.jpg", help="保存するファイル名")
    args = parser.parse_args()

    cap = cv2.VideoCapture(args.source)
    cap.set(cv2.CAP_PROP_POS_FRAMES, args.frame)
    ok, image = cap.read()
    cap.release()
    if not ok:
        raise SystemExit(f"フレームを取り出せません: {args.source} の {args.frame} 番")

    height, width = image.shape[:2]
    white = (255, 255, 255)
    for x in range(0, width, args.step):  # 縦の線と x 座標
        cv2.line(image, (x, 0), (x, height), white, 1)
        cv2.putText(image, str(x), (x + 3, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.5, white, 1)
    for y in range(0, height, args.step):  # 横の線と y 座標
        cv2.line(image, (0, y), (width, y), white, 1)
        cv2.putText(image, str(y), (3, y - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.5, white, 1)

    cv2.imwrite(args.out, image)
    print(f"保存しました: {args.out}（{width} x {height}）")


if __name__ == "__main__":
    main()
```

### 2-2. 実行して、目盛りの画像を見る

```bash
cd ~/dev/image-recognition-handson
uv run python frame_grid.py --source sample.mp4
explorer.exe .
```

```text
保存しました: frame_grid.jpg（768 x 576）
```

`frame_grid.jpg` を開くと、100 ピクセルごとに白い目盛りの線と数字が描かれています。サンプル動画は、建物の前の広場を高い位置から撮ったものです。画面の中ほど（y がおよそ 150〜450）を斜めに通る道を、人がいろいろな向きに歩いています。人が歩いている場所を見ながら、次を決めます。

- **線**：人が横切る場所に、横線を1本（y 座標を1つ決める）
- **範囲**：人が立ち止まりそうな場所や、通り道の一部に、四角を1つ（左上の x, y と右下の x, y を決める）

別の時点のフレームを見るには `--frame` を付けます（例：`--frame 120` で120番目、50 FPS なら2.4秒目）。

## 3. 線を越えた人数を数える

### 3-1. analyze.py を作る

`analyze.py` を作り、次の内容を保存します。線を越えた人数（第3章）と、範囲にいた時間（第4章）の両方を数えます。

```python
"""Step 2 の detections.jsonl から、線を越えた人数と、範囲にいた時間を数える。"""
import argparse
import json
from collections import defaultdict
from pathlib import Path

import cv2


def load_rows(path: Path) -> list[dict]:
    """detections.jsonl を読み、1行を1つの辞書にした一覧を返す。"""
    with open(path, encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def foot_point(bbox: list[int]) -> tuple[float, int]:
    """枠の下端の中央（≒ 足元）の座標を返す。"""
    x1, _, x2, y2 = bbox
    return (x1 + x2) / 2, y2


def count_line_crossings(rows: list[dict], line_y: int) -> dict:
    """足元が横線 line_y を越えた人を、向きごとに数える（1人は向きごとに1回まで）。"""
    last_foot_y: dict[int, int] = {}  # 人ごとの、前のフレームの足元の y
    down: list[int] = []              # 上から下へ越えた人の ID
    up: list[int] = []                # 下から上へ越えた人の ID
    events: list[dict] = []           # いつ・誰が・どちら向きに越えたか
    for row in rows:                  # rows はフレームの順に並んでいる
        track_id = row["tracking_id"]
        if track_id is None:          # 追跡 ID が無い行（--detect-only の結果）は使えない
            continue
        _, foot_y = foot_point(row["bbox"])
        prev_y = last_foot_y.get(track_id)
        if prev_y is not None:
            if prev_y < line_y <= foot_y and track_id not in down:
                down.append(track_id)
                events.append({"frame": row["frame"], "tracking_id": track_id, "direction": "down"})
            elif prev_y >= line_y > foot_y and track_id not in up:
                up.append(track_id)
                events.append({"frame": row["frame"], "tracking_id": track_id, "direction": "up"})
        last_foot_y[track_id] = foot_y
    return {"down": down, "up": up, "events": events}


def count_zone_frames(rows: list[dict], zone: tuple[int, int, int, int]) -> dict[int, int]:
    """足元が四角い範囲 zone の中にあったフレーム数を、人ごとに数える。"""
    zx1, zy1, zx2, zy2 = zone
    frames: dict[int, int] = defaultdict(int)
    for row in rows:
        track_id = row["tracking_id"]
        if track_id is None:
            continue
        foot_x, foot_y = foot_point(row["bbox"])
        if zx1 <= foot_x <= zx2 and zy1 <= foot_y <= zy2:
            frames[track_id] += 1
    return dict(frames)


def draw_video(source: str, rows: list[dict], line_y: int, zone: tuple[int, int, int, int],
               crossings: dict, out_path: Path) -> None:
    """元の動画に、線・範囲・足元の点・その時点までの人数を描いて保存する。"""
    rows_by_frame: dict[int, list[dict]] = defaultdict(list)
    for row in rows:
        rows_by_frame[row["frame"]].append(row)

    cap = cv2.VideoCapture(source)
    if not cap.isOpened():
        raise SystemExit(f"映像を開けません: {source}")
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    size = (int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)))
    writer = cv2.VideoWriter(str(out_path), cv2.VideoWriter_fourcc(*"mp4v"), fps, size)

    zx1, zy1, zx2, zy2 = zone
    frame_number = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        cv2.line(frame, (0, line_y), (size[0], line_y), (0, 255, 255), 2)       # 線（黄）
        cv2.rectangle(frame, (zx1, zy1), (zx2, zy2), (255, 0, 255), 2)           # 範囲（紫）
        for row in rows_by_frame.get(frame_number, []):
            if row["tracking_id"] is None:
                continue
            fx, fy = foot_point(row["bbox"])
            cv2.circle(frame, (int(fx), int(fy)), 6, (0, 0, 255), -1)            # 足元（赤）
            cv2.putText(frame, f"id:{row['tracking_id']}", (int(fx) + 8, int(fy)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
        # この時点までに線を越えた人数
        down = sum(1 for e in crossings["events"] if e["direction"] == "down" and e["frame"] <= frame_number)
        up = sum(1 for e in crossings["events"] if e["direction"] == "up" and e["frame"] <= frame_number)
        cv2.putText(frame, f"down: {down}  up: {up}", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 255), 2)
        writer.write(frame)
        frame_number += 1

    cap.release()
    writer.release()


def parse_zone(text: str) -> tuple[int, int, int, int]:
    """"x1,y1,x2,y2" という文字を、4つの数に分ける。"""
    values = [int(v) for v in text.split(",")]
    if len(values) != 4:
        raise SystemExit("--zone は x1,y1,x2,y2 の形で指定します（例：0,0,384,576）")
    return values[0], values[1], values[2], values[3]


def main() -> None:
    parser = argparse.ArgumentParser(description="線を越えた人数と、範囲にいた時間を数える")
    parser.add_argument("--out-dir", default="out", help="Step 2 の結果のフォルダ")
    parser.add_argument("--line-y", type=int, default=288, help="横線の y 座標")
    parser.add_argument("--zone", default="0,0,384,576", help="範囲 x1,y1,x2,y2")
    parser.add_argument("--source", help="元の動画。指定すると、線と範囲を描いた analysis.mp4 を作る")
    args = parser.parse_args()

    out_dir = Path(args.out_dir)
    rows = load_rows(out_dir / "detections.jsonl")
    fps = json.loads((out_dir / "summary.json").read_text(encoding="utf-8"))["fps"]
    zone = parse_zone(args.zone)

    crossings = count_line_crossings(rows, args.line_y)
    zone_frames = count_zone_frames(rows, zone)

    print(f"線（y={args.line_y}）を越えた人数")
    print(f"  上から下へ: {len(crossings['down'])}人  ID {crossings['down']}")
    print(f"  下から上へ: {len(crossings['up'])}人  ID {crossings['up']}")
    print(f"範囲（{zone[0]},{zone[1]})-({zone[2]},{zone[3]}）にいた時間")
    for track_id, frames in sorted(zone_frames.items()):
        print(f"  ID {track_id}: {frames / fps:.2f} 秒（{frames} フレーム）")
    if not zone_frames:
        print("  範囲に入った人はいません")

    analysis = {
        "line_y": args.line_y,
        "down": crossings["down"],
        "up": crossings["up"],
        "events": crossings["events"],
        "zone": list(zone),
        "zone_seconds": {str(k): round(v / fps, 2) for k, v in sorted(zone_frames.items())},
    }
    (out_dir / "analysis.json").write_text(json.dumps(analysis, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"保存しました: {out_dir / 'analysis.json'}")

    if args.source:
        draw_video(args.source, rows, args.line_y, zone, crossings, out_dir / "analysis.mp4")
        print(f"保存しました: {out_dir / 'analysis.mp4'}")


if __name__ == "__main__":
    main()
```

#### プログラムの読み方

| 部分                     | していること                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| `load_rows()`            | `detections.jsonl` を読み、1行を1つの辞書にした一覧にする                                       |
| `foot_point()`           | 枠から足元の点を計算する（1-1）                                                                 |
| `count_line_crossings()` | 人物ごとに前のフレームの足元を覚えておき、線を越えたかを判断する（1-2）。モデルは使わない       |
| `count_zone_frames()`    | 足元が範囲の中にあったフレーム数を、人物ごとに数える（1-3）。モデルは使わない                   |
| `draw_video()`           | `--source` を指定したときだけ、元の動画に線・範囲・足元の点・人数を描いて `analysis.mp4` を作る |
| `main()`                 | オプションを受け取り、結果を表示して `analysis.json` に保存する                                 |

#### 主なオプション

| オプション  | 初期値        | 意味                                                                            |
| ----------- | ------------- | ------------------------------------------------------------------------------- |
| `--out-dir` | `out`         | Step 2 の結果のフォルダ。`detections.jsonl` と `summary.json` を読む            |
| `--line-y`  | `288`         | 横線の y 座標（サンプル動画の高さ 576 のちょうど真ん中）                        |
| `--zone`    | `0,0,384,576` | 範囲の `x1,y1,x2,y2`（左上の x, y と右下の x, y）。初期値はサンプル動画の左半分 |
| `--source`  | なし          | 元の動画。指定すると `analysis.mp4` を作る                                      |

### 3-2. 実行する

```bash
uv run python analyze.py --source sample.mp4
```

サンプル動画では、次のようになりました（2026年11月に試した結果です。以下同じ）。

```text
線（y=288）を越えた人数
  上から下へ: 13人  ID [10, 14, 12, 6, 5, 21, 8, 24, 25, 33, 28, 39, 32]
  下から上へ: 18人  ID [1, 6, 5, 8, 12, 13, 19, 18, 21, 26, 33, 28, 39, 32, 25, 43, 44, 37]
範囲（0,0)-(384,576）にいた時間
  ID 1: 2.70 秒（27 フレーム）
  ID 8: 11.20 秒（112 フレーム）
  （中略）
  ID 37: 23.90 秒（239 フレーム）
  ID 39: 10.00 秒（100 フレーム）
  ID 40: 6.90 秒（69 フレーム）
  ID 43: 5.60 秒（56 フレーム）
  ID 44: 4.10 秒（41 フレーム）
  ID 48: 2.10 秒（21 フレーム）
保存しました: out/analysis.json
保存しました: out/analysis.mp4
```

ID の並びは、線を越えた順です。上から下へ・下から上への両方に出てくる ID（6、5、8 など）があります。サンプル動画の人たちは広場を行ったり来たりしているので、同じ人が線を両方の向きに越えています。1-2 で決めたとおり、1人は向きごとに1回まで数えます。

### 3-3. 結果の動画で確かめる

```bash
explorer.exe out
```

`analysis.mp4` を再生すると、次のものが描かれています。

| 描かれているもの             | 色                                  |
| ---------------------------- | ----------------------------------- |
| 線                           | 黄                                  |
| 範囲                         | 紫                                  |
| 人物の足元と ID              | 赤い点と `id:番号`                  |
| その時点までに線を越えた人数 | 左上の `down: 人数  up: 人数`（黄） |

足元の赤い点が黄色の線をまたいだ瞬間に、左上の人数が増えることを確かめます。

### 3-4. 線の位置を変えてみる

`analyze.py` は `detections.jsonl` を読むだけなので、AI をもう一度動かさずに一瞬で数え直せます。

```bash
uv run python analyze.py --line-y 200
uv run python analyze.py --line-y 400
```

サンプル動画では、次のようになりました。自分でも別の値を試して、表に足していきます。

| line-y | 上から下へ | 下から上へ | 気づいたこと                           |
| ------ | ---------- | ---------- | -------------------------------------- |
| 200    | 5人        | 5人        | 道の奥側。ここまで来る人が少ない       |
| 288    | 13人       | 18人       | 道の真ん中。ほとんどの人が通る         |
| 400    | 4人        | 8人        | 道の手前側。芝生に近く、通る人が少ない |
|        |            |            |                                        |

画面の端に近い線では、人が線を越える前に画面の外へ出たり、画面に入ってきた時点ですでに線を越えていたりして、数えられないことがあります。線は、人が必ず通る場所の真ん中あたりに引くのが基本です。

## 4. 範囲にいた時間を測る

### 4-1. 結果を読む

第3章の実行結果の後半が、範囲にいた時間です。`out/analysis.json` の `zone_seconds` にも保存されています。

初期値の範囲は画面の左半分（`0,0,384,576`）です。3-2 の結果では、19人（19の ID）がこの範囲に入り、一番長くいたのは ID 37 の 23.9 秒でした。

この数字を読むときは、次の2点に気をつけます。

- 1人の ID が途中で変わると、同じ人の時間が2つの ID に分かれます
- 検出が途切れたフレームは数えないので、実際より短めになります（1-3）

### 4-2. 範囲を変えてみる

2-2 の目盛りの画像を見ながら、範囲を変えて試します。次の例は、画面の右側の道の部分です。

```bash
uv run python analyze.py --zone 400,200,768,450 --source sample.mp4
```

`out/analysis.mp4` で、紫の四角が思ったとおりの場所にあるかを確かめます。サンプル動画では、この範囲に30人（30の ID）が入りました。道の上なので、左半分の芝生側より多くの人が通ります。

| 範囲                          | 入った人数（ID の数） | 一番長くいた人 | 気づいたこと |
| ----------------------------- | --------------------- | -------------- | ------------ |
| `0,0,384,576`（左半分）       | 19                    | ID 37：23.9 秒 |              |
| `400,200,768,450`（右側の道） | 30                    | ID 25：31.8 秒 |              |
|                               |                       |                |              |

### 4-3. 使いどころ

| 使いどころ           | 線・範囲の置き方                                            |
| -------------------- | ----------------------------------------------------------- |
| 入口を通った人数     | 入口の床に線を引き、入る向き・出る向きを分けて数える        |
| 受付やレジの待ち時間 | 待つ場所を範囲にして、1人あたりの時間を測る                 |
| 立ち入り禁止の場所   | 範囲に入った人がいたかどうか（時間が 0 より大きいか）を見る |

## 5. 姿勢を推定する

### 5-1. 姿勢推定とは

姿勢推定（Pose Estimation）では、人物の枠に加えて、体の **17か所の点（キーポイント）** の位置を推定します。点は番号で区別します。

| 番号 | 場所       | 番号   | 場所           |
| ---- | ---------- | ------ | -------------- |
| 0    | 鼻         | 9      | 左手首         |
| 1・2 | 左目・右目 | 10     | 右手首         |
| 3・4 | 左耳・右耳 | 11・12 | 左腰・右腰     |
| 5    | 左肩       | 13・14 | 左膝・右膝     |
| 6    | 右肩       | 15・16 | 左足首・右足首 |
| 7・8 | 左肘・右肘 |        |                |

「左」「右」は、写っている人から見た左右です（画面の左右とは逆になることが多い）。

それぞれの点には、位置 `(x, y)` と、その点の信頼度（0〜1）が付きます。体の後ろに隠れた点や画面の外の点は、信頼度が低くなり、位置は `(0, 0)` になることがあります。

### 5-2. 手を挙げているかの判断

**手首が、同じ側の肩より上にあれば「手を挙げている」**と判断します。y は下ほど大きいので、「上にある」は「y が小さい」ことです。

ただし、点の信頼度が低いときは判断しません。見えていない手首は位置が `(0, 0)` になることがあり、そのまま比べると「y = 0 なので肩より上」＝「手を挙げている」と誤って判断してしまうからです。

### 5-3. pose.py を作る

`pose.py` を作り、次の内容を保存します。画像でも動画でも使えます。

```python
"""姿勢を推定し、手を挙げている人を見つける（画像・動画のどちらでも使える）。"""
import argparse
from pathlib import Path

import cv2
from ultralytics import YOLO

# 17点のうち、使う点の番号
LEFT_SHOULDER, RIGHT_SHOULDER = 5, 6
LEFT_WRIST, RIGHT_WRIST = 9, 10
MIN_KEYPOINT_CONF = 0.5  # これより自信の低い点は「見えていない」とみなす
VIDEO_SUFFIXES = {".mp4", ".mov", ".avi", ".mkv"}


def is_hand_raised(xy: list[list[float]], kconf: list[float]) -> bool:
    """左右どちらかの手首が、同じ側の肩より上にあれば True を返す。"""
    for shoulder, wrist in ((LEFT_SHOULDER, LEFT_WRIST), (RIGHT_SHOULDER, RIGHT_WRIST)):
        if kconf[shoulder] < MIN_KEYPOINT_CONF or kconf[wrist] < MIN_KEYPOINT_CONF:
            continue  # 肩か手首が見えていなければ、その側は判定しない
        if xy[wrist][1] < xy[shoulder][1]:  # y は下ほど大きいので、小さいほうが上
            return True
    return False


def main() -> None:
    parser = argparse.ArgumentParser(description="姿勢を推定し、手を挙げている人を見つける")
    parser.add_argument("--source", default="sample.jpg", help="画像または動画のファイル")
    parser.add_argument("--out-dir", default="out_pose", help="結果の保存先フォルダ")
    parser.add_argument("--conf", type=float, default=0.4, help="人物の信頼度のしきい値")
    args = parser.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    is_video = Path(args.source).suffix.lower() in VIDEO_SUFFIXES
    model = YOLO("yolo11n-pose.pt")  # 姿勢推定用のモデル（初回はダウンロードされる）

    writer = None
    frame_count = 0
    frames_with_hand_up = 0
    for result in model(args.source, stream=True, conf=args.conf, verbose=False):
        annotated = result.plot()  # 枠と骨格（点と線）を描く
        persons = len(result.boxes)
        hand_up = 0
        if persons and result.keypoints.conf is not None:
            for i, (xy, kconf, box) in enumerate(zip(result.keypoints.xy.tolist(),
                                                     result.keypoints.conf.tolist(),
                                                     result.boxes.xyxy.tolist())):
                raised = is_hand_raised(xy, kconf)
                if raised:
                    hand_up += 1
                    cv2.putText(annotated, "HAND UP", (int(box[0]), max(int(box[1]) - 30, 20)),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
                if not is_video:  # 画像のときは、1人ずつ肩と手首の位置を表示する
                    print(f"人物 {i + 1}: 手を挙げている={raised}  "
                          f"左肩y={xy[LEFT_SHOULDER][1]:.0f}({kconf[LEFT_SHOULDER]:.2f}) "
                          f"左手首y={xy[LEFT_WRIST][1]:.0f}({kconf[LEFT_WRIST]:.2f})  "
                          f"右肩y={xy[RIGHT_SHOULDER][1]:.0f}({kconf[RIGHT_SHOULDER]:.2f}) "
                          f"右手首y={xy[RIGHT_WRIST][1]:.0f}({kconf[RIGHT_WRIST]:.2f})")
        cv2.putText(annotated, f"persons: {persons}  hand up: {hand_up}", (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)

        if is_video:
            if writer is None:
                fps = cv2.VideoCapture(args.source).get(cv2.CAP_PROP_FPS) or 30.0
                height, width = annotated.shape[:2]
                writer = cv2.VideoWriter(str(out_dir / "pose.mp4"), cv2.VideoWriter_fourcc(*"mp4v"),
                                         fps, (width, height))
            writer.write(annotated)
        else:
            cv2.imwrite(str(out_dir / "pose.jpg"), annotated)
        frame_count += 1
        frames_with_hand_up += 1 if hand_up else 0

    if writer is not None:
        writer.release()
        print(f"保存しました: {out_dir / 'pose.mp4'}（{frame_count} フレーム中、"
              f"手を挙げている人がいたのは {frames_with_hand_up} フレーム）")
    else:
        print(f"保存しました: {out_dir / 'pose.jpg'}")


if __name__ == "__main__":
    main()
```

| 部分                      | していること                                                         |
| ------------------------- | -------------------------------------------------------------------- |
| 先頭の定数                | 肩と手首の番号（5・6・9・10）と、「見えている」とみなす信頼度（0.5） |
| `is_hand_raised()`        | 5-2 の判断。左右それぞれ、肩と手首が見えているときだけ比べる         |
| `YOLO("yolo11n-pose.pt")` | 姿勢推定用のモデル（約6MB。初回はダウンロードされる）                |
| `model(..., stream=True)` | 画像なら1回、動画なら1フレームずつ結果を返す                         |
| `result.keypoints`        | 17点の位置（`xy`）と信頼度（`conf`）                                 |

### 5-4. 画像で試す

```bash
uv run python pose.py --source sample.jpg
```

```text
人物 1: 手を挙げている=False  左肩y=493(0.99) 左手首y=532(0.90)  右肩y=499(1.00) 右手首y=534(0.97)
人物 2: 手を挙げている=False  左肩y=487(0.67) 左手首y=569(0.45)  右肩y=483(0.24) 右手首y=563(0.13)
人物 3: 手を挙げている=False  左肩y=495(1.00) 左手首y=535(0.91)  右肩y=499(1.00) 右手首y=616(0.95)
人物 4: 手を挙げている=False  左肩y=546(0.21) 左手首y=713(0.34)  右肩y=551(0.23) 右手首y=718(0.36)
保存しました: out_pose/pose.jpg
```

かっこの中の数字が、その点の信頼度です。

- 人物 1・3：肩と手首がはっきり見えています（信頼度 0.9 前後）。手首の y（532 など）が肩の y（493 など）より大きいので、手首は肩より下＝手を下ろしている、と判断しました
- 人物 2・4：信頼度が 0.5 未満の点があります。人物 4 は画像の左端で体の一部しか写っていない人です。見えていない点は判断に使わないので、結果は `False` になっています

`out_pose/pose.jpg` を開くと、人物ごとに骨格（点と線）が描かれています。

### 5-5. 動画で試す

```bash
uv run python pose.py --source sample.mp4 --out-dir out_pose_video
```

```text
保存しました: out_pose_video/pose.mp4（795 フレーム中、手を挙げている人がいたのは 4 フレーム）
```

サンプル動画には、手を挙げている人はいません。それでも 4 フレームで `HAND UP` と判断されました。これは**誤検出**です。`out_pose_video/pose.mp4` を再生して、`hand up: 1` になる場面を探し、なぜ間違えたかを考えます。

- 人が遠くて小さく写っていて、肩や手首の位置が数ピクセルずれるだけで上下が入れ替わる
- 歩きながら腕を振ったり、物を持ったりして、手首が肩に近い高さになる

業務で使うなら、「1フレームだけ `HAND UP` になったときは数えず、数フレーム続いたときだけ『手を挙げた』とする」などの工夫が必要です。

### 5-6. 自分で手を挙げて試す

Step 2 の 4-4 と同じ方法で、カメラアプリで自分が手を挙げ下げする動画（10秒ほど）を録画してコピーし、試します。

```bash
cp "/mnt/c/Users/ユーザー名/Pictures/Camera Roll/WIN_20261119_10_00_00_Pro.mp4" handup.mp4
uv run python pose.py --source handup.mp4 --out-dir out_pose_handup
```

`out_pose_handup/pose.mp4` で、手を挙げている間だけ `HAND UP` と表示されるかを確かめます。次のような場面でどうなるかも見てみます。

- 手を肩の高さちょうどに上げる
- 横を向いて片手を挙げる（片方の肩・手首が隠れる）
- 手を頭の上で組む

## 6. 精度を確かめる

人物の認識で最も大事な作業です。AI の結果は必ずどこかで間違えます。**どんな条件で、どう間違えるか**を自分の目で確かめて記録します。

### 6-1. 確かめる3種類の間違い

| 間違い        | 意味                                                     | 例                                         |
| ------------- | -------------------------------------------------------- | ------------------------------------------ |
| 見落とし      | 人がいるのに検出されない                                 | 遠くて小さい人、半分隠れた人               |
| 誤検出        | 人がいないのに人と検出される                             | マネキン、ポスターの人物、人の形に見える影 |
| ID の取り違え | 追跡の ID が別の人に移る、または同じ人に新しい ID が付く | 2人がすれ違う、物陰に隠れる                |

### 6-2. 条件の違う動画を用意する

次のような条件の動画を、10〜20秒ずつ用意します。カメラアプリで録画するか、公開データセットを使います。録画する場合は、写る人全員の許可を取ります。

| 条件             | 例                                           |
| ---------------- | -------------------------------------------- |
| 人が重なる       | 2〜3人が並んで歩く、すれ違う                 |
| 暗い             | 照明を落とした部屋                           |
| 遠い             | カメラから離れた場所を歩く                   |
| 後ろ向き・横向き | カメラに背を向けて歩く                       |
| 人が多い         | 公開データセット（MOT17 など）の混雑した場面 |

まずはサンプル動画（`sample.mp4`）で手順を覚えます。サンプル動画には、「遠くて小さい人」「標識の柱の陰に半分隠れる人」「すれ違う人」が含まれています。

### 6-3. check_frames.py を作る

動画から等しい間隔で数枚のフレームを取り出し、しきい値（conf）を変えたときの検出結果を画像に保存するプログラムです。

```python
"""精度を確かめるために、動画から数枚のフレームを取り出し、しきい値ごとの検出結果を画像に保存する。"""
import argparse
import csv
from pathlib import Path

import cv2
from ultralytics import YOLO

PERSON_CLASS_ID = 0


def main() -> None:
    parser = argparse.ArgumentParser(description="しきい値ごとの検出結果を、数枚のフレームで比べる")
    parser.add_argument("--source", default="sample.mp4", help="動画ファイル")
    parser.add_argument("--count", type=int, default=10, help="取り出すフレームの枚数")
    parser.add_argument("--confs", default="0.25,0.4,0.6", help="比べるしきい値（カンマ区切り）")
    parser.add_argument("--out-dir", default="out_check", help="結果の保存先フォルダ")
    args = parser.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    confs = [float(c) for c in args.confs.split(",")]
    model = YOLO("yolo11n.pt")

    cap = cv2.VideoCapture(args.source)
    if not cap.isOpened():
        raise SystemExit(f"映像を開けません: {args.source}")
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    # 動画全体から、等しい間隔で count 枚を選ぶ
    frame_numbers = [int(i * total / args.count) for i in range(args.count)]

    rows = []
    for number in frame_numbers:
        cap.set(cv2.CAP_PROP_POS_FRAMES, number)
        ok, frame = cap.read()
        if not ok:
            continue
        cv2.imwrite(str(out_dir / f"frame{number:05d}_original.jpg"), frame)  # 目で数える用
        counts = []
        for conf in confs:
            result = model(frame, classes=[PERSON_CLASS_ID], conf=conf, verbose=False)[0]
            cv2.imwrite(str(out_dir / f"frame{number:05d}_conf{conf}.jpg"), result.plot())
            counts.append(len(result.boxes))
        rows.append([number, round(number / fps, 2), *counts])
    cap.release()

    # Excel で開ける表（実際の人数などは、画像を見て自分で書き込む）
    header = ["frame", "seconds", *[f"detected_conf{c}" for c in confs], "actual", "missed", "false_detected", "note"]
    with open(out_dir / "check.csv", "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(header)
        for row in rows:
            writer.writerow([*row, "", "", "", ""])

    print("フレーム  秒  " + "  ".join(f"conf{c}" for c in confs))
    for row in rows:
        print(f"{row[0]:>6}  {row[1]:>5}  " + "  ".join(f"{n:>8}" for n in row[2:]))
    print(f"保存しました: {out_dir}（画像 {len(rows) * (len(confs) + 1)} 枚と check.csv）")


if __name__ == "__main__":
    main()
```

### 6-4. 実行して、画像を目で確かめる

```bash
uv run python check_frames.py --source sample.mp4
```

```text
フレーム  秒  conf0.25  conf0.4  conf0.6
     0    0.0         3         3         3
    79    7.9         6         6         5
   159   15.9         7         6         5
   238   23.8         7         7         6
   318   31.8         5         5         5
   397   39.7         3         3         3
   477   47.7         3         3         3
   556   55.6         6         6         6
   636   63.6         6         6         6
   715   71.5         8         8         8
保存しました: out_check（画像 40 枚と check.csv）
```

80秒の動画から、約8秒ごとに10枚のフレームを取り出し、しきい値ごとに検出した人数を表示しています。`out_check/` には、フレームごとに次の画像ができます。

| ファイル                       | 中身                               |
| ------------------------------ | ---------------------------------- |
| `frame00159_original.jpg`      | 元のフレーム（人数を目で数える用） |
| `frame00159_conf0.25.jpg` など | しきい値ごとの検出結果             |

次の手順で確かめます。

1. `_original.jpg` を見て、写っている人数を目で数える（体の一部だけ写っている人をどう数えるかは、先に決めておく）
2. 各しきい値の画像を見て、見落とし（枠の無い人）と誤検出（人でない枠）を数える
3. `out_check/check.csv` を Excel で開き、`actual`（実際の人数）・`missed`（見落とし）・`false_detected`（誤検出）・`note`（気づいたこと）を書き込む

#### 例：159番のフレーム（15.9秒）

`frame00159_original.jpg` を目で数えると、7人が写っています（左上の奥に1人、中央の標識の付近に4人、右上の奥に2人）。

| conf | 検出した人数 | 見落とし | 誤検出 | 気づいたこと                         |
| ---- | ------------ | -------- | ------ | ------------------------------------ |
| 0.25 | 7            | 0        | 0      | 標識の柱の陰に半分隠れた人も見つけた |
| 0.4  | 6            | 1        | 0      | 柱の陰の人を見落とした               |
| 0.6  | 5            | 2        | 0      | さらに、遠くの小さい人も見落とした   |

このフレームでは、しきい値を上げるほど見落としが増え、誤検出は 0 のままでした。「半分隠れた人」と「遠くて小さい人」は、信頼度が低くなりやすいことが分かります。

### 6-5. ID の取り違えを確かめる

ID の取り違えは1枚の画像では分からないので、Step 2 の `video.py` で処理した動画を見て確かめます。

```bash
uv run python video.py --source 用意した動画.mp4 --out-dir out_条件名
```

`output.mp4` を再生し、次を数えます。Step 2 の 6-4 で観察した結果も使えます。

- 動画に映った実際の人数と、`summary.json` の `person_tracks` の数
- 2人がすれ違ったときに、ID が入れ替わったか
- 隠れてから出てきた人に、新しい ID が付いたか

### 6-6. 精度の表にまとめる

条件ごとに、次の表にまとめます。

| 条件         | conf | 実際の人数 | 検出数 | 見落とし | 誤検出 | ID の取り違え | 気づいたこと |
| ------------ | ---- | ---------- | ------ | -------- | ------ | ------------- | ------------ |
| サンプル動画 | 0.4  |            |        |          |        |               |              |
| 人が重なる   | 0.4  |            |        |          |        |               |              |
| 暗い         | 0.4  |            |        |          |        |               |              |
| 遠い         | 0.4  |            |        |          |        |               |              |
| 後ろ向き     | 0.4  |            |        |          |        |               |              |

表を見ながら、次の2つを言葉にします。

- このモデル（`yolo11n.pt`）が苦手な条件を3つ
- 業務で使うなら、どの conf を選び、どんな確認の手順を足すか（例：見落としが困る用途なら conf を下げ、誤検出は人が確認する）

この表は、Step 5 で Google の Video Intelligence API と比べるときにも使います。

### 6-7. さらに進めるなら

正解の枠と ID が付いた公開データセット（MOT17 など）と評価ツール（TrackEval など）を使うと、精度を数値（MOTA・IDF1 など）で比べられます。MOT17 は非商用のライセンスなので、学習目的に限って使います。

## 7. 発展：数え方をテストで確かめる

`analyze.py` の数え方（`count_line_crossings()` と `count_zone_frames()`）は、モデルを使わない関数です。そのため、「この座標の並びなら、こう数えられるはず」という例を書いて、自動で確かめられます。これを**テスト**と呼びます。

### 7-1. pytest を入れる

```bash
uv add --dev pytest
```

`--dev` は「開発のときだけ使う」という指定です。Step 6 の Docker イメージは `uv sync --no-dev` で作るので、pytest はイメージに入りません。

### 7-2. test_analyze.py を作る

```python
"""analyze.py の数え方が正しいかを、モデルを使わずに確かめるテスト。"""
from analyze import count_line_crossings, count_zone_frames


def make_row(frame: int, track_id: int | None, foot_y: int, x1: int = 100, x2: int = 200) -> dict:
    """足元の y が foot_y になる、detections.jsonl の1行を作る。"""
    return {"frame": frame, "tracking_id": track_id, "confidence": 0.9, "bbox": [x1, foot_y - 200, x2, foot_y]}


def test_上から下へ越えると_down_に数える():
    rows = [make_row(0, 1, 300), make_row(1, 1, 350), make_row(2, 1, 400)]
    result = count_line_crossings(rows, line_y=360)
    assert result["down"] == [1]
    assert result["up"] == []


def test_足元が線ちょうどに乗ったら_越えたとみなす():
    rows = [make_row(0, 1, 300), make_row(1, 1, 360)]
    result = count_line_crossings(rows, line_y=360)
    assert result["down"] == [1]


def test_線の前後を行き来しても_同じ向きは1回だけ数える():
    feet = [300, 400, 300, 400]  # 下へ・上へ・下へ
    rows = [make_row(i, 1, y) for i, y in enumerate(feet)]
    result = count_line_crossings(rows, line_y=360)
    assert result["down"] == [1]
    assert result["up"] == [1]


def test_線に届かなければ数えない():
    rows = [make_row(0, 1, 300), make_row(1, 1, 359)]
    result = count_line_crossings(rows, line_y=360)
    assert result["down"] == [] and result["up"] == []


def test_追跡IDの無い行は使わない():
    rows = [make_row(0, None, 300), make_row(1, None, 400)]
    result = count_line_crossings(rows, line_y=360)
    assert result["down"] == []


def test_範囲の中にいたフレーム数を人ごとに数える():
    rows = [
        make_row(0, 1, 500),  # 足元 (150, 500) は範囲の中
        make_row(1, 1, 500),
        make_row(2, 1, 800),  # 範囲の外
        make_row(0, 2, 500, x1=900, x2=1000),  # 足元 x=950 は範囲の外
    ]
    result = count_zone_frames(rows, zone=(0, 400, 400, 720))
    assert result == {1: 2}
```

テストの関数名は `test_` で始めます。日本語で何を確かめているかを書いておくと、失敗したときに分かりやすくなります。

### 7-3. テストを実行する

```bash
uv run pytest
```

```text
test_analyze.py ......                                                   [100%]

============================== 6 passed in 1.37s ===============================
```

`.` が1つのテストの成功を表します。6つのテストがすべて通りました（`6 passed`）。

わざと間違えてみると、テストの役割が分かります。`analyze.py` の `if prev_y < line_y <= foot_y and` を `if prev_y < line_y < foot_y and` に変えて（`=` を1文字消して）、もう一度 `uv run pytest` を実行します。

```text
FAILED test_analyze.py::test_足元が線ちょうどに乗ったら_越えたとみなす - asse...
========================= 1 failed, 5 passed in 3.47s ==========================
```

「足元が線ちょうどに乗った」場合を数えなくなったことを、テストが見つけてくれました。このように、数え方を後から直したときに、前にできていたことが壊れていないかを一瞬で確かめられます。確かめたら、`=` を元に戻します。

## 8. うまくいかないとき

| 症状                                                                | 原因と対処                                                                                                                                                                            |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FileNotFoundError: out/detections.jsonl`                           | Step 2 の結果が無い。`uv run python video.py --source sample.mp4` を実行してから、もう一度                                                                                            |
| `KeyError: 'fps'`                                                   | `summary.json` が古いか壊れている。Step 2 の `video.py` をもう一度実行する                                                                                                            |
| 線を越えた人数がすべて 0 人                                         | 線の位置が人の通り道から外れている。2-2 の目盛りの画像で y 座標を確かめる。または `out/` が `--detect-only` で作られていて ID が無い（`detections.jsonl` の `tracking_id` が `null`） |
| 範囲にいた人がいない                                                | 範囲の座標が逆（x1 が x2 より大きいなど）か、人の足元が通らない場所にある。`analysis.mp4` で紫の四角の位置を確かめる                                                                  |
| `--zone は x1,y1,x2,y2 の形で指定します`                            | `--zone` の数が4つでないか、空白が入っている。`--zone 400,200,768,450` のように空白なしで書く                                                                                         |
| 手を下ろしているのに `HAND UP` になる                               | 手首と肩が近い高さにある、または点の推定がずれている。`MIN_KEYPOINT_CONF` を 0.6〜0.7 に上げて試す                                                                                    |
| 手を挙げているのに `HAND UP` にならない                             | 肩か手首が見えていない（信頼度が 0.5 未満）。画像で試したときの表示（手首の信頼度）を確かめる                                                                                         |
| `check.csv` を Excel で開くと文字化けする                           | 普通はならない（BOM 付きで保存している）。ダブルクリックではなく、Excel の「データ」→「テキストまたは CSV から」で UTF-8 を選んで開く                                                 |
| `uv run pytest` で `ModuleNotFoundError: No module named 'analyze'` | `test_analyze.py` が `analyze.py` と同じフォルダ（プロジェクトの一番上）に無い。同じ場所に置く                                                                                        |
| `uv run pytest` で `no tests ran`                                   | テストのファイル名が `test_` で始まっていないか、関数名が `test_` で始まっていない                                                                                                    |

## 9. 完了条件

- [ ] 線を越えた人数を数え、`analysis.mp4` に表示できた
- [ ] 範囲にいた時間を人物ごとに測れた
- [ ] 手を挙げている人を判定できた（自分の動画で `HAND UP` が出た）
- [ ] 精度の表を作り、「このモデルが苦手な条件」を3つ挙げられる
- [ ] （発展）`uv run pytest` でテストがすべて通った

## 10. このあとの Step とのつながり

Step 3 が終わった時点で、プロジェクトのフォルダには次のファイルが増えています。

```text
~/dev/image-recognition-handson/
├── frame_grid.py      ← 座標の目盛り
├── analyze.py         ← 線を越えた人数・範囲にいた時間
├── pose.py            ← 姿勢推定・手を挙げている人
├── check_frames.py    ← 精度の確認用の画像
├── test_analyze.py    ← 数え方のテスト（発展）
├── out/
│   ├── analysis.json
│   └── analysis.mp4
├── out_pose/  out_pose_video/  out_check/  …（結果。Git には入らない）
├── yolo11n-pose.pt    ← 姿勢推定のモデル（Git には入らない）
└── （Step 1・2 のファイル）
```

区切りとして、プログラムを Git に記録します。`uv add --dev pytest` で `pyproject.toml` と `uv.lock` も変わっているので、一緒に記録します。

```bash
git add frame_grid.py analyze.py pose.py check_frames.py test_analyze.py pyproject.toml uv.lock
git commit -m "Step 3: 線を越えた人数・範囲にいた時間・姿勢・精度の確認"
```

このあとの Step で、次のように使います。

| Step 3 で作ったもの                                          | 使う Step       | 使い方                                                                                                       |
| ------------------------------------------------------------ | --------------- | ------------------------------------------------------------------------------------------------------------ |
| 精度の表（6-6）                                              | Step 5          | 同じ動画・同じフレームで、Google の Video Intelligence API と見落とし・誤検出を比べる                        |
| `analyze.py` の考え方（`detections.jsonl` を後から集計する） | Step 4          | Cloud Storage に置いた `detections.jsonl` も、同じように後から集計できる。大量になったら BigQuery で集計する |
| モデルを使わない関数とテスト                                 | 計画の第5章     | 発展の構成（追跡・集計のフォルダとテストのフォルダ）に移すときの土台になる                                   |
| 苦手な条件の理解                                             | 第6章（顔認識） | 誤認識の影響が大きい用途で、人が確認する手順を設計するときの根拠になる                                       |

`video.py` は変えていないので、Step 4 以降はそのまま進められます。次は Step 4「Google Cloud に結果を保存する」に進みます。
