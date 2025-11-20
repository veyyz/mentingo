import { useFormContext } from "react-hook-form";

import { useTranslation } from "react-i18next";

import { Textarea } from "~/components/ui/textarea";
import { Button } from "~/components/ui/button";
import { useUserRole } from "~/hooks/useUserRole";
import { cn } from "~/lib/utils";
import { QuestionCard } from "~/modules/Courses/Lesson/Question/QuestionCard";
import { ManualGradingActions } from "~/modules/Courses/Lesson/Question/ManualGradingActions";

import type { ManualGradingControls, QuizQuestion } from "~/modules/Courses/Lesson/Question/types";
import type { QuizForm } from "~/modules/Courses/Lesson/types";

export type DetailedResponseProps = {
  question: QuizQuestion;
  isCompleted?: boolean;
  manualGrading?: ManualGradingControls;
};
export const DetailedResponse = ({ question, isCompleted = false, manualGrading }: DetailedResponseProps) => {
  const { isAdmin } = useUserRole();
  const { t } = useTranslation();
  const { register } = useFormContext<QuizForm>();

  const manualEvaluation = manualGrading?.evaluations?.[question.id];
  const showManualGrading = Boolean(manualGrading);

  return (
    <QuestionCard
      title={question.title}
      questionType="threeOrFiveWordSentence"
      questionNumber={question.displayOrder}
    >
      <Textarea
        data-testid="detailed-response"
        {...register(`detailedResponses.${question.id}`)}
        placeholder="Type your answer here"
        rows={5}
        className={cn({
          "cursor-not-allowed": isAdmin,
          "pointer-events-none": isCompleted,
        })}
      />
      <ManualGradingActions questionId={question.id} manualGrading={manualGrading} />
    </QuestionCard>
  );
};
