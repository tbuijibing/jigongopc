import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, User } from "lucide-react";
import { useCompany } from "../context/CompanyContext";
import { membersApi } from "../api/members";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function SidebarMembers() {
  const [open, setOpen] = useState(true);
  const { selectedCompanyId } = useCompany();

  const { data: members } = useQuery({
    queryKey: queryKeys.members.list(selectedCompanyId!),
    queryFn: () => membersApi.listWithUsers(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  if (!selectedCompanyId) return null;

  const userMembers = (members ?? []).filter(
    (m) => m.principalType === "user"
  );

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="group">
        <div className="flex items-center px-3 py-1.5">
          <CollapsibleTrigger className="flex items-center gap-1 flex-1 min-w-0">
            <ChevronRight
              className={cn(
                "h-3 w-3 text-muted-foreground/60 transition-transform opacity-0 group-hover:opacity-100",
                open && "rotate-90"
              )}
            />
            <span className="text-[10px] font-medium uppercase tracking-widest font-mono text-muted-foreground/60">
              员工
            </span>
          </CollapsibleTrigger>
        </div>
      </div>

      <CollapsibleContent>
        <div className="flex flex-col gap-0.5 mt-0.5">
          {userMembers.map((member) => {
            const displayText = member.displayName ?? member.email ?? "未知用户";
            const tooltipLines = [
              member.displayName,
              member.email,
              member.membershipRole,
            ].filter(Boolean);

            return (
              <Tooltip key={member.id}>
                <TooltipTrigger asChild>
                  <div
                    className="flex items-center gap-2.5 px-3 py-1.5 text-[13px] font-medium text-foreground/80 hover:bg-accent/50 hover:text-foreground transition-colors cursor-default rounded-sm"
                  >
                    {member.image ? (
                      <img
                        src={member.image}
                        alt=""
                        className="shrink-0 h-4 w-4 rounded-full object-cover"
                      />
                    ) : (
                      <User className="shrink-0 h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <span className="flex-1 truncate">{displayText}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">
                  {tooltipLines.length > 0 ? (
                    <div className="flex flex-col gap-0.5">
                      {member.displayName && <span>{member.displayName}</span>}
                      {member.email && (
                        <span className="text-muted-foreground">{member.email}</span>
                      )}
                      {member.membershipRole && (
                        <span className="text-muted-foreground capitalize">{member.membershipRole}</span>
                      )}
                    </div>
                  ) : (
                    <span>未知用户</span>
                  )}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
