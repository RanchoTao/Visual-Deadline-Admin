export type ProviderStatus = {
  name: string;
  status: "pending" | "available" | "unavailable";
  label: string;
  detail: string;
};
export interface ProviderAdapter {
  name: string;
  inspect(): Promise<ProviderStatus>;
}
export function pendingProvider(name: string, detail: string): ProviderAdapter {
  return {
    name,
    async inspect() {
      return { name, status: "pending", label: "尚未接入", detail };
    },
  };
}
export async function inspectProviders(
  adapters: ProviderAdapter[],
): Promise<ProviderStatus[]> {
  return Promise.all(
    adapters.map(async (adapter) => {
      try {
        return await adapter.inspect();
      } catch {
        return {
          name: adapter.name,
          status: "unavailable" as const,
          label: "暂时不可用",
          detail: "适配器请求失败，其他服务不受影响。",
        };
      }
    }),
  );
}
