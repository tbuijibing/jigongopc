import { ISSUE_TYPES, type IssueType } from "@Jigongai/shared";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ISSUE_TYPE_MAP } from "./IssueTypeIcon";

interface IssueTypeSelectorProps {
  value: IssueType;
  onChange: (value: IssueType) => void;
  disabled?: boolean;
}

export function IssueTypeSelector({ value, onChange, disabled }: IssueTypeSelectorProps) {
  const current = ISSUE_TYPE_MAP[value];
  const CurrentIcon = current.icon;

  return (
    <Select value={value} onValueChange={(v) => onChange(v as IssueType)} disabled={disabled}>
      <SelectTrigger size="sm" className="h-7 text-xs border-none shadow-none px-1 -mx-1 hover:bg-accent/50">
        <SelectValue>
          <CurrentIcon className="h-3.5 w-3.5 shrink-0" />
          <span>{current.label}</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {ISSUE_TYPES.map((type) => {
          const mapping = ISSUE_TYPE_MAP[type];
          const Icon = mapping.icon;
          return (
            <SelectItem key={type} value={type}>
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span>{mapping.label}</span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
