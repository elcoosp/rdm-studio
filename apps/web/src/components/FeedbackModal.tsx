// apps/web/src/components/FeedbackModal.tsx — in-app feedback dialog (v2.3.1)
//
// Controlled Dialog with a 1–5 star rating and optional comment. On submit it
// fires `feedback_submitted` (rating + truncated comment) via product telemetry
// and shows a sonner toast. Uses Base UI Dialog primitives + Lingui i18n.

import { useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { Star, Send } from "lucide-react";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from "@rdm-studio/ui/primitives";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trackProductEvent } from "@/lib/productTelemetry";
import { toast } from "sonner";

export interface FeedbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FeedbackModal({ open, onOpenChange }: FeedbackModalProps): React.ReactElement {
  const { t } = useLingui();
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = () => {
    if (rating === null) return;
    setSubmitting(true);
    trackProductEvent("feedback_submitted", {
      rating,
      ...(comment.trim() ? { comment: comment.trim().slice(0, 500) } : {}),
    });
    toast(t({ id: "feedback.thankYou", message: "Merci pour votre retour !" }));
    setRating(null);
    setComment("");
    setSubmitting(false);
    onOpenChange(false);
  };

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogTrigger>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-[4px] border border-hairline bg-panel px-3 py-1.5 text-[12px] font-medium text-ink-secondary hover:border-accent hover:text-accent"
          aria-label={t`Envoyer des commentaires`}
          data-testid="feedback-trigger"
        >
          {t({ id: "feedback.button", message: "Commentaires" })}
        </button>
      </DialogTrigger>
      <DialogContent data-testid="feedback-modal" className="sm:max-w-[420px] p-0">
        <DialogHeader>
          <DialogTitle>{t({ id: "feedback.title", message: "Votre avis nous aide" })}</DialogTitle>
          <DialogDescription>
            {t({
              id: "feedback.subtitle",
              message:
                "Dites-nous ce que vous pensez de l'atelier. Vos réponses sont anonymes et restent sur votre poste.",
            })}
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 py-4">
          <p className="mb-4 text-[13px] text-ink-secondary">
            {t({ id: "feedback.ratingLabel", message: "Note globale" })}
          </p>
          <div className="flex items-center gap-1 mb-6">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                aria-pressed={rating === star}
                onClick={() => setRating(star)}
                className={`rounded p-1.5 transition-colors ${
                  rating !== null && star <= rating
                    ? "bg-accent text-white"
                    : "text-ink-muted hover:text-accent"
                }`}
              >
                <Star size={18} strokeWidth={1.5} aria-hidden />
              </button>
            ))}
          </div>
          <div className="space-y-2">
            <label className="block text-[13px] font-medium text-ink-secondary">
              {t({ id: "feedback.commentLabel", message: "Commentaire (optionnel)" })}
            </label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t`Dites-nous en plus…`}
              rows={4}
              className="min-h-[100px]"
              data-testid="feedback-comment"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-hairline">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {t({ id: "feedback.cancel", message: "Annuler" })}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={submitting || rating === null}
          >
            {submitting ? (
              t({ id: "feedback.sending", message: "Envoi…" })
            ) : (
              <>
                <Send size={14} strokeWidth={1.5} aria-hidden />
                {t({ id: "feedback.send", message: "Envoyer" })}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </DialogRoot>
  );
}
