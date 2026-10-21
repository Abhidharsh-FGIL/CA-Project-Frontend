import { useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { findUnit, stageForExamType, stageUnits, unitDisplayName } from '@/config/tnpsc';

export interface CollectionPlacement {
  stageId: string | null;
  unitId: string | null;
  topicId: string | null;
}

export const NO_PLACEMENT: CollectionPlacement = { stageId: null, unitId: null, topicId: null };

interface Props {
  /** The exam chosen in the form — its stage decides which units are offered. */
  examLabel: string;
  value: CollectionPlacement;
  onChange: (next: CollectionPlacement) => void;
}

/**
 * The syllabus unit a collection is filed under. Required: every question the import brings in is
 * filed under this unit.
 */
export function CollectionUnitField({ examLabel, value, onChange }: Props) {
  const stage = useMemo(() => stageForExamType(examLabel), [examLabel]);
  const units = useMemo(() => stageUnits(stage), [stage]);
  if (units.length === 0) return null;

  const unit = findUnit(stage, value.unitId);

  const pickUnit = (unitId: string) => onChange({ stageId: stage!.id, unitId, topicId: null });

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">
        Syllabus unit <span className="text-red-500">*</span>
      </Label>
      <Select value={value.unitId ?? undefined} onValueChange={pickUnit}>
        <SelectTrigger className="h-10">
          <SelectValue placeholder="Choose the unit this sheet is for" />
        </SelectTrigger>
        <SelectContent className="max-h-[60vh]">
          {/* Subject first, then its units — the same order the Collections tab files them in. */}
          {[...new Set(units.map(u => u.sectionName))].map(section => (
            <SelectGroup key={section}>
              <SelectLabel>{section}</SelectLabel>
              {units
                .filter(u => u.sectionName === section)
                .map(({ unit: u }) => (
                  <SelectItem key={u.id} value={u.id}>
                    <span className="flex items-center gap-1.5">
                      <span className="w-6 text-[10px] font-bold text-muted-foreground">{u.label ?? '—'}</span>
                      <span>{unitDisplayName(stage, u)}</span>
                      <span className="text-[10px] text-muted-foreground">· {u.questions} Qs</span>
                    </span>
                  </SelectItem>
                ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
      <p className="text-[11px] text-muted-foreground">
        {unit
          ? `Every question in this collection is filed under ${unitDisplayName(stage, unit)}, and the collection appears there on the Collections tab.`
          : 'Every question in the collection is filed under the unit you choose here.'}
      </p>
    </div>
  );
}
