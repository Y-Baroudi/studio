// src/components/quran/SurahList.tsx
'use client';

import type { Surah } from '@/services/alquran-cloud';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SurahListProps {
  surahs: Surah[];
  currentSurah: number;
  onSurahSelect: (surahNumber: number) => void;
}

export function SurahList({ surahs, currentSurah, onSurahSelect }: SurahListProps) {
  if (!surahs || surahs.length === 0) {
    return <div className="p-4 text-center text-muted-foreground">No Surahs available.</div>;
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-1 p-2">
        {surahs.map((surah) => (
          <Button
            key={surah.number}
            variant={currentSurah === surah.number ? 'default' : 'ghost'}
            className={cn(
              "w-full justify-start text-left h-auto py-2 px-3",
              currentSurah === surah.number && "bg-primary text-primary-foreground"
            )}
            onClick={() => onSurahSelect(surah.number)}
          >
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium shrink-0",
                  currentSurah === surah.number
                    ? "bg-primary-foreground text-primary"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {surah.number}
              </span>
              <div className="flex flex-col">
                <span className="font-medium">{surah.englishName}</span>
                <span className={cn("text-xs", currentSurah === surah.number ? "text-primary-foreground/80" : "text-muted-foreground")}>
                  {surah.englishNameTranslation}
                </span>
              </div>
              <span className="ml-auto text-xs font-amiri text-right shrink-0">
                {surah.name}
              </span>
            </div>
          </Button>
        ))}
      </div>
    </ScrollArea>
  );
}
