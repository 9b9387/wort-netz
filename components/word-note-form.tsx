"use client";

import { useActionState } from "react";
import { SaveIcon } from "lucide-react";
import {
  saveWordNote,
  type WordStudyState,
} from "@/app/actions/word-study";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

export function WordNoteForm({
  lexemeId,
  noteContent,
  labels,
}: {
  lexemeId: string;
  noteContent: string;
  labels: {
    myNotes: string;
    notePlaceholder: string;
    saveNote: string;
    savingNote: string;
    noteSaved: string;
  };
}) {
  const [state, formAction, pending] = useActionState(
    saveWordNote,
    {} as WordStudyState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="lexemeId" value={lexemeId} />

      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="word-note" className="sr-only">
            {labels.myNotes}
          </FieldLabel>
          <Textarea
            id="word-note"
            name="content"
            defaultValue={noteContent}
            placeholder={labels.notePlaceholder}
            maxLength={5000}
            disabled={pending}
          />
        </Field>
      </FieldGroup>

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? (
            <>
              <Spinner data-icon="inline-start" />
              {labels.savingNote}
            </>
          ) : (
            <>
              <SaveIcon data-icon="inline-start" />
              {labels.saveNote}
            </>
          )}
        </Button>
        {state.message === "saved" && (
          <span className="text-xs text-muted-foreground">
            {labels.noteSaved}
          </span>
        )}
      </div>
    </form>
  );
}
