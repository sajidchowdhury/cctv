"use client";

/**
 * EntityPicker — searchable pick + inline create modal (replaces InlineEntityCreator
 * for category/unit on product forms).
 *
 * Flow (no page refresh at any step):
 *   1. User clicks the + button → opens a Picker modal showing:
 *      - Search input (filters the list by name, case-insensitive)
 *      - Up to 10 recent items (scrollable)
 *      - "Add new" button at the bottom
 *   2. User searches → list filters live
 *   3. User clicks an item → modal closes, onSelect(entity) fires
 *   4. User clicks "Add new" → picker closes, Create modal opens:
 *      - Name input with duplicate check (warns if name exists)
 *      - Save button (disabled on duplicate or empty)
 *      - On save → creates via API, onCreated(entity) fires, modal closes
 *
 * The parent passes the items list (already fetched) + callbacks. No extra
 * API call needed for the picker view — only the Create step hits the API.
 */
import { useState, useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Plus, Search, Check, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Entity = { id: string; name: string };

export function EntityPicker({
  label,
  items,
  createEndpoint,
  createBodyBuilder,
  onSelect,
  onCreated,
  trigger,
  namePlaceholder = "e.g. Camera",
}: {
  label: string; // "Category" | "Unit"
  items: Entity[]; // already fetched by parent
  createEndpoint: string; // "/cctv/api/categories"
  createBodyBuilder: (name: string) => Record<string, unknown>;
  onSelect: (entity: Entity) => void;
  onCreated: (entity: Entity) => void;
  trigger?: React.ReactNode;
  namePlaceholder?: string;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  // Filtered list (case-insensitive). Show up to 50 when searching, 10 recent when not.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? items.filter((e) => e.name.toLowerCase().includes(q))
      : items.slice(-10).reverse(); // last 10 = most recent (API returns asc by name)
    return q ? list.slice(0, 50) : list;
  }, [items, search]);

  // Duplicate check for the create modal (case-insensitive exact match).
  const duplicate = useMemo(() => {
    const q = newName.trim().toLowerCase();
    return q ? items.some((e) => e.name.toLowerCase() === q) : false;
  }, [items, newName]);

  function handleSelect(entity: Entity) {
    onSelect(entity);
    setPickerOpen(false);
    setSearch("");
  }

  function openCreate() {
    setPickerOpen(false);
    setSearch("");
    setCreateOpen(true);
  }

  async function handleCreate() {
    const name = newName.trim();
    if (!name) {
      toast({ title: "Name required", description: `${label} name cannot be empty.`, variant: "destructive" });
      return;
    }
    if (duplicate) {
      toast({ title: "Already exists", description: `${name} is already in your ${label.toLowerCase()} list.`, variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(createEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createBodyBuilder(name)),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Failed", description: data.error ?? `Could not create ${label.toLowerCase()}.`, variant: "destructive" });
        return;
      }
      // Extract entity from common response shapes.
      const entity: Entity = data.category ?? data.unit ?? data.customer ?? data;
      onCreated(entity);
      toast({ title: `${label} created`, description: `${entity.name} added + selected.` });
      setCreateOpen(false);
      setNewName("");
    } finally {
      setCreating(false);
    }
  }

  const defaultTrigger = (
    <Button
      type="button"
      variant="outline"
      size="icon"
      title={`Pick or create ${label.toLowerCase()}`}
    >
      <Plus className="h-4 w-4" />
    </Button>
  );

  return (
    <>
      <span onClick={() => setPickerOpen(true)}>{trigger ?? defaultTrigger}</span>

      {/* Picker modal — search + select + add new */}
      <Dialog open={pickerOpen} onOpenChange={(o) => { setPickerOpen(o); if (!o) setSearch(""); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select {label.toLowerCase()}</DialogTitle>
            <DialogDescription>
              Search or pick from the list. Click + to create a new one.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${label.toLowerCase()}…`}
                className="pl-9"
                autoFocus
              />
            </div>
            {/* List */}
            <ScrollArea className="h-64 rounded-md border">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-8 text-center text-sm text-muted-foreground">
                  {search ? (
                    <>
                      <p>No {label.toLowerCase()} matches &ldquo;{search}&rdquo;.</p>
                      <Button type="button" variant="outline" size="sm" className="mt-3" onClick={openCreate}>
                        <Plus className="mr-2 h-4 w-4" /> Create &ldquo;{search}&rdquo;
                      </Button>
                    </>
                  ) : (
                    <>
                      <p>No {label.toLowerCase()} yet.</p>
                      <Button type="button" variant="outline" size="sm" className="mt-3" onClick={openCreate}>
                        <Plus className="mr-2 h-4 w-4" /> Create your first {label.toLowerCase()}
                      </Button>
                    </>
                  )}
                </div>
              ) : (
                <ul className="divide-y">
                  {filtered.map((entity) => (
                    <li key={entity.id}>
                      <button
                        type="button"
                        onClick={() => handleSelect(entity)}
                        className="flex items-center justify-between w-full px-3 py-2.5 text-left text-sm hover:bg-accent transition-colors min-h-[44px]"
                      >
                        <span className="flex-1 truncate">{entity.name}</span>
                        <Check className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
            {/* Add new */}
            <Button type="button" variant="outline" className="w-full" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> Add new {label.toLowerCase()}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create modal — name input + duplicate check + save */}
      <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) setNewName(""); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New {label.toLowerCase()}</DialogTitle>
            <DialogDescription>
              Create a {label.toLowerCase()} without leaving this form. It&apos;s auto-selected when saved.
            </DialogDescription>
          </DialogHeader>
          {/* Use a div (not form) to prevent any form submission from
              bubbling up to a parent form and causing a page refresh. */}
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor={`ep-name-${label}`}>Name *</Label>
              <Input
                id={`ep-name-${label}`}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={namePlaceholder}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !creating && !duplicate && newName.trim()) {
                    e.preventDefault();
                    handleCreate();
                  }
                }}
              />
              {duplicate && (
                <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3" />
                  A {label.toLowerCase()} named &ldquo;{newName.trim()}&rdquo; already exists. Pick it from the list instead.
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button
                type="button"
                disabled={creating || !newName.trim() || duplicate}
                onClick={handleCreate}
              >
                {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Create {label.toLowerCase()}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
