"use client";

/**
 * InlineEntityCreator — reusable inline creation popover (F7-S1).
 *
 * A small Dialog (popover) that lets the user create a new entity (category,
 * unit, customer, etc.) without leaving the current form. The new entity is
 * created via API + immediately passed back to the parent via onCreated.
 *
 * Usage:
 *   <InlineEntityCreator
 *     label="Category"
 *     endpoint="/api/categories"
 *     bodyBuilder={(name) => ({ name })}
 *     onCreated={(entity) => { ... select it in the dropdown ... }}
 *     trigger={<Button variant="outline" size="icon"><Plus className="h-4 w-4" /></Button>}
 *   />
 */
import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Entity = { id: string; name: string };

export function InlineEntityCreator({
  label,
  endpoint,
  bodyBuilder,
  onCreated,
  trigger,
  namePlaceholder = "e.g. Camera",
  extraFields,
}: {
  label: string; // "Category" | "Unit" | "Customer"
  endpoint: string; // "/api/categories" | "/api/units" | "/api/customers"
  bodyBuilder: (name: string, extra: Record<string, string>) => Record<string, unknown>;
  onCreated: (entity: Entity) => void;
  trigger?: React.ReactNode;
  namePlaceholder?: string;
  extraFields?: {
    key: string;
    label: string;
    placeholder?: string;
    required?: boolean;
  }[];
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: "Name required", description: `${label} name cannot be empty.`, variant: "destructive" });
      return;
    }
    // Check required extra fields.
    for (const f of extraFields ?? []) {
      if (f.required && !extra[f.key]?.trim()) {
        toast({ title: `${f.label} required`, variant: "destructive" });
        return;
      }
    }
    setCreating(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyBuilder(name.trim(), extra)),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Failed", description: data.error ?? `Could not create ${label.toLowerCase()}.`, variant: "destructive" });
        return;
      }
      // The response shape varies — extract the entity from common shapes.
      const entity: Entity = data.category ?? data.unit ?? data.customer ?? data;
      if (!entity?.id) {
        toast({ title: "Created", description: `${name} added.` });
      } else {
        onCreated(entity);
        toast({ title: `${label} created`, description: `${entity.name} added + selected.` });
      }
      setOpen(false);
      setName("");
      setExtra({});
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      {trigger ? (
        <span onClick={() => setOpen(true)}>{trigger}</span>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setOpen(true)}
          title={`Create new ${label.toLowerCase()} inline`}
        >
          <Plus className="h-4 w-4" />
        </Button>
      )}
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setName(""); setExtra({}); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New {label.toLowerCase()}</DialogTitle>
            <DialogDescription>Create a {label.toLowerCase()} without leaving this form. It&apos;s auto-selected when saved.</DialogDescription>
          </DialogHeader>
          <form onSubmit={onCreate} className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor={`ie-name-${label}`}>Name *</Label>
              <Input
                id={`ie-name-${label}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={namePlaceholder}
                autoFocus
              />
            </div>
            {extraFields?.map((f) => (
              <div key={f.key} className="space-y-1">
                <Label htmlFor={`ie-${f.key}`}>{f.label}{f.required ? " *" : ""}</Label>
                <Input
                  id={`ie-${f.key}`}
                  value={extra[f.key] ?? ""}
                  onChange={(e) => setExtra({ ...extra, [f.key]: e.target.value })}
                  placeholder={f.placeholder}
                />
              </div>
            ))}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={creating || !name.trim()}>
                {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Create {label.toLowerCase()}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
