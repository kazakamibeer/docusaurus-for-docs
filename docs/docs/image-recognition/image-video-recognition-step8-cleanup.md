---
sidebar_position: 9
title: 【画像認識ハンズオン】Step 8
---

# Step 8 詳細手順：後片付け

[[image-video-recognition-google-cloud-handson]] の Step 8 を、普段 Google Cloud を使わない人でも進められるように詳しく書いた手順書です。Step 4〜7 で Google Cloud に作ったものを削除し、料金がかからない状態にします。

## 0. この手順書について

### このステップでやること

| やること                            | 理由                                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------------------- |
| Google Cloud に作ったものを削除する | 置いておくだけで料金がかかるものがあるため（VM のディスク、保存したファイル、イメージなど） |
| 人が写った動画・結果を削除する      | 計画の第3章 3-1「使う映像のルール」のとおり、使い終わったら残さないため                     |
| ローカルのログイン情報を消す        | 使わなくなった権限を、PC に残さないため                                                     |

### かかる時間

30分〜1時間（翌日に料金を確かめる時間を除く）

### 2つのやり方

| やり方                                      | 向いている場合                                                                                            |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **A. プロジェクトごと削除する**（おすすめ） | Step 4 の 2-1 で、ハンズオン専用のプロジェクトを作った場合。1つのコマンドで、中に作ったものがすべて消える |
| B. 作ったものを1つずつ削除する              | 他の用途にも使っているプロジェクトで、ハンズオンを進めた場合                                              |

どちらの場合も、先に第1章で「何を作ったか」を確かめます。

### 前提

- ターミナルを開いたら、最初に `cd ~/dev/image-recognition-handson` と `source cloud-env.sh` を実行すること
- **削除したものは元に戻せません。** 残しておきたい結果（Step 5・7 の比べた表など）は、先に手元に保存しておきます

## 1. 作ったものを確かめる

このハンズオンで作ったものは、次のとおりです。

| 作ったもの                       | 名前                                                                            | 作った Step              | 置いておくと料金がかかるか                           |
| -------------------------------- | ------------------------------------------------------------------------------- | ------------------------ | ---------------------------------------------------- |
| VM（CPU）                        | `recognition-cpu`                                                               | Step 6                   | かかる（動かしている間。止めてもディスク代がかかる） |
| VM（GPU）                        | `recognition-gpu`                                                               | Step 7                   | かかる（同上。GPU は高い）                           |
| Cloud Run の API                 | `recognition-api`                                                               | Step 4                   | 呼ばれなければほぼかからない                         |
| Artifact Registry のリポジトリ   | `recognition`（`worker:cpu`・`worker:gpu`）                                     | Step 6・7                | かかる（イメージの大きさに応じて）                   |
| Artifact Registry のリポジトリ   | `cloud-run-source-deploy`（API のイメージ）                                     | Step 4（自動で作られた） | かかる（同上）                                       |
| Cloud Storage のバケット         | `プロジェクトID-recognition-data`                                               | Step 4                   | かかる（ファイルの大きさに応じて）                   |
| Cloud Storage のバケット         | ビルドのときに自動で作られたもの（名前に `cloudbuild` や `run-sources` が付く） | Step 4・6・7             | かかる（同上）                                       |
| Firestore のデータベース         | `(default)`                                                                     | Step 4                   | 少しかかる（データの量に応じて）                     |
| サービスアカウント               | `recognition-api`・`recognition-worker`                                         | Step 4・6                | かからない（でも、残すと権限が残る）                 |
| 既定のサービスアカウントへの権限 | Cloud Build 用の4つのロール                                                     | Step 4                   | かからない（同上）                                   |
| 予算アラート                     | （Step 4 の 2-1 で作った名前）                                                  | Step 4                   | かからない                                           |

残っているものを確かめます。

```bash
gcloud compute instances list
gcloud run services list
gcloud artifacts repositories list
gcloud storage ls
gcloud iam service-accounts list
```

VM が残っていたら、まず VM から削除します（2-1）。

## 2. 共通：先に VM を削除する

A・B どちらの場合も、料金の大きい VM を先に削除します（Step 6・7 で削除していれば不要です）。

