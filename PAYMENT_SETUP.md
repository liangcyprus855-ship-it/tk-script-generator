# 微信支付 / 支付宝上线配置

当前项目已经完成充值订单、积分到账、生成扣费和失败退款的业务闭环。`mock` 支付用于本机测试；真实支付需要把支付平台的异步回调接到公网后台。

## 已有接口

- `POST /api/billing/orders`：创建充值订单。`provider` 可以是 `mock`、`wechat` 或 `alipay`。
- `POST /api/billing/orders/:orderId/mock-pay`：仅用于开发测试，模拟支付成功。
- `POST /api/billing/webhook/wechat`：微信支付异步回调入口。
- `POST /api/billing/webhook/alipay`：支付宝异步回调入口。
- `GET /api/billing/orders`：查询当前用户订单。
- `GET /api/account/ledger`：查询积分流水。

## 上线前需要配置

把 `.env.example` 中的支付变量配置在公网后台服务器环境中，不要写入桌面客户端或提交到仓库：

- 微信：`WECHAT_APP_ID`、`WECHAT_MCH_ID`、`WECHAT_SERIAL_NO`、`WECHAT_API_V3_KEY`、`WECHAT_PRIVATE_KEY_PATH`。
- 支付宝：`ALIPAY_APP_ID`、`ALIPAY_PRIVATE_KEY_PATH`、`ALIPAY_PUBLIC_KEY_PATH`。
- 回调保护：`PAYMENT_WEBHOOK_SECRET`。

真实支付适配器需要使用商户 SDK 生成支付参数，并在回调中校验平台签名、订单金额、商户号和订单状态；校验通过后才调用订单到账逻辑。客户端不能自行增加积分。

## 当前测试方式

1. 注册账户，获得体验积分。
2. 在账户面板点击充值套餐。
3. 当前版本使用模拟支付，充值成功后积分立即增加。
4. 生成成功扣除积分，模型失败会自动退款。

真实微信支付和支付宝支付不能在本机离线完成，需要公网 HTTPS 回调地址和对应商户权限。拿到商户配置后，再接入对应平台 SDK 并用沙箱或小额订单验证。
