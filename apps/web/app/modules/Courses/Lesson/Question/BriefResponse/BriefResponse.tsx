import { useFormContext } from "react-hook-form";

import { useTranslation } from "react-i18next";

import { Textarea } from "~/components/ui/textarea";
import { Button } from "~/components/ui/button";
import { useUserRole } from "~/hooks/useUserRole";
import { cn } from "~/lib/utils";
import { QuestionCard } from "~/modules/Courses/Lesson/Question/QuestionCard";

import type { ManualGradingControls, QuizQuestion } from "~/modules/Courses/Lesson/Question/types";
import type { QuizForm } from "~/modules/Courses/Lesson/types";

export type BriefResponseProps = {
  question: QuizQuestion;
  isCompleted?: boolean;
  manualGrading?: ManualGradingControls;
};

export const BriefResponse = ({ question, isCompleted = false, manualGrading }: BriefResponseProps) => {
  const { isAdmin } = useUserRole();
  const { t } = useTranslation();
  const { register } = useFormContext<QuizForm>();

  const manualEvaluation = manualGrading?.evaluations?.[question.id];
  const showManualGrading = Boolean(manualGrading);

  return (
    <QuestionCard
      title={question.title}
      questionType="oneOrTwoWordSentence"
      questionNumber={question.displayOrder}
    >
      <Textarea
        data-testid="brief-response"
        {...register(`briefResponses.${question.id}`)}
        placeholder="Type your answer here"
        rows={5}
        className={cn({
          "cursor-not-allowed": isAdmin,
          "pointer-events-none": isCompleted,
        })}
      />
      {showManualGrading && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="body-sm text-neutral-700">
            {t("courseAdminStatistics.lessonPreview.manualGradingTitle")}
          </span>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={manualEvaluation ? "default" : "outline"}
              disabled={manualGrading?.isPending}
              onClick={() => manualGrading?.onChange(question.id, true)}
            >
              {t("courseAdminStatistics.lessonPreview.markCorrect")}
            </Button>
            <Button
              type="button"
              variant={manualEvaluation === false ? "destructive" : "outline"}
              disabled={manualGrading?.isPending}
              onClick={() => manualGrading?.onChange(question.id, false)}
            >
              {t("courseAdminStatistics.lessonPreview.markIncorrect")}
            </Button>
          </div>
        </div>
      )}
    </QuestionCard>
  );
};
