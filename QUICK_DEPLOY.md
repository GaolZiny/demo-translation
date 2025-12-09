# 快速部署指南 - Quick Deployment Guide

本指南帮助你在5分钟内将应用部署到Cloudflare。

## 前提条件

- [ ] Cloudflare账号（免费）
- [ ] GitHub账号（免费）
- [ ] 本地n8n安装并运行
- [ ] n8n webhook已配置为"When Last Node Finishes"模式

## 步骤1: 准备n8n

### 1.1 配置Webhook响应模式

在n8n工作流编辑器：
1. 打开 `translation_jp_to_cn` 工作流
2. 点击 **Webhook** 节点
3. 设置 **Respond** → **When Last Node Finishes**
4. 保存工作流

### 1.2 添加认证（推荐）

在Webhook节点：
1. **Authentication** → **Header Auth**
2. **Name**: `Authorization`
3. **Value**: `Bearer your-secret-token-123456`
4. 保存（记住这个token，后面会用到）

### 1.3 暴露n8n到公网

**选项A: Cloudflare Tunnel（推荐，免费且安全）**

```bash
# 安装cloudflared
brew install cloudflare/cloudflare/cloudflared

# 登录
cloudflared tunnel login

# 创建tunnel
cloudflared tunnel create n8n-tunnel

# 配置tunnel
cloudflared tunnel route dns n8n-tunnel n8n.yourdomain.com

# 运行tunnel
cloudflared tunnel run n8n-tunnel --url http://localhost:5678
```

配置文件 `~/.cloudflared/config.yml`:
```yaml
tunnel: n8n-tunnel
credentials-file: /path/to/credentials.json

ingress:
  - hostname: n8n.yourdomain.com
    service: http://localhost:5678
  - service: http_status:404
```

**选项B: Ngrok（简单但临时）**

```bash
ngrok http 5678
# 会得到一个临时URL: https://abc123.ngrok.io
```

**选项C: 路由器端口映射**
- 在路由器设置中映射端口5678
- 使用公网IP访问

## 步骤2: 部署Cloudflare Worker

### 2.1 创建Workers KV

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 进入 **Workers & Pages** → **KV**
3. 点击 **Create namespace**
4. 命名: `TRANSLATION_KV`
5. 创建

### 2.2 添加KV数据

在 `TRANSLATION_KV` 命名空间中点击 **Add entry**:

**第1条:**
- Key: `n8n_webhook_url`
- Value: `https://n8n.yourdomain.com/webhook/e097559a-eaad-4717-8985-8bfe51ff3365`
  (或者你的ngrok URL/公网IP)

**第2条:**
- Key: `n8n_auth_token`
- Value: `your-secret-token-123456`
  (和步骤1.2中设置的token一致)

### 2.3 创建Worker

**方式1: 通过Dashboard（推荐初学者）**

1. **Workers & Pages** → **Create application** → **Create Worker**
2. 命名: `translation-proxy`
3. 点击 **Deploy**
4. 部署后点击 **Edit code**
5. 复制 `cloudflare-worker-with-ratelimit.js` 的全部内容
6. 粘贴到编辑器
7. 点击 **Save and Deploy**

**方式2: 通过Wrangler CLI（推荐高级用户）**

```bash
# 安装wrangler
npm install -g wrangler

# 登录Cloudflare
wrangler login

# 编辑wrangler.toml，填入你的account_id和KV namespace ID

# 部署
wrangler deploy
```

### 2.4 绑定KV到Worker

1. 在Worker页面，进入 **Settings** → **Variables**
2. **KV Namespace Bindings** → **Add binding**
3. Variable name: `TRANSLATION_KV`
4. KV namespace: 选择 `TRANSLATION_KV`
5. 保存

### 2.5 获取Worker URL

部署成功后，你会得到：
```
https://translation-proxy.your-account.workers.dev
```

记住这个URL！

## 步骤3: 部署前端到Cloudflare Pages

### 3.1 更新前端配置

编辑 `script.js`，修改第4行：

```javascript
webhookUrl: 'https://translation-proxy.your-account.workers.dev',
```

### 3.2 推送到GitHub

```bash
cd /path/to/translation

# 初始化git
git init

# 添加文件
git add .

# 提交
git commit -m "Initial deployment"

# 创建GitHub仓库后推送
git remote add origin https://github.com/yourusername/translation.git
git push -u origin main
```

### 3.3 连接Cloudflare Pages

1. **Workers & Pages** → **Create application** → **Pages**
2. 选择 **Connect to Git**
3. 连接GitHub账号
4. 选择 `translation` 仓库
5. 配置构建：
   - **Build command**: (留空)
   - **Build output directory**: `/`
6. 点击 **Save and Deploy**

### 3.4 获取Pages URL

部署完成后，你会得到：
```
https://translation.pages.dev
```

或者绑定自定义域名。

## 步骤4: 测试

1. 访问你的Pages URL
2. 输入日文测试文本，例如：
   ```
   お世話になっております。
   この度は貴社の製品についてお問い合わせさせていただきます。
   ```
3. 点击「翻訳する」
4. 等待翻译结果（可能需要10-30秒）
5. 检查是否正确显示中文翻译

## 步骤5: 安全性检查

### 5.1 验证Token隐藏

1. 在浏览器中打开 **开发者工具** (F12)
2. 进入 **Network** 标签
3. 点击翻译按钮
4. 查看请求：
   - ✅ 只应该看到对Worker的请求
   - ✅ **不应该**看到Authorization header
   - ✅ **不应该**看到n8n的真实URL

### 5.2 验证Rate Limiting

在1分钟内快速点击翻译按钮超过10次，应该看到：
```
サービス混雑中です。時間をあけてからご利用ください。
```

### 5.3 限制CORS（生产环境）

编辑Worker代码，将第6行改为：

```javascript
'Access-Control-Allow-Origin': 'https://translation.pages.dev',
```

这样只有你的域名可以调用Worker。

## 故障排除

### 问题: Worker返回500错误

**解决:**
1. 检查KV是否正确绑定到Worker
2. 检查KV中的`n8n_webhook_url`是否正确
3. 查看Worker日志（Dashboard → Worker → Logs）

### 问题: 超时错误

**解决:**
1. 检查n8n是否可以从公网访问
2. 测试webhook URL: `curl -X POST https://your-n8n-url/webhook/xxx`
3. 检查n8n的Webhook节点是否是"When Last Node Finishes"模式

### 问题: 认证失败

**解决:**
1. 检查KV中的`n8n_auth_token`和n8n中的Header Auth值是否一致
2. 确认n8n的Authentication设置正确

## 成本

使用Cloudflare免费套餐：
- Workers: 100,000 请求/天 ✅ 免费
- Pages: 500 构建/月 ✅ 免费  
- KV: 100,000 读取/天 ✅ 免费

**总计: $0/月** 🎉

## 下一步

- [ ] 绑定自定义域名
- [ ] 添加Google Analytics
- [ ] 优化SEO
- [ ] 添加更多语言支持
- [ ] 添加使用统计

## 支持

遇到问题？查看：
- `CLOUDFLARE_DEPLOYMENT.md` - 详细部署指南
- `WEBHOOK_CONFIG.md` - Webhook配置问题
- `README.md` - 完整文档

---

恭喜！你的翻译应用现在已经安全地部署到全球CDN了！🎉
