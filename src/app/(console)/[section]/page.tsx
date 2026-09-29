import { notFound } from "next/navigation";
import { navigation } from "@/lib/catalog";
import { currentActor } from "@/server/auth";
import { gatewayConfigured } from "@/server/gateway";
import { inspectProviders } from "@/server/providers";
import ConsoleView from "@/components/ConsoleView";
export default async function SectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const item = navigation.find((item) => item.id === section);
  if (!item) notFound();
  const actor = await currentActor();
  if (!actor) return null;
  return (
    <ConsoleView
      key={item.id}
      section={item.id}
      actor={actor}
      configured={gatewayConfigured()}
      providers={
        section === "infrastructure" || section === "dashboard"
          ? await inspectProviders()
          : []
      }
    />
  );
}
