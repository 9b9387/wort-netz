"use client";

import { SpeakButton } from "@/components/speak-button";
import { TranslatedText } from "@/components/word-translation";
import { ClickableGermanText } from "@/components/word-link";
import type { ExampleSentence } from "@/lib/example-sentences";

/**
 * Example sentences with a community translation when Tatoeba provides one and
 * the on-device translation otherwise. Every sentence can be read aloud.
 */
export function ExampleSentenceList({
  sentences,
  labels,
}: {
  sentences: ExampleSentence[];
  labels: {
    pronounce: string;
  };
}) {
  return (
    <ul className="flex flex-col gap-5">
      {sentences.map((sentence) => (
        <li
          key={sentence.id}
          className="flex items-start gap-2 border-l-2 border-accent-ochre pl-3"
        >
          <SpeakButton
            text={sentence.text}
            label={labels.pronounce}
            iconOnly
          />

          <div className="flex min-w-0 flex-col gap-1.5">
            <p className="font-display text-lg italic leading-7 text-ink-secondary">
              <ClickableGermanText text={sentence.text} />
            </p>

            {sentence.translation ? (
              <p
                data-slot="translated-text"
                className="text-sm leading-6 text-ink-secondary"
              >
                {sentence.translation}
              </p>
            ) : (
              <TranslatedText text={sentence.text} />
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
