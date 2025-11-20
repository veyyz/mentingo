import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";

import type { ManualGradingControls } from "./types";

type ManualGradingActionsProps = {
  questionId: string;
  manualGrading?: ManualGradingControls;
};

export const ManualGradingActions = ({ questionId, manualGrading }: ManualGradingActionsProps) => {
  const { t } = useTranslation();

  if (!manualGrading) return null;

  const manualEvaluation = manualGrading.evaluations?.[questionId];

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <span className="body-sm text-neutral-700">
        {t("courseAdminStatistics.lessonPreview.manualGradingTitle")}
      </span>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={manualEvaluation ? "default" : "outline"}
          disabled={manualGrading.isPending}
          aria-label={t("courseAdminStatistics.lessonPreview.markCorrect")}
          onClick={() => manualGrading.onChange(questionId, true)}
        >
          ✅
        </Button>
        <Button
          type="button"
          variant={manualEvaluation === false ? "destructive" : "outline"}
          disabled={manualGrading.isPending}
          aria-label={t("courseAdminStatistics.lessonPreview.markIncorrect")}
          onClick={() => manualGrading.onChange(questionId, false)}
        >
          ❌
        </Button>
      </div>
    </div>
  );
};

