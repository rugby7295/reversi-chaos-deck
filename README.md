# REVERSI: CHAOS DECK v0.2 — Browser Edition

Chrome / Safari のブラウザからアクセスできるようにしたオンライン対戦版です。

## ローカルで起動

Node.js 20+ を用意して、フォルダで:

```bash
npm install
npm start
```

PCのChrome/Safariで `http://localhost:3000` を開きます。

スマホから同じWi‑Fi内で遊ぶ場合は、PCのローカルIPを使って `http://PCのIP:3000` を開きます。OSのファイアウォール設定が必要な場合があります。

## インターネット公開

このゲームはオンライン対戦にWebSocketを使うため、静的ホスティングだけではなくNode.jsサーバーを公開する必要があります。

RenderなどのNode/Docker対応ホスティングにこのフォルダをデプロイすると、HTTPS URLが発行され、Chrome/SafariからURLを開いて対戦できます。HTTPSの場合、ブラウザ側は自動的に `wss://` を使用します。

`render.yaml` と `Dockerfile` を同梱しています。

## 注意

現在はゲームサーバーのルーム情報をメモリに保持しています。サーバー再起動でルームは消えます。正式版では認証、永続化、切断復帰、マッチング、レート戦などを追加します。
