import { useUserRole } from "~/hooks/useUserRole";
import { ManualGradingActions } from "~/modules/Courses/Lesson/Question/ManualGradingActions";
import { QuestionCard } from "~/modules/Courses/Lesson/Question/QuestionCard";

import { MultipleChoiceOptionList } from "./MultipleChoiceOptionList";

import type { ManualGradingControls, QuizQuestion } from "../types";

type MultipleChoiceProps = {
  question: QuizQuestion;
  isCompleted?: boolean;
  manualGrading?: ManualGradingControls;
};

export const MultipleChoice = ({ question, isCompleted = false, manualGrading }: MultipleChoiceProps) => {
  const { isAdmin } = useUserRole();

  return (
    <QuestionCard
      title={question.title}
      questionType="multipleChoice"
      questionNumber={question.displayOrder}
    >
      <MultipleChoiceOptionList
        options={question.options ?? []}
        questionId={question.id}
        isCompleted={isCompleted}
        isAdmin={isAdmin}
      />
      <ManualGradingActions questionId={question.id} manualGrading={manualGrading} />
    </QuestionCard>
  );
};