```bash
gcloud compute instances delete recognition-cpu --zone=${REGION}-b
gcloud compute instances delete recognition-gpu --zone=${REGION}-a
```

`was not found` と表示されたものは、すでに削除されています。

## 3. A：プロジェクトごと削除する（おすすめ）

### 3-1. 削除する

```bash
echo $PROJECT_ID
gcloud projects delete $PROJECT_ID
```

最初の行で、表示されたプロジェクト ID が**ハンズオン専用のもの**であることを必ず確かめます。確認を求められたら `Y` を押します。

### 3-2. 削除したあとのこと

- プロジェクトは、すぐには完全に消えず、**30日間は「削除の予約」の状態**になります。この間に Google Cloud Console の「IAM と管理」→「リソースの管理」から復元できます。30日たつと完全に削除されます
- 削除の予約をした時点で、中のリソース（VM・API・バケットなど）は止まり、料金は基本的に止まります
- 同じプロジェクト ID は、あとで使えなくなります

プロジェクトごと削除した場合は、第4章（1つずつ削除する）は飛ばして、第5章に進みます。

## 4. B：作ったものを1つずつ削除する

他の用途にも使っているプロジェクトの場合は、ハンズオンで作ったものだけを削除します。**名前をよく確かめてから**実行します。

### 4-1. Cloud Run の API

```bash
gcloud run services delete recognition-api --region=$REGION
```

### 4-2. Artifact Registry のリポジトリ（イメージ）

```bash
gcloud artifacts repositories delete recognition --location=$REGION
gcloud artifacts repositories delete cloud-run-source-deploy --location=$REGION
```

`cloud-run-source-deploy` は、Cloud Run に `--source` でデプロイしたときに自動で作られるリポジトリです。ハンズオンの前から、他の API のデプロイに使っていた場合は削除しません（中のイメージを確かめてから判断します）。

### 4-3. Cloud Storage のバケット

まず、認識の結果を置いたバケットを、中のファイルごと削除します。

```bash
gcloud storage rm --recursive $BUCKET
```

次に、ビルドのときに自動で作られたバケットを確かめます。

```bash
gcloud storage ls
```

名前に `cloudbuild` や `run-sources` が付いたバケットがあれば、ハンズオンのビルドで作られたものです。他の用途で使っていないことを確かめてから、同じように削除します（`gcloud storage rm --recursive gs://バケット名`）。

### 4-4. Firestore のデータベース

```bash
gcloud firestore databases delete --database="(default)"
```

他の用途で Firestore を使っている場合は、データベースごとではなく、Google Cloud Console の「Firestore」→「データ」で、`videos` のコレクションだけを削除します。

### 4-5. サービスアカウントと権限

ハンズオンで作った2つのサービスアカウントを削除します。

```bash
gcloud iam service-accounts delete "recognition-api@${PROJECT_ID}.iam.gserviceaccount.com"
gcloud iam service-accounts delete "recognition-worker@${PROJECT_ID}.iam.gserviceaccount.com"
```

Step 4 の 2-6 で、既定のサービスアカウントに付けた Cloud Build 用の4つのロールを外します。**ハンズオンの前から、他のビルドでこの権限を使っていた場合は外しません。**

```bash
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
BUILD_SA="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

for ROLE in \
  roles/artifactregistry.writer \
  roles/logging.logWriter \
  roles/storage.bucketViewer \
  roles/storage.objectUser; do
  gcloud projects remove-iam-policy-binding $PROJECT_ID --member="$BUILD_SA" --role="$ROLE" --condition=None
done
```

### 4-6. 残っていないかを確かめる

第1章のコマンドをもう一度実行し、ハンズオンで作ったものが一覧に出ないことを確かめます。

```bash
gcloud compute instances list
gcloud run services list
gcloud artifacts repositories list
gcloud storage ls
gcloud iam service-accounts list
```

## 5. ローカルを片付ける

### 5-1. 人が写った動画・結果を消す

自分や同僚を録画した動画（Step 2〜3 のカメラアプリの動画）と、その結果を消します。

