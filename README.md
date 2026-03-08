# AIO Brand Monitor — セットアップガイド

Supabase Auth + Node.js (Vercel Serverless) + Vercel デプロイの手順書

---

## 📁 プロジェクト構成

```
aio-brand-monitor/
├── public/
│   └── index.html          # フロントエンド（Supabase JS SDK 統合済み）
├── api/
│   ├── client.js           # GET /api/client — 認証済みユーザーのデータを返す
│   └── health.js           # GET /api/health — 稼働確認
├── lib/
│   ├── supabaseAdmin.js    # Supabase サーバーサイドクライアント
│   └── data.js             # クライアントデータ（モックDB）
├── .env.example            # 環境変数テンプレート
├── .gitignore
├── package.json
├── vercel.json
└── README.md               # このファイル
```

---

## ① Supabase プロジェクトのセットアップ

### 1-1. Supabase プロジェクト作成

1. [supabase.com](https://supabase.com) にアクセス → 「Start your project」
2. GitHub アカウントでサインアップ（無料）
3. 「New Project」→ 組織を選択 → プロジェクト名（例: `aio-brand-monitor`）を入力
4. データベースパスワードを設定（控えておく） → リージョンは「Northeast Asia (Tokyo)」推奨
5. 「Create new project」→ 約1分で作成完了

### 1-2. Authentication を確認

Supabase はデフォルトで Authentication が有効です。

1. 左メニュー「Authentication」→「Providers」
2. 「Email」が有効になっていることを確認（デフォルトで ON）
3. 開発中は「Confirm email」を **OFF** にすると動作確認が簡単：
   - 「Authentication」→「Email Templates」→「Enable email confirmations」を無効化

### 1-3. テストユーザーを追加

1. 左メニュー「Authentication」→「Users」→「Add user」→「Create new user」
2. 以下の3ユーザーを登録：

| メールアドレス | パスワード |
|---|---|
| `marketing@kose.co.jp` | `demo1234` |
| `digital@fastretailing.com` | `demo1234` |
| `digital@ajinomoto.com` | `demo1234` |

> **注意**: 本番環境では推測されにくいパスワードに変更してください

### 1-4. API キーを取得

1. 左メニュー「Project Settings（⚙️）」→「API」
2. 以下の3つの値を控える：

| 項目 | 用途 |
|---|---|
| **Project URL** | `SUPABASE_URL` としてフロントエンド・バックエンド両方で使用 |
| **anon / public** | `SUPABASE_ANON_KEY` としてフロントエンドで使用（公開可） |
| **service_role / secret** | `SUPABASE_SERVICE_ROLE_KEY` としてバックエンドのみで使用（絶対公開NG） |

### 1-5. フロントエンドの設定値を更新

`public/index.html` の以下の箇所を書き換えてください：

```javascript
const SUPABASE_URL      = "https://YOUR_PROJECT_REF.supabase.co"; // ← Project URL
const SUPABASE_ANON_KEY = "eyJhbGci...";                          // ← anon/public キー
```

---

## ② ローカル開発環境のセットアップ

### 2-1. 依存パッケージをインストール

```bash
cd aio-brand-monitor
npm install
```

### 2-2. 環境変数ファイルを作成

```bash
cp .env.example .env.local
```

`.env.local` を編集して Supabase の値を設定：

```env
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2-3. ローカルサーバーを起動

```bash
npm run dev
```

ブラウザで `http://localhost:3000` を開いてログインを確認します。

---

## ③ Vercel へのデプロイ

### 3-1. GitHub にプッシュ（推奨）

```bash
git init
git add .
git commit -m "Initial commit: AIO Brand Monitor"
git remote add origin https://github.com/YOUR_USERNAME/aio-brand-monitor.git
git push -u origin main
```

### 3-2. Vercel ダッシュボードからデプロイ（推奨）

1. [vercel.com](https://vercel.com) にログイン → 「New Project」
2. GitHub リポジトリを選択 → 「Import」
3. 「Environment Variables」に以下を追加：

| キー | 値 |
|---|---|
| `SUPABASE_URL` | Supabase Project URL |
| `SUPABASE_ANON_KEY` | anon/public キー |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role/secret キー |

4. 「Deploy」をクリック → デプロイ完了 🎉

### 3-3. CLI からデプロイする場合

```bash
npm run deploy
```

---

## 🔑 APIエンドポイント

| メソッド | パス | 説明 |
|---|---|---|
| `GET` | `/api/client` | ログイン中ユーザーのクライアントデータを返す |
| `GET` | `/api/health` | サーバー稼働確認 |

### 認証方式

```
Authorization: Bearer {Supabase Access Token}
```

フロントエンドは `_supabase.auth.onAuthStateChange` で取得した `session.access_token` を送信します。

---

## 🗄️ クライアントデータの管理

現在 `lib/data.js` にモックデータが格納されています。
本番運用では **Supabase の PostgreSQL** に移行するのが最適です。

### Supabase PostgreSQL への移行手順（将来の拡張）

1. Supabase コンソール「Table Editor」で `clients` テーブルを作成
2. カラム: `id`, `email`, `name`, `score` など
3. `lib/supabaseAdmin.js` を使ってクエリ：

```javascript
// api/client.js の getClientByEmail を置き換えるイメージ
const { data, error } = await supabase
  .from("clients")
  .select("*")
  .eq("email", user.email)
  .single();
```

---

## 🏗️ 今後の拡張ロードマップ

| フェーズ | 内容 |
|---|---|
| Phase 2 | Supabase PostgreSQL でクライアントデータを管理 |
| Phase 3 | Supabase Realtime でダッシュボードをリアルタイム更新 |
| Phase 4 | 実際のAI検索データを取得するクローラーを構築 |
| Phase 5 | Stripe + Supabase で月額課金を実装 |

---

## 🆘 トラブルシューティング

**ログインできない場合**
- Supabase コンソール「Authentication → Users」でユーザーが登録されているか確認
- 「Email confirmed」が未確認の場合は、Authentication 設定で「Enable email confirmations」を OFF に

**APIが401を返す場合**
- `public/index.html` の `SUPABASE_URL` と `SUPABASE_ANON_KEY` が正しいか確認
- Vercel の環境変数に `SUPABASE_SERVICE_ROLE_KEY` が設定されているか確認

**APIが403を返す場合**
- `lib/data.js` にそのメールアドレスが登録されているか確認

**Vercel デプロイ後に動かない場合**
- Vercel ダッシュボード「Deployments」→「Functions」でログを確認
- 環境変数が全て設定されているか再確認
