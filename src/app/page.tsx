import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Package } from "lucide-react";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <main className="flex flex-col items-center justify-center gap-8 px-4">
        <h1 className="text-5xl font-bold tracking-tight">Bublinka ERP</h1>
        <Link href="/inventory">
          <Button size="lg" className="h-20 w-64 text-lg">
            <Package className="h-6 w-6 mr-2" />
            Otevřít Sklad
          </Button>
        </Link>
      </main>
    </div>
  );
}