```bash
cd ~/dev/image-recognition-handson
ls *.mp4 out*/ 2>/dev/null
```

一覧を見て、録画した動画（`camera.mp4`・`handup.mp4` など）と、その結果のフォルダ（`out_camera/`・`out_pose_handup/` など）を削除します。

```bash
rm camera.mp4 handup.mp4
rm -r out_camera out_pose_handup
```

Windows 側の「ピクチャ\カメラ ロール」に残っている元の録画も、エクスプローラーで削除します（ごみ箱も空にします）。

公開のサンプル動画（`sample.mp4`）と、その結果は残しておいても構いません。

### 5-2. ローカルのログイン情報を消す

Google Cloud をしばらく使わない場合は、WSL に保存したログイン情報を消します。

```bash
gcloud auth application-default revoke
gcloud auth revoke --all
```

また使うときは、Step 4 の 2-4 の手順で、もう一度ログインします。

### 5-3. プログラムは残しておく

プログラム（`video.py`・`analyze.py`・`run_job.py`・`api/` など）は、Git に記録してあるので、そのまま残しておいて構いません。プロジェクトを削除した場合は、`cloud-env.sh` の `PROJECT_ID` は使えなくなります。次に使うときは、新しいプロジェクト ID に書き換えます。

## 6. 料金を確かめる

Google Cloud の料金は、少し遅れて反映されます。**翌日以降**に、Google Cloud Console の「お支払い」→「レポート」を開き、次を確かめます。

- ハンズオンのプロジェクトの料金が、削除した日のあとに増えていない
- どのサービスにいくらかかったか（ハンズオン全体で、どこに費用がかかったかの振り返りにもなる）

予算アラートは、プロジェクトごと削除した場合は不要になります。B の場合は、そのまま残しておくと、使いすぎに気づけます。

## 7. うまくいかないとき

| 症状                                                                    | 原因と対処                                                                                            |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `gcloud projects delete` で権限が無いと言われる                         | プロジェクトのオーナーではない。オーナーに削除を頼むか、B のやり方で1つずつ削除する                   |
| バケットの削除で `403`                                                  | そのバケットの権限が無い、または名前が違う。`gcloud storage ls` で名前を確かめる                      |
| リポジトリの削除で `is not empty` などのエラー                          | 中のイメージが残っている。Google Cloud Console の「Artifact Registry」から、リポジトリごと削除する    |
| Firestore の削除で `delete protection`                                  | 削除の保護が有効になっている。Google Cloud Console の「Firestore」で保護を外してから削除する          |
| サービスアカウントの削除後も、`gcloud iam service-accounts list` に出る | 反映に少し時間がかかる。数分待ってから確かめる                                                        |
| 翌日以降も料金が増えている                                              | 削除し忘れたものがある。「お支払い」→「レポート」でサービスごとの料金を見て、どのサービスかを確かめる |

## 8. 完了条件

- [ ] VM（CPU・GPU）が残っていない
- [ ] A：プロジェクトを削除した（30日間の削除の予約の状態になった）
- [ ] B：第1章の表のものを、すべて削除した
- [ ] 自分や同僚を録画した動画と、その結果を、WSL と Windows の両方から削除した
- [ ] 翌日以降に、料金が増えていないことを確かめた

## 9. ハンズオンを終えて

ここまでで、次のことを一通り経験しました。

| Step      | 経験したこと                                                                                   |
| --------- | ---------------------------------------------------------------------------------------------- |
| Step 1〜3 | ローカルで、画像・動画から人物を検出・追跡し、数え、姿勢を推定し、精度を確かめる               |
| Step 4    | 結果をクラウドに安全に保存する（非公開のバケット、認証付きの API、必要な権限だけのアカウント） |
| Step 5    | Google の API と比べ、精度・費用・データの置き場所の違いを知る                                 |
| Step 6・7 | 同じ処理を Docker にまとめ、クラウドの VM（CPU・GPU）で動かして、速さと料金を比べる            |
| Step 8    | 作ったものを残さず片付ける                                                                     |

続けて学ぶ場合は、計画の第5章（発展：推奨ディレクトリ構成）と第6章（追加課題：顔認識による人物の特定）を参照します。
