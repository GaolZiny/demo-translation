# 🔒 Turnstile + Referer 安全配置指南

## ✅ 已实现的安全功能

您的应用现在有**三层安全保护**：

1. ✅ **Referer检查** - 只允许来自你域名的请求
2. ✅ **Cloudflare Turnstile** - 防止机器人滥用
3. ✅ **Rate Limiting** - IP限流 (10次/分钟)

---

## 🚀 配置步骤

### 步骤1: 获取Turnstile Site Key

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 选择你的账号
3. 进入 **Turnstile** 
4. 点击 **Add Site**

**配置信息:**
- **Site name**: `Translation App`
- **Domain**: `translation.demo.nebulainfinity.com`
- **Widget Mode**: `Managed`（推荐）或 `Non-Interactive`
- **Widget Type**: `Invisible`（无感）或 `Visible`（有验证框）

5. 创建后会得到:
   - **Site Key (公开)**: 例如 `0x4AAABBBCCCddEEE...`
   - **Secret Key (保密)**: 例如 `0x4BBB...`

---

### 步骤2: 更新前端配置

**在 `script.js` 中更新第12行:**

```javascript
turnstileSiteKey: '你的-Site-Key-这里'  // 替换测试key
```

例如:
```javascript
turnstileSiteKey: '0x4AAAAAAABBBCCCddEEEffGG123'
```

---

### 步骤3: 更新Worker配置

**在Cloudflare KV添加Secret Key:**

| Key | Value |
|-----|-------|
| `turnstile_secret_key` | `你的-Secret-Key` |

例如:
```
Key: turnstile_secret_key
Value: 0x4BBBxxxxxxxxyyyyyzzzz123456
```

---

### 步骤4: 重新部署

```bash
# 提交更改
git add script.js
git commit -m "feat: add Turnstile site key"
git push

# Worker会自动从KV读取secret key，无需重新部署
# Pages会自动从GitHub重新部署
```

---

## 🧪 测试验证

### 1. 测试Turnstile

1. 访问 https://translation.demo.nebulainfinity.com
2. 应该看到Turnstile验证组件（根据你选择的模式）
3. 输入日文文本并翻译
4. 检查浏览器控制台应该看到:
   ```
   Turnstile verification successful
   ```

### 2. 测试Referer保护

在浏览器控制台执行:
```javascript
// 这个请求会被拒绝（来自非授权域名）
fetch('https://translation-proxy.gaol-ziny.workers.dev/', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({'問い合わせ内容': 'test'})
}).then(r => r.json()).then(console.log)
```

应该返回:
```json
{
  "error": "Unauthorized origin",
  "message": "不正なアクセス元です。"
}
```

### 3. 测试Rate Limiting

在1分钟内连续点击翻译按钮超过10次，应该看到:
```
サービス混雑中です。時間をあけてからご利用ください。
```

---

## 🔐 安全检查清单

完成配置后，验证以下安全措施：

- [ ] ✅ Turnstile Site Key已更新（不是测试key）
- [ ] ✅ Secret Key已添加到Workers KV
- [ ] ✅ Turnstile widget在页面上正确显示
- [ ] ✅ 翻译功能正常工作
- [ ] ✅ Referer检查生效（直接curl调用会被拒绝）
- [ ] ✅ Rate limiting正常工作
- [ ] ✅ Worker日志中没有错误

---

## 📊 安全级别对比

### 之前（只有Rate Limiting）
```
攻击者 → Worker URL → Rate Limiting (10次/分钟/IP)
         ↓
        可以换IP继续攻击
```

**安全级别**: ⭐⭐⭐

### 现在（三层防护）
```
攻击者 → 1. Referer检查（必须从你的域名访问）
         ↓
         2. Turnstile验证（必须是真人）
         ↓
         3. Rate Limiting（IP限流）
         ↓
        几乎无法滥用！
```

**安全级别**: ⭐⭐⭐⭐⭐

---

## 🎯 Turnstile 模式对比

### Managed Mode（推荐）
- ✅ 大多数用户无感通过
- ✅ 可疑用户才需要验证
- ✅ 用户体验最佳

### Non-Interactive
- ✅ 完全无感
- ⚠️ 安全性稍低

### Invisible/Visible
- **Invisible**: 隐藏验证框
- **Visible**: 显示"I'm human"验证框

推荐使用: **Managed + Invisible**

---

## 💰 成本

Turnstile **完全免费**，无请求限制！

---

## 🐛 故障排除

### 问题1: Turnstile widget不显示

**检查:**
- 浏览器控制台是否有错误
- Site Key是否正确
- Turnstile脚本是否加载（检查Network标签）

**解决:**
```javascript
// 在控制台检查
console.log(typeof window.turnstile);  // 应该是 'object'
```

### 问题2: 验证总是失败

**检查:**
- Secret Key是否正确存储在KV
- Domain配置是否匹配
- Worker日志中的具体错误

### 问题3: 本地开发无法使用

**解决:**
在Turnstile Dashboard中，添加 `localhost` 到允许的域名列表

---

## 📝 配置文件速查

### script.js (第12行)
```javascript
turnstileSiteKey: '你的-Site-Key'
```

### Workers KV
```
Key: turnstile_secret_key
Value: 你的-Secret-Key
```

### Worker代码 (cloudflare-worker-with-ratelimit.js)
```javascript
// 第8-12行 - 允许的域名
const ALLOWED_ORIGINS = [
    'https://translation.demo.nebulainfinity.com',
    'http://localhost:8000',
    'http://127.0.0.1:8000'
];
```

---

## 🎉 完成！

配置完成后，你的翻译应用将拥有**企业级安全防护**！

**安全组合:**
- 🛡️ Referer检查 - 防止外部直接调用
- 🤖 Turnstile验证 - 防止机器人
- ⏱️ Rate Limiting - 防止滥用

完全免费，完全安全！🚀
