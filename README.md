# AIO Brand Monitor

AI検索エンジン（ChatGPT / Perplexity / Google AI Overview / Gemini）でのブランド露出をリアルタイムで計測・管理するSaaSダッシュボード。

**Tech Stack:** Vercel Serverless Functions + Supabase (PostgreSQL + Auth) + Resend (メール)

---

## 📁 プロジェクト構成

```
aio-brand-monitor/
├── public/
│   └── index.html                  # フロントエンド（Single Page App）
├── api/
│   ├── client.js                   # GET  /api/client         — ログイン中ユーザーのデータ取得
│   ├── config.js                   # GET  /api/config         — Supabase公開設定を返す
│   ├── health.js                   # GET  /api/health         — 稼働確認
│   ├── keywords.js                 # GET/POST /api/keywords   — キーワード管理
│   ├── measure.js                  # POST /api/measure        — リアルタイムAIスコア計測
│   ├── profile.js                  # POST /api/profile        — プロフィール更新
│   ├── report.js                   # GET  /api/report         — 月次HTMLレポート生成
│   ├── settings.js                 # GET/POST /api/settings   — 通知・アラート設定
│   ├── admin/
│   │   ├── auth.js                 # POST /api/admin/auth     — 管理者ログイン
│   │   ├── clients.js              # CRUD /api/admin/clients  — クライアント管理
│   │   ├── invite.js               # POST /api/admin/invite   — 招待メール送信
│   │   ├── measure.js              # POST /api/admin/measure  — 手動計測（SSE）
│   │   └── update-influencers.js   # POST — インフルエンサーデータ更新
│   └── cron/
│       ├── daily-scores.js         # 毎日22:00 JST — 日次計測＋アラート
│       └── weekly-scores.js        # 毎週日曜22:00 JST — 全エンジン計測＋レポートメール
├── lib/
│   ├── aiMeasurement.js            # AI検索エンジン計測ロジック
│   ├── emailReport.js              # メール生成＋Resend送信
│   ├── gscClient.js                # Google Search Console連携
│   └── supabaseAdmin.js            # Supabase Admin Client
├── supabase-migrations.sql         # ← Supabase SQL Editor で実行するDDL
├── supabase-add-bitstar-client.sql # 初期データ投入SQL
├── vercel.json
└── package.json
```

---

## ① 初回セットアップ

### 1-1. Supabase プロジェクト作成

1. [supabase.com](https://supabase.com) → 「New Project」
2. リージョン: **Northeast Asia (Tokyo)** 推奨
3. Authentication → Email Providers → Email が有効であることを確認
4. 開発中は「Confirm email」を **OFF** に設定

### 1-2. DBマイグレーションを実行

Supabase Dashboard → **SQL Editor** で `supabase-migrations.sql` を実行してください。

> これにより以下が作成・追加されます：
> - `clients` テーブルへの `settings` / `score_alert` 等のカラム追加
> - `ai_scores` テーブル（スコア履歴）の作成
> - Row Level Security (RLS) ポリシーの設定

### 1-3. 初期クライアントデータを登録

`supabase-add-bitstar-client.sql` を SQL Editor で実行してください。

---

## ② 環境変数の設定

Vercel Dashboard → Settings → Environment Variables に以下を追加：

| 変数名 | 必須 | 説明 |
|--------|------|------|
| `SUPABASE_URL` | ✅ | Supabase Project URL |
| `SUPABASE_ANON_KEY` | ✅ | Supabase anon/public キー |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | service_role キー（サーバーのみ） |
| `OPENAI_API_KEY` | ✅ | ChatGPT計測用 |
| `PERPLEXITY_API_KEY` | ✅ | Perplexity計測用 |
| `GOOGLE_AI_API_KEY` | ✅ | Google AI Overview計測用 |
| `GEMINI_API_KEY` | ✅ | Gemini計測用 |
| `RESEND_API_KEY` | ✅ | メール送信用 |
| `ADMIN_EMAILS` | ✅ | 管理者メール（カンマ区切り）例: `admin@company.com` |
| `CRON_SECRET` | ✅ | Vercel Cron認証シークレット |
| `APP_URL` | ✅ | デプロイURL 例: `https://your-app.vercel.app` |
| `REPORT_FROM_EMAIL` | ⬜ | 送信元メール（デフォルト: `noreply@bitstar.tokyo`） |
| `ANTHROPIC_API_KEY` | ⬜ | Claude計測用（オプション） |
| `GSC_SERVICE_ACCOUNT` | ⬜ | Google Search Console連携用 |

---

## ③ デプロイ

```bash
git push origin main   # GitHub連携で自動デプロイ（推奨）
```

---

## ④ 機能一覧

### クライアント向け
- AIOスコア・KPI・トレンド・エンジン別スコアのダッシュボード
- 競合他社とのスコア比較（競合ランキング）
- キーワード別AI露出率の管理（最大20件）
- 月次HTMLレポート（ブラウザ印刷→PDF保存）
- プロフィール設定（表示名・役職・アバターカラー）
- 通知・アラート設定（閾値5〜30pt・メール通知オン/オフ）
- パスワードリセット（メールリンクから新パスワード設定）

### 管理者向け（ADMIN_EMAILS ユーザーのみ）
- クライアント一覧・作成・編集（基本情報・競合設定タブ）
- **手動計測トリガー** — 任意クライアントのAIスコアを今すぐ計測（リアルタイム進捗表示）
- 招待メール / パスワードリセットメール送信
- 統計サマリー（総クライアント数・平均スコア・アラート数・60pt以上）
- CSVエクスポート（Excel対応BOM付き）
- 管理者として任意クライアントのダッシュボードを表示

### 自動化（Vercel Cron）
- **日次** (毎日22:00 JST) — ChatGPT+Perplexityで急変検知→アラートメール
- **週次** (毎週日曜22:00 JST) — 全4エンジン計測→週次レポートメール送信

---

## ⑤ AIOスコア計算方式

| エンジン | ウェイト | API |
|----------|----------|-----|
| ChatGPT | 35% | OpenAI API |
| Perplexity | 35% | Perplexity API |
| Google AI Overview | 15% | Google Generative AI API |
| Gemini | 15% | Gemini API |

各エンジンで業界クエリを10問送り、ブランド名が何問に登場したかを0〜100ptで表現。

---

## ⑥ セキュリティ設計

- 全エンドポイントでSupabase Auth JWTによる認証
- 管理者判定は `ADMIN_EMAILS` 環境変数で制御（ハードコードなし）
- Row Level Security (RLS) でクライアントは自分のデータのみアクセス可
- service_role キーはサーバーサイドのみ使用
- Supabase公開設定は `/api/config` 経由で配信（フロントエンドへのハードコードなし）
