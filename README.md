# Receipt-Archiver

領収書・レシートをブラウザ上で管理するための Vite + React アプリです。  
OCR、PDF 管理、スプレッドシート出力などの機能をローカル環境で利用できます。

## リポジトリを軽量化するための方針

このリポジトリでは、次のような**ローカルで再生成できるもの**は Git に含めません。

- `node_modules/` : `npm ci` または `npm install` 実行時に生成される依存パッケージ
- `dist/` : `npm run build` 実行時に生成されるビルド成果物

そのため、リポジトリを pull / clone した直後は、そのままでは起動できません。  
以下の手順でローカル環境を準備してください。

## 前提環境

- Node.js
- npm

`node` と `npm` が使える状態であることを確認してください。

## 初回セットアップ手順

### 1. リポジトリを取得する

```bash
git clone <repository-url>
cd Receipt-Archiver
```

すでに clone 済みの場合は、通常どおり `git pull` を実行してください。

### 2. 依存パッケージをインストールする

```bash
npm ci
```

このコマンドで `package-lock.json` をもとに `node_modules/` が再生成されます。  
通常は `npm install` でも動作しますが、依存関係を固定した状態で再現しやすいため、基本的には `npm ci` を推奨します。

## ローカルでアプリを有効化する方法

### 開発モードで起動する

```bash
npm run dev
```

実行後、表示されるローカル URL にブラウザでアクセスしてください。  
ソースコードを更新すると、Vite の開発サーバーで変更が反映されます。

### 本番用ビルドを作成する

```bash
npm run build
```

このコマンドで `dist/` が生成されます。  
`dist/` は成果物なので、必要なときだけローカルで生成し、Git には含めません。

### ビルド結果をローカルで確認する

```bash
npm run preview
```

ビルド済みの `dist/` をローカルサーバーで確認できます。  
先に `npm run build` を実行しておいてください。

### ビルドとプレビューをまとめて実行する

```bash
npm run app
```

`npm run build` の後にプレビューサーバーを起動します。

## pull 後に必要な作業

他の環境で `node_modules/` や `dist/` は共有されないため、最新コードを取得した後は必要に応じて次を実行してください。

### 依存関係の更新が含まれる場合

`package.json` または `package-lock.json` が更新されていたら、再度以下を実行してください。

```bash
npm ci
```

### 最新コードで開発を再開する場合

```bash
npm run dev
```

### 最新コードで本番ビルドを確認する場合

```bash
npm run build
npm run preview
```

## よくある認識違い

- `node_modules/` は **build 時ではなく依存インストール時** に生成されます
- `dist/` は **build 時** に生成されます
- `package.json` と `package-lock.json` は削除せず、依存関係を再現するために保持します

## まとめ

ローカルでこのアプリを使えるようにする最短手順は次のとおりです。

```bash
npm ci
npm run dev
```

本番用ビルドを確認したい場合は次の手順です。

```bash
npm ci
npm run build
npm run preview
```
