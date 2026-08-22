import { useState } from "react";
import { UserPlusIcon, UsersIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: "Admin" | "Operator" | "Viewer";
  twoFactor: boolean;
  lastActive: string;
};

const INITIAL_MEMBERS: TeamMember[] = [
  {
    id: "user-1",
    name: "Jane Doe",
    email: "jane.doe@example.com",
    role: "Admin",
    twoFactor: true,
    lastActive: "Just now",
  },
  {
    id: "user-2",
    name: "Alex Rivera",
    email: "alex.r@example.com",
    role: "Operator",
    twoFactor: true,
    lastActive: "14m ago",
  },
  {
    id: "user-3",
    name: "Sam Taylor",
    email: "sam.t@example.com",
    role: "Viewer",
    twoFactor: false,
    lastActive: "2h ago",
  },
];

export function TeamView() {
  const [members, setMembers] = useState<TeamMember[]>(INITIAL_MEMBERS);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<"Admin" | "Operator" | "Viewer">("Operator");

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    const newMember: TeamMember = {
      id: `user-${Date.now()}`,
      name: inviteName.trim() || inviteEmail.split("@")[0] || "New Member",
      email: inviteEmail.trim(),
      role: inviteRole,
      twoFactor: false,
      lastActive: "Invited",
    };

    setMembers([...members, newMember]);
    setInviteOpen(false);
    setInviteEmail("");
    setInviteName("");
    toast.success(`Invitation sent to ${newMember.email}`, {
      description: `Assigned role: ${newMember.role}`,
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/6 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <UsersIcon className="size-5 text-sky-400" />
            <span>Team &amp; Access Controls</span>
          </h2>
          <p className="font-mono text-xs text-muted-foreground mt-0.5">
            Manage teammates, role-based access controls, and alert subscriptions
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => setInviteOpen(true)}
          className="gap-1.5 bg-[#FF4D22] text-white hover:bg-[#FF380B] font-sans font-semibold rounded-xl px-3.5 shadow-md shadow-orange-950/40"
        >
          <UserPlusIcon className="size-4" />
          <span>Invite Member</span>
        </Button>
      </div>

      {/* Team Table */}
      <div className="rounded-2xl border border-white/8 bg-[#0F1218] overflow-hidden shadow-xl">
        <table className="w-full border-collapse text-left font-sans text-sm">
          <thead>
            <tr className="border-b border-white/6 bg-[#090B0F] font-mono text-xs text-muted-foreground">
              <th className="py-3 px-4">Member</th>
              <th className="py-3 px-4">Role</th>
              <th className="py-3 px-4">2FA Status</th>
              <th className="py-3 px-4">Last Active</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/4 font-mono text-xs">
            {members.map((m) => (
              <tr key={m.id} className="hover:bg-white/2 transition-colors">
                <td className="py-3.5 px-4 font-sans">
                  <div className="flex items-center gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/5 text-white font-bold text-xs border border-white/10">
                      {m.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-white">{m.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{m.email}</p>
                    </div>
                  </div>
                </td>
                <td className="py-3.5 px-4">
                  <span className="rounded-lg border border-white/8 bg-[#161B24] px-2.5 py-0.5 font-semibold text-white">
                    {m.role}
                  </span>
                </td>
                <td className="py-3.5 px-4">
                  {m.twoFactor ? (
                    <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
                      <span className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
                      Enabled
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <span className="size-1.5 rounded-full bg-muted-foreground/60" />
                      Disabled
                    </span>
                  )}
                </td>
                <td className="py-3.5 px-4 text-muted-foreground">{m.lastActive}</td>
                <td className="py-3.5 px-4 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs font-mono text-muted-foreground hover:text-white rounded-lg"
                    onClick={() => toast.info(`Permissions for ${m.name} are active`)}
                  >
                    Edit
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Invite Member Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-md border-white/10 bg-[#0F1218] text-foreground rounded-2xl">
          <form onSubmit={handleInvite}>
            <DialogHeader>
              <DialogTitle className="text-white">Invite Team Member</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Send an invitation to join your wwatch fleet operations dashboard.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 space-y-3 font-mono text-xs">
              <label>
                Full Name
                <Input
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="e.g. Alex Rivera"
                  className="mt-1 bg-[#090B0F] border-white/8 rounded-xl"
                />
              </label>

              <label>
                Email Address
                <Input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="alex.r@example.com"
                  className="mt-1 bg-[#090B0F] border-white/8 rounded-xl"
                />
              </label>

              <label>
                Role
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as "Admin" | "Operator" | "Viewer")}
                  className="mt-1 w-full rounded-xl border border-white/8 bg-[#090B0F] p-2.5 font-mono text-xs text-white focus:outline-none focus:ring-1 focus:ring-brand-orange"
                >
                  <option value="Operator">Operator (Scan, Update, &amp; Triage)</option>
                  <option value="Admin">Admin (Full Fleet &amp; Settings Access)</option>
                  <option value="Viewer">Viewer (Read-only Telemetry)</option>
                </select>
              </label>
            </div>

            <DialogFooter className="mt-6 gap-2">
              <Button type="button" variant="outline" onClick={() => setInviteOpen(false)} className="border-white/8 bg-[#090B0F] hover:bg-[#161B24] rounded-xl">
                Cancel
              </Button>
              <Button type="submit" className="bg-[#FF4D22] text-white hover:bg-[#FF380B] rounded-xl">
                Send Invite
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
