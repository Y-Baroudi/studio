import type { Verse } from '@/services/alquran-cloud';
import { Card, CardContent } from '@/components/ui/card';

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


  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Arabic Text Pane */}
      <Card className="bg-secondary/30 dark:bg-secondary/20 border-secondary shadow-inner">
        <CardContent className="p-4 md:p-6 text-right" dir="rtl">
          <p className="font-uthmani text-foreground" style={arabicStyle}>
            {verse.arabicText}
          </p>
        </CardContent>
      </Card>

      {/* English Translation Pane */}
      <Card className="bg-card border-border shadow-inner">
        <CardContent className="p-4 md:p-6 text-left">
          <p className="text-foreground" style={textStyle}>
            {verse.englishTranslation}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
