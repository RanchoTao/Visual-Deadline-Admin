import "server-only";
import {
  pendingProvider as pending,
  inspectProviders as inspect,
  type ProviderAdapter,
  type ProviderStatus,
} from "./provider-core";
export type { ProviderStatus } from "./provider-core";
export const providerAdapters: ProviderAdapter[] = [
  pending("GitHub", "main SHA、提交、PR、Issue 与发布信息待接入只读适配器。"),
  pending("Vercel", "生产部署、提交 SHA 与部署健康待接入只读适配器。"),
  pending(
    "Supabase",
    "身份验证已支持；数据库身份、连接和版本健康等待 VD 管理契约。",
  ),
  pending("Paddle", "仅 Sandbox；订阅与交易等待 VD 账本投影，不直接修改订阅。"),
  pending(
    "Resend",
    "中文模板与本地预览已就绪；投递、退信和投诉等待可审计发送契约。",
  ),
  pending("DeepSeek", "只读取 VD AI 用量账本，尚未接入。"),
];
export async function inspectProviders(
  adapters: ProviderAdapter[] = providerAdapters,
): Promise<ProviderStatus[]> {
  return inspect(adapters);
}
