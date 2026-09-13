"use client";

/**
 * ModuleComingSoon — placeholder for module routes that land in later sessions.
 * Shows the phase/session the module is scheduled for + back-to-home CTA.
 */
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { ArrowLeft, type LucideIcon } from "lucide-react";

export function ModuleComingSoon({
  title,
  icon: Icon,
  session,
  description,
}: {
  title: string;
  icon: LucideIcon;
  session: string;
  description?: string;
}) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      <Card>
        <CardContent className="py-8">
          <EmptyState
            icon={Icon}
            title={`${title} arrives in ${session}`}
            description={
              description ??
              "This module is part of the phased build plan. It will be fully functional once its session is complete."
            }
            action={
              <Button asChild variant="outline" size="sm">
                <Link href="/">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back to dashboard
                </Link>
              </Button>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
