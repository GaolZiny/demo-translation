# Cloudflare部署方案

## 架构设计

```
┌─────────────┐      HTTPS       ┌──────────────────┐      HTTP/HTTPS    ┌─────────────┐
│  用户浏览器   │  ───────────────► │ Cloudflare Worker│ ──────────────────► │  本地n8n     │
│  (公网)      │                   │   + Workers KV   │                     │  (内网)      │
└─────────────┘                   └──────────────────┘                     └─────────────┘
                                         ▲
                                         │
                                  Token存储在KV中
                                  前端完全看不到
```

## 为什么这个方案安全？

### ✅ 优点

1. **Token不暴露给前端**
   - Token存储在Workers KV（服务器端）
   - 前端JavaScript完全看不到
   - 浏览器Network面板也看不到

2. **Webhook URL不暴露**
   - n8n的真实URL存储在KV中
   - 前端只知道Worker的URL

3. **可以添加额外的安全层**
   - Rate limiting（限流）
   - IP白名单
   - 请求验证
   - 日志记录

4. **HTTPS加密**
   - Cloudflare自动提供SSL
   - 前端到Worker的通信加密

### ⚠️ 注意事项

1. **n8n需要公网访问**
   - Worker需要能访问到你的本地n8n
   - 需要：
     - 公网IP + 端口映射，或
     - Cloudflare Tunnel，或
     - Ngrok等内网穿透工具

2. **CORS配置**
   - Worker代码中已包含CORS头
   - 生产环境应该限制`Access-Control-Allow-Origin`到你的域名

3. **成本**
   - Cloudflare Workers免费套餐：
     - 每天100,000次请求
     - 足够个人使用

## 部署步骤

### 1. 创建Workers KV

在Cloudflare Dashboard:
1. 进入 **Workers & Pages** > **KV**
2. 点击 **Create namespace**
3. 命名为 `TRANSLATION_KV`
4. 创建完成

### 2. 添加KV数据

在KV命名空间中添加以下键值对：

| Key | Value | 说明 |
|-----|-------|------|
| `n8n_webhook_url` | `http://your-public-ip:5678/webhook/e097559a-eaad-4717-8985-8bfe51ff3365` | n8n webhook的完整URL |
| `n8n_auth_token` | `your-secret-token-here` | 你在n8n中设置的认证token |

### 3. 创建Worker

1. 进入 **Workers & Pages** > **Create application**
2. 选择 **Create Worker**
3. 命名为 `translation-proxy`
4. 点击 **Deploy**
5. 部署后，点击 **Edit code**
6. 将 `cloudflare-worker.js` 的内容粘贴进去
7. 点击 **Save and Deploy**

### 4. 绑定KV到Worker

1. 在Worker设置页面
2. 进入 **Settings** > **Variables**
3. 在 **KV Namespace Bindings** 部分
4. 点击 **Add binding**
5. Variable name: `TRANSLATION_KV`
6. KV namespace: 选择你刚创建的 `TRANSLATION_KV`
7. 保存

### 5. 获取Worker URL

部署完成后，你会得到一个URL，例如：
```
https://translation-proxy.your-account.workers.dev
```

### 6. 更新前端代码

修改 `script.js` 中的webhook URL：

```javascript
const CONFIG = {
    // 改为Worker的URL
    webhookUrl: 'https://translation-proxy.your-account.workers.dev',
    fieldName: '問い合わせ内容',
    timeout: 60000
};
```

### 7. 部署前端到Cloudflare Pages

1. 创建GitHub仓库
2. 推送代码
3. 在Cloudflare Dashboard创建Pages项目
4. 连接GitHub仓库
5. 部署设置：
   - Build command: (留空，是静态HTML)
   - Build output directory: `/`
6. 部署

## n8n Webhook配置

在n8n的Webhook节点中添加Header Authentication:

1. 打开Webhook节点
2. 在 **Authentication** 部分选择 **Header Auth**
3. Name: `Authorization`
4. Value: `Bearer your-secret-token-here`

或者使用自定义header:
- Name: `X-Auth-Token`
- Value: `your-secret-token-here`

## 安全性评估

### 这个方案的安全级别：⭐⭐⭐⭐☆ (4/5)

#### 保护了什么：
- ✅ Token不会暴露给用户
- ✅ Webhook URL不会暴露给用户
- ✅ 通信使用HTTPS加密
- ✅ 可以添加rate limiting

#### 潜在风险：
- ⚠️ Worker URL是公开的，任何人都可以调用
- ⚠️ 如果有人发现你的Worker URL，可以发送大量请求

#### 进一步加固方案：

**方案A: 添加简单的前端验证**
```javascript
// 在Worker中添加一个简单的"握手"机制
if (!body.clientKey || body.clientKey !== await env.TRANSLATION_KV.get('client_key')) {
  return new Response('Unauthorized', { status: 401 });
}
```

**方案B: 使用Cloudflare Access**
- 添加Cloudflare Access保护
- 需要用户登录才能访问页面

**方案C: Rate Limiting**
```javascript
// 在Worker中限制同一IP的请求频率
const ip = request.headers.get('CF-Connecting-IP');
// 实现rate limiting逻辑
```

## 成本估算

- **Cloudflare Workers**: 免费（100,000请求/天）
- **Cloudflare Pages**: 免费（500次构建/月）
- **Workers KV**: 免费（100,000次读取/天）
- **总计**: **$0/月** （个人使用）

## 替代方案

如果你觉得暴露n8n到公网不安全，可以考虑：

1. **Cloudflare Tunnel** (推荐)
   - 不需要公网IP
   - 不需要端口映射
   - 更安全
   - 完全免费

2. **使用n8n Cloud**
   - n8n官方托管
   - 自带HTTPS和认证
   - 每月$20起

3. **部署到VPS**
   - 将整个应用部署到云服务器
   - 不需要暴露家里的网络

## 测试清单

部署完成后，测试以下内容：

- [ ] Worker URL可以访问
- [ ] 前端可以调用Worker
- [ ] Worker可以调用n8n
- [ ] n8n返回翻译结果
- [ ] 前端正确显示结果
- [ ] 检查浏览器Network面板，确认看不到token
- [ ] 检查页面源代码，确认看不到n8n URL
- [ ] 测试超时机制（暂停n8n，检查是否1分钟后超时）

## 总结

这个方案是**可行且相对安全**的。主要优势是：
- Token完全隐藏
- 简单易部署
- 完全免费
- 性能良好（Cloudflare全球CDN）

建议在生产环境中：
1. 限制CORS到你的域名
2. 添加rate limiting
3. 监控Worker日志
4. 考虑使用Cloudflare Tunnel而不是直接暴露n8n
