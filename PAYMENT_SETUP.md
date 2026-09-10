# 微信支付 / 支付宝上线配置

当前项目已经完成充值订单、积分到账、生成扣费和失败退款的业务闭环。`mock` 支付用于本机测试；真实支付需要把支付平台的异步回调接到公网后台。

## 已有接口

- `POST /api/billing/orders`：创建充值订单。`provider` 可以是 `mock`、`wechat`、`alipay` 或 `alipay_personal`。
- `POST /api/billing/orders/:orderId/mock-pay`：仅用于开发测试，模拟支付成功。
- `POST /api/billing/webhook/wechat`：微信支付异步回调入口。
- `POST /api/billing/webhook/alipay`：支付宝异步回调入口。
- `GET /api/billing/orders`：查询当前用户订单。
- `GET /api/account/ledger`：查询积分流水。
- `POST /api/billing/orders/:orderId/submit-proof`：提交个人收款码付款备注，等待人工确认。

## 临时个人支付宝收款码

商业版现在可使用内置的个人支付宝收款码作为人工充值备用通道：用户创建充值订单后扫码付款，填写付款人昵称或付款时间并提交审核；管理员确认后，再通过管理流程确认订单到账。个人收款码没有可靠的订单回调，不能自动到账，也不能自动完成退款，因此只适合小范围测试，不能作为正式大规模商业支付方案。

## 上线前需要配置

把 `.env.example` 中的支付变量配置在公网后台服务器环境中，不要写入桌面客户端或提交到仓库：

- 微信：`WECHAT_APP_ID`、`WECHAT_MCH_ID`、`WECHAT_SERIAL_NO`、`WECHAT_API_V3_KEY`、`WECHAT_PRIVATE_KEY_PATH`、`WECHAT_NOTIFY_URL`。`WECHAT_NOTIFY_URL` 必须是公网 HTTPS 地址；商户私钥文件只放在后台服务器。`WECHAT_PLATFORM_CERT_PATH` 用于后续严格校验平台回调签名。
- 支付宝：`ALIPAY_APP_ID`、`ALIPAY_PRIVATE_KEY_PATH`、`ALIPAY_PUBLIC_KEY_PATH`。
- 回调保护：`PAYMENT_WEBHOOK_SECRET`。

微信 Native 下单接口为 `POST /api/billing/orders/:orderId/wechat/native`，返回 `codeUrl`，前端将它转换成二维码供用户扫码。回调入口为 `/api/billing/webhook/wechat`；服务端会解密 APIv3 回调并校验订单金额后再到账。客户端不能自行增加积分。生产环境还应在公网网关启用 HTTPS、限流和日志脱敏。

## 当前测试方式

1. 注册账户，获得体验积分。
2. 在账户面板点击充值套餐。
3. 当前版本使用模拟支付，充值成功后积分立即增加。
4. 生成成功扣除积分，模型失败会自动退款。

真实微信支付和支付宝支付不能在本机离线完成，需要公网 HTTPS 回调地址和对应商户权限。拿到商户配置后，再接入对应平台 SDK 并用沙箱或小额订单验证。
