"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  EyeIcon,
  RotateCcwIcon,
  SparklesIcon,
  Volume2Icon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { TranslatedText } from "@/components/word-translation";
import { useGermanSpeech } from "@/hooks/use-speech";
import type { Translation } from "@/lib/i18n";
import { LEITNER_BOX_MAX, type ReviewRating } from "@/lib/review/schedule";
import type { ReviewCardPayload } from "@/lib/review/types";
import { sensePosLabel } from "@/lib/word-senses";
import { ReviewSentence } from "./review-sentence";

/** `speechSynthesis` never changes during a session, so nothing to subscribe to. */
function subscribeToNothing(): () => void {
  return () => {};
}

function hasSpeechSupport(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/**
 * One sentence card: the word and the example are visible on the front, the
 * meaning is on the back, and the two rating buttons drive the schedule.
 *
 * The parent remounts this component per presentation (`key`), so the elapsed
 * timer and the flip state always belong to the card on screen.
 */
export function ReviewCard({
  card,
  t,
  autoSpeak,
  onAutoSpeakChange,
  onRate,
  pending,
}: {
  card: ReviewCardPayload;
  t: Translation;
  autoSpeak: boolean;
  onAutoSpeakChange: (value: boolean) => void;
  onRate: (rating: ReviewRating, elapsedMs: number) => void;
  pending: boolean;
}) {
  const [flipped, setFlipped] = useState(false);
  /**
   * Read through `useSyncExternalStore` so the server renders "no support" and
   * the browser corrects it without a hydration mismatch.
   */
  const speechSupported = useSyncExternalStore(
    subscribeToNothing,
    hasSpeechSupport,
    () => false,
  );
  const startedAtRef = useRef<number | null>(null);
  const { speakSequence, stop, speaking } = useGermanSpeech();
  const sentence = card.sentence;

  useEffect(() => {
    startedAtRef.current = Date.now();
  }, []);

  // Reads the word first, pauses, then reads the whole sentence.
  useEffect(() => {
    if (!autoSpeak || !speechSupported || !sentence) {
      return;
    }

    speakSequence([
      { text: card.canonicalLemma, rate: 0.8, pauseAfterMs: 450 },
      { text: sentence.text, rate: 0.95 },
    ]);

    return () => stop();
  }, [
    autoSpeak,
    card.canonicalLemma,
    sentence,
    speakSequence,
    speechSupported,
    stop,
  ]);

  const elapsed = useCallback(
    () => Math.max(0, Date.now() - (startedAtRef.current ?? Date.now())),
    [],
  );

  const replay = useCallback(() => {
    if (!sentence) {
      return;
    }

    speakSequence([
      { text: card.canonicalLemma, rate: 0.8, pauseAfterMs: 450 },
      { text: sentence.text, rate: 0.95 },
    ]);
  }, [card.canonicalLemma, sentence, speakSequence]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || pending) {
        return;
      }

      if (!flipped) {
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          setFlipped(true);
        }

        return;
      }

      if (event.key === "1") {
        onRate("FORGOT", elapsed());
      }

      if (event.key === "2") {
        onRate("KNOWN", elapsed());
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [elapsed, flipped, onRate, pending]);

  return (
    <Card className="shadow-plate">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {card.isNew && <Badge variant="secondary">{t.reviewNewBadge}</Badge>}
          {card.level && (
            <Badge
              variant="outline"
              className="border-cefr bg-cefr-muted font-code text-cefr-foreground"
            >
              {card.level}
            </Badge>
          )}
          <Badge variant="outline">
            {t.leitnerBox} {card.box}/{LEITNER_BOX_MAX}
          </Badge>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-primary">
              {card.canonicalLemma}
            </h2>
            <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {card.wordType && <span>{card.wordType}</span>}
              {card.ipa && <span className="font-code">{card.ipa}</span>}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {sentence && (
              <Button
                variant="outline"
                size="sm"
                onClick={replay}
                disabled={!speechSupported || speaking}
                aria-label={t.reviewReplay}
                title={t.reviewReplay}
              >
                <Volume2Icon data-icon="inline-start" />
                {speaking ? t.reviewSpeaking : t.reviewReplay}
              </Button>
            )}
            {speechSupported && (
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="review-auto-speak"
                  className="text-xs text-muted-foreground"
                >
                  {t.reviewAutoSpeak}
                </Label>
                <Switch
                  id="review-auto-speak"
                  size="sm"
                  checked={autoSpeak}
                  onCheckedChange={(checked) => onAutoSpeakChange(checked)}
                />
              </div>
            )}
            {!speechSupported && (
              <span className="text-xs text-muted-foreground">
                {t.reviewSpeechUnsupported}
              </span>
            )}
          </div>
        </div>

        {card.baseLemma && (
          <p className="text-sm text-muted-foreground">
            {t.reviewFormOf.replace("{lemma}", card.baseLemma)}
          </p>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        {sentence ? (
          <div className="flex flex-col gap-3">
            <ReviewSentence
              text={sentence.text}
              highlightRanges={sentence.highlightRanges}
            />
            {flipped && sentence.translation && (
              <p className="text-sm leading-6 text-ink-secondary">
                {sentence.translation}
              </p>
            )}
            <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">
                {sentence.generated
                  ? t.reviewSentenceGenerated
                  : sentence.source === "tatoeba"
                    ? "Tatoeba"
                    : "OdeNet"}
              </Badge>
              {sentence.license && <span>{sentence.license}</span>}
              {sentence.sourceUrl && (
                <a
                  className="underline-offset-4 hover:underline"
                  href={sentence.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  ↗
                </a>
              )}
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted px-3 py-2">
            <span className="text-sm font-medium">
              {t.reviewSentenceUnavailable}
            </span>
            <span className="text-xs text-muted-foreground">
              {t.reviewSentenceUnavailableHint}
            </span>
          </div>
        )}

        {flipped ? <ReviewBack card={card} t={t} /> : null}
      </CardContent>

      <CardFooter className="flex-col items-stretch gap-2">
        {flipped ? (
          <>
            <p className="text-center text-xs text-muted-foreground">
              {t.reviewAnswerHint}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                disabled={pending}
                onClick={() => onRate("FORGOT", elapsed())}
              >
                <RotateCcwIcon data-icon="inline-start" />
                {t.reviewForgot} (1)
              </Button>
              <Button
                className="flex-1"
                disabled={pending}
                onClick={() => onRate("KNOWN", elapsed())}
              >
                <SparklesIcon data-icon="inline-start" />
                {t.reviewKnown} (2)
              </Button>
            </div>
          </>
        ) : (
          <Button className="w-full" disabled={pending} onClick={() => setFlipped(true)}>
            {pending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <EyeIcon data-icon="inline-start" />
            )}
            {t.reviewShowAnswer}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

/** The answer side: meaning, own notes and the word's forms. */
function ReviewBack({
  card,
  t,
}: {
  card: ReviewCardPayload;
  t: Translation;
}) {
  const hasForms = Boolean(card.genitive || card.plural);
  const hasDefinitions =
    card.definitionsDe.length > 0 || Boolean(card.definitionEn);

  if (!card.gloss && !card.note && !hasDefinitions && !hasForms) {
    return null;
  }

  return (
    <>
      <Separator />
      <div className="flex flex-col gap-4">
        {card.gloss && (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t.phraseGlossLabel}
            </span>
            <p className="text-base">{card.gloss}</p>
          </div>
        )}

        {card.note && (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t.reviewNoteTitle}
            </span>
            <p className="whitespace-pre-wrap text-sm leading-6">{card.note}</p>
          </div>
        )}

        {card.definitionsDe.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t.reviewDefinitionsDe}
            </span>
            <ul className="flex flex-col gap-1 text-sm leading-6">
              {card.definitionsDe.map((definition) => (
                <li key={definition}>{definition}</li>
              ))}
            </ul>
          </div>
        )}

        {card.senses.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t.reviewDefinitionsEn}
            </span>
            {/* Every sense, not just the first one: the sentence tells the user
                which reading is meant, and the list must contain it. */}
            <ol className="flex flex-col gap-2 text-sm leading-6">
              {card.senses.map((sense, index) => (
                <li key={sense.text} className="flex gap-2">
                  <span className="font-code text-xs text-muted-foreground">
                    {index + 1}
                  </span>
                  <div className="flex min-w-0 flex-col gap-1">
                    <p lang="en">{sense.text}</p>
                    <span className="flex flex-wrap items-center gap-1.5">
                      {sensePosLabel(t, sense.partOfSpeech) && (
                        <Badge variant="outline">
                          {sensePosLabel(t, sense.partOfSpeech)}
                        </Badge>
                      )}
                      {sense.rare && (
                        <span className="text-xs text-muted-foreground">
                          {t.senseRare}
                        </span>
                      )}
                    </span>
                    {index === 0 && <TranslatedText text={sense.text} />}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

        {hasForms && (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t.reviewForms}
            </span>
            <span className="flex flex-wrap items-center gap-2 text-sm">
              {card.genitive && (
                <Badge variant="outline">
                  {t.genitive}: {card.genitive}
                </Badge>
              )}
              {card.plural && (
                <Badge variant="outline">
                  {t.plural}: {card.plural}
                </Badge>
              )}
            </span>
          </div>
        )}
      </div>
    </>
  );
}
