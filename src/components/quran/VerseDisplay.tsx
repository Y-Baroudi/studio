import type { Verse } from '@/services/alquran-cloud';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface VerseDisplayProps {
  verse: Verse;
  fontSize: number; // Font size in pixels
}

export function VerseDisplay({ verse, fontSize }: VerseDisplayProps) {
  const textStyle = {
    fontSize: `${fontSize}px`,
    lineHeight: `${fontSize * 1.6}px`, // Adjust line height based on font size
  };

  const arabicStyle = {
    ...textStyle,
    fontSize: `${fontSize * 1.5}px`, // Make Arabic slightly larger
    lineHeight: `${fontSize * 2.5}px`, // Increase line height for Arabic
  };

  const surahName = verse.surah ? `${verse.surah.englishName} (${verse.surah.name})` : 'The Quran';
  const surahTranslation = verse.surah ? `(${verse.surah.englishNameTranslation})` : '';

  return (
    <Card className="bg-card border-border shadow-md flex flex-col">
      <CardHeader className="pb-2 pt-4 px-4 md:px-6">
        <div className="flex justify-between items-start gap-4">
          {/* English Title */}
          <div className="text-left">
             <CardTitle className="text-lg font-semibold text-foreground">{verse.surah?.englishName ?? 'The Quran'}</CardTitle>
             <CardDescription className="text-left text-foreground/70">
               Verse {verse.verseReference} {surahTranslation}
             </CardDescription>
           </div>
           {/* Arabic Title */}
           <div className="text-right">
              <CardTitle className="text-lg font-uthmani font-normal text-foreground">{verse.surah?.name ?? 'القرآن'}</CardTitle>
             <CardDescription className="text-right text-foreground/70">
               الآية {verse.verseReference.split(':')[1]}
             </CardDescription>
          </div>
        </div>

      </CardHeader>
      <Separator className="mx-4 md:mx-6" />
      <CardContent className="p-4 md:p-6 flex-grow">
        {/* Two-column layout for text */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] md:gap-6">
          {/* English Translation Section (Left Column) */}
          <div className="md:col-start-1">
            <p className="text-foreground text-left" style={textStyle}>
              {verse.englishTranslation}
            </p>
          </div>

          {/* Vertical Separator (Middle Column - hidden on small screens) */}
          <Separator orientation="vertical" className="hidden md:block h-auto mx-auto bg-border/50"/>

          {/* Arabic Text Section (Right Column) */}
          <div dir="rtl" className="mt-4 md:mt-0 md:col-start-3">
            <p className="font-uthmani text-foreground text-right" style={arabicStyle}>
              {verse.arabicText}
            </p>
          </div>

        </div>
      </CardContent>
    </Card>
  );
}
