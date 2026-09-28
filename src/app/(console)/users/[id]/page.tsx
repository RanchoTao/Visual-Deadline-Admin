import { currentActor } from "@/server/auth";
import { gatewayConfigured } from "@/server/gateway";
import { safeId } from "@/lib/security";
import { notFound } from "next/navigation";
import ConsoleView from "@/components/ConsoleView";
export default async function UserDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!safeId(id)) notFound();
  const actor = await currentActor();
  if (!actor) return null;
  return (
    <ConsoleView
      key={id}
      section="users"
      detailId={id}
      actor={actor}
      configured={gatewayConfigured()}
      providers={[]}
    />
  );
}
