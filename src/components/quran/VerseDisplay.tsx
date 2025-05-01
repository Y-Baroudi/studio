import type { Verse } from '@/services/alquran-cloud';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface VerseDisplayProps {
  verse: Verse;
  fontSize: number; // Font size in pixels
}

export function VerseDisplay({ verse, fontSize }: VerseDisplayProps) {
  const textStyle = {
    fontSize: `${fontSize}px`,
    lineHeight: `${fontSize * 1.6}px` // Adjust line height based on font size
  };

  const arabicStyle = {
    ...textStyle,
    fontSize: `${fontSize * 1.5}px`, // Make Arabic slightly larger
    lineHeight: `${fontSize * 2.5}px` // Increase line height for Arabic
  };

  const surahInfo = verse.surah
      ? `${verse.surah.englishName} (${verse.surah.name}) - ${verse.verseReference}`
      : `Verse ${verse.verseReference}`; // Fallback if surah info is missing

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Arabic Text Pane */}
      <Card className="bg-secondary/30 dark:bg-secondary/20 border-secondary shadow-inner flex flex-col">
        <CardHeader className="pb-2 pt-4 px-4 md:px-6">
          <CardTitle className="text-lg text-right font-normal text-foreground/80">{verse.surah?.name ?? 'القرآن'}</CardTitle>
          <CardDescription className="text-right text-foreground/60">
             {verse.verseReference}
          </CardDescription>
        </CardHeader>
        <Separator className="mx-4 md:mx-6 bg-secondary-foreground/20" />
        <CardContent className="p-4 md:p-6 text-right flex-grow" dir="rtl">
          <p className="font-uthmani text-foreground" style={arabicStyle}>
            {verse.arabicText}
          </p>
        </CardContent>
      </Card>

      {/* English Translation Pane */}
      <Card className="bg-card border-border shadow-inner flex flex-col">
        <CardHeader className="pb-2 pt-4 px-4 md:px-6">
          <CardTitle className="text-lg font-normal text-foreground/80">{verse.surah?.englishName ?? 'The Quran'}</CardTitle>
           <CardDescription className="text-left text-foreground/60">
             {verse.verseReference} {verse.surah ? `(${verse.surah.englishNameTranslation})` : ''}
           </CardDescription>
        </CardHeader>
        <Separator className="mx-4 md:mx-6" />
        <CardContent className="p-4 md:p-6 text-left flex-grow">
          <p className="text-foreground" style={textStyle}>
            {verse.englishTranslation}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
