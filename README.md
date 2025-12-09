# 日中翻訳 - Japanese to Chinese Translation

AI駆動の日本語から中国語へのビジネス翻訳Webアプリケーション

## 概要

このWebアプリケーションは、n8nワークフロー「translation_jp_to_cn」を使用して、日本語のビジネス文書を中国語に翻訳します。

## 機能

- 📝 日本語テキストの入力
- 🔄 AIによる高品質な翻訳
- 📋 ワンクリックでコピー
- ⏱️ 60秒タイムアウト機能（混雑時の自動エラー表示）
- 🎨 美しく洗練されたUI
- 📱 レスポンシブデザイン
- ✨ スムーズなアニメーション
- 🌙 ダークモードテーマ
- 🔒 Cloudflare Workers対応（セキュアなデプロイメント）

## セットアップ

### 前提条件

- n8nサーバーが起動していること
- ワークフローID: `ULhlPzg7gBY7sWbD`

### n8n Webhook設定（重要！）

このアプリケーションはn8nのWebhookを使用します。以下の設定が**必須**です：

#### 1. Webhookの応答モードを設定

n8nワークフローエディタで：

1. **Webhook**ノードをクリック
2. **「Respond」**オプションを見つける
3. **「When Last Node Finishes」**を選択（デフォルトの「Immediately」ではなく）
4. ワークフローを保存

⚠️ **この設定をしないと、翻訳結果が返ってきません！**

#### 2. Webhook URLの確認

`script.js`の先頭にあるwebhook URLが正しいか確認してください：

```javascript
const CONFIG = {
    webhookUrl: 'http://192.168.18.119:5678/webhook/e097559a-eaad-4717-8985-8bfe51ff3365',
    fieldName: '問い合わせ内容'
};
```

### 使い方

1. Webブラウザで`index.html`を開く
2. テキストエリアに日本語の文章を入力
3. 「翻訳する」ボタンをクリック
4. 右側に中国語の翻訳結果が表示されます
5. 「コピー」ボタンで翻訳結果をクリップボードにコピーできます

## デプロイメントオプション

### オプション1: ローカル開発・テスト

ローカルで直接n8nに接続する場合（開発・テスト用）：

**Pythonの簡易サーバー:**
```bash
cd /path/to/translation
python3 -m http.server 8000
# ブラウザで http://localhost:8000 を開く
```

**Node.jsのhttp-server:**
```bash
npx http-server -p 8000
# ブラウザで http://localhost:8000 を開く
```

この場合、`script.js`のwebhook URLはローカルn8nを指します：
```javascript
webhookUrl: 'http://192.168.18.119:5678/webhook/xxx'
```

### オプション2: Cloudflare Pages + Workers（本番環境推奨）

🔒 **セキュアで本番環境に適した方法**

**メリット:**
- ✅ Webhook URLとTokenが隠蔽される
- ✅ 無料（個人使用の場合）
- ✅ グローバルCDN
- ✅ HTTPS自動対応
- ✅ Rate limiting対応

**手順:**
1. `CLOUDFLARE_DEPLOYMENT.md`の詳細ガイドを参照
2. Cloudflare Workerをデプロイ
3. Workers KVにn8nの認証情報を保存
4. Cloudflare Pagesに前端をデプロイ

**クイックスタート:**
```bash
# 1. Cloudflare Workerをデプロイ
# cloudflare-worker.js または cloudflare-worker-with-ratelimit.js を使用

# 2. script.jsのwebhook URLをWorkerのURLに変更
webhookUrl: 'https://translation-proxy.your-account.workers.dev'

# 3. GitHubにプッシュしてCloudflare Pagesで自動デプロイ
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/translation.git
git push -u origin main
```

詳細は `CLOUDFLARE_DEPLOYMENT.md` を参照してください。

## ファイル構成

```
translation/
├── index.html                              # メインHTMLファイル
├── style.css                               # スタイルシート（ダークテーマ、アニメーション）
├── script.js                               # JavaScript（n8n連携、状態管理）
├── cloudflare-worker-with-ratelimit.js     # Cloudflare Worker (Rate Limiting付き)
├── wrangler.toml                           # Cloudflare Wrangler設定
├── package.json                            # NPM設定
├── .gitignore                              # Git除外ファイル
├── README.md                               # メイン文档（日本語）
├── README.zh-CN.md                         # 中文版README
├── CLOUDFLARE_DEPLOYMENT.md                # Cloudflare詳細デプロイガイド
├── QUICK_DEPLOY.md                         # クイックデプロイガイド
└── LICENSE                                 # MIT License
```

## 技術スタック

- **HTML5** - セマンティックマークアップ
- **CSS3** - カスタムプロパティ、グリッドレイアウト、アニメーション
- **JavaScript (ES6+)** - Fetch API、非同期処理
- **Google Fonts** - Inter, Noto Sans JP, Noto Sans SC

## デザインの特徴

- **カラーパレット**: Indigo/Rose グラデーション
- **エフェクト**: グラスモーフィズム、グロー、ホバーアニメーション
- **レスポンシブ**: モバイル、タブレット、デスクトップ対応
- **アクセシビリティ**: セマンティックHTML、適切なコントラスト比

## トラブルシューティング

### 🔴 翻訳結果が表示されない（最も一般的な問題）

**症状**: 「翻訳する」ボタンを押しても、右側に結果が表示されない

**原因**: Webhookが「即座に応答」モードになっている

**解決方法**:
1. n8nでワークフローを開く
2. **Webhook**ノードをクリック
3. **「Respond」**設定を探す
4. **「When Last Node Finishes」**に変更（現在は「Immediately」になっているはず）
5. 保存してもう一度試す

### n8nサーバーに接続できない

- n8nサーバーが起動しているか確認
- `script.js`の`webhookUrl`が正しいか確認
- ネットワーク接続を確認

### エラーメッセージが表示される

ブラウザの開発者ツール（F12キー）を開いて：
1. **Console**タブを確認
2. 赤いエラーメッセージを探す
3. "Response data:"というログを探して、n8nからの応答を確認
4. "Response structure:"のログを確認して、レスポンスの形式を確認

### Webhookのテスト

テスト用webhook URLを使用してデバッグすることもできます：

```javascript
// script.jsで一時的にテストURLに変更
webhookUrl: 'http://192.168.18.119:5678/webhook-test/e097559a-eaad-4717-8985-8bfe51ff3365'
```

## ライセンス

MIT

## 作成者

Powered by n8n AI Translation Workflow
