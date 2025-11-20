import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useLesson } from "~/api/queries";
import { useUserById } from "~/api/queries/admin/useUserById";
import { useManualGradeLessonQuiz } from "~/api/mutations";
import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import { CircularProgress } from "~/components/ui/circular-progress";
import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog";
import { UserAvatar } from "~/components/UserProfile/UserAvatar";
import { LessonContent } from "~/modules/Courses/Lesson/LessonContent";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import type { GetCourseResponse } from "~/api/generated-api";

interface LessonPreviewDialogProps {
  course: GetCourseResponse["data"];
  lessonId: string;
  userId: string;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function LessonPreviewDialog({
  course,
  lessonId,
  userId,
  isOpen,
  onClose,
}: LessonPreviewDialogProps) {
  const { t } = useTranslation();

  const { language } = useLanguageStore();

  const { data: user, isLoading: isLoadingUser } = useUserById(userId);
  const { data: lesson, isLoading: isLoadingLesson } = useLesson(lessonId, language, userId);

  const manualGradeLessonQuiz = useManualGradeLessonQuiz(lessonId, userId, course.id, language);

  const allQuestions = useMemo(() => lesson?.quizDetails?.questions ?? [], [lesson]);

  const [manualEvaluations, setManualEvaluations] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!allQuestions.length) return;

    const initialEvaluation: Record<string, boolean> = {};

    allQuestions.forEach((question) => {
      const isTextQuestion =
        question.type === "brief_response" || question.type === "detailed_response";

      if (question.passQuestion !== undefined && question.passQuestion !== null) {
        initialEvaluation[question.id] = question.passQuestion;
        return;
      }

      initialEvaluation[question.id] = isTextQuestion ? false : false;
    });

    setManualEvaluations(initialEvaluation);
  }, [allQuestions, lessonId]);

  useEffect(() => {
    if (!isLoadingUser && !isLoadingLesson && (!user || !lesson || !course)) {
      onClose?.();
    }
  }, [user, lesson, isLoadingUser, isLoadingLesson, onClose, course]);

  if (!user || !lesson || !course) {
    return null;
  }

  const currentChapter = course.chapters.find((chapter) =>
    chapter?.lessons.some((l) => l.id === lessonId),
  );

  const requiredCorrect = Math.ceil(
    ((lesson.thresholdScore ?? 0) * (lesson.quizDetails?.questionCount ?? 0)) / 100,
  );

  const handleEvaluationChange = (questionId: string, isCorrect: boolean) => {
    setManualEvaluations((prev) => {
      const nextEvaluations = { ...prev, [questionId]: isCorrect };

      const evaluations = allQuestions.map((question) => ({
        questionId: question.id,
        isCorrect: nextEvaluations[question.id] ?? question.passQuestion ?? false,
      }));

      manualGradeLessonQuiz.mutate(
        { lessonId, studentId: userId, evaluations },
      );

      return nextEvaluations;
    });
  };

  const manualGrading = allQuestions.length
    ? {
        evaluations: manualEvaluations,
        onChange: handleEvaluationChange,
        isPending: manualGradeLessonQuiz.isPending,
      }
    : undefined;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-h-[90vh] w-[90%] max-w-screen-2xl 3xl:max-w-[1024px] p-0 gap-0 flex flex-col"
        noCloseButton
      >
        <DialogTitle className="px-6 sm:px-10 3xl:px-8 flex items-center justify-between border-b sticky top-0 left-0 pb-4 bg-white z-10 py-6 border-neutral-200">
          <div className="w-full">
            <span className="h4 truncate">{lesson.title}</span>
            <p className="h6 text-neutral-950">
              <span className="text-neutral-800">
                {t("studentLessonView.other.chapter")} {currentChapter?.displayOrder}:
              </span>{" "}
              {currentChapter?.title}
            </p>
          </div>
          <Button size="icon" variant="outline" onClick={onClose}>
            <Icon name="X" className="size-4" />
          </Button>
        </DialogTitle>
        <div className="pt-6 pb-10 overflow-y-auto">
          <div className="flex items-center justify-between px-10 pb-6">
            <div className="flex items-center gap-4">
              <UserAvatar
                className="size-8"
                userName={user.firstName}
                profilePictureUrl={user.profilePictureUrl}
              />
              <p className="h6">
                {user.firstName} {user.lastName}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <CircularProgress size={40} strokeWidth={4} value={lesson.quizDetails?.score ?? 0} />
              <div className="flex flex-col">
                <span className="group relative">
                  {t("studentLessonView.other.score", {
                    score: lesson.quizDetails?.score ?? 0,
                    correct: lesson.quizDetails?.correctAnswerCount ?? 0,
                    questionsNumber: lesson.quizDetails?.questionCount,
                  })}
                </span>
                <span>
                  {t("studentLessonView.other.passingThreshold", {
                    threshold: lesson.thresholdScore,
                    correct: requiredCorrect,
                    questionsNumber: lesson.quizDetails?.questionCount,
                  })}
                </span>
              </div>
            </div>
          </div>
          <LessonContent
            lesson={lesson}
            course={course}
            lessonsAmount={currentChapter?.lessons.length ?? 0}
            handleNext={() => {}}
            handlePrevious={() => {}}
            isLastLesson={true}
            isFirstLesson={true}
            lessonLoading={isLoadingLesson}
            isPreviewMode={true}
            manualGrading={manualGrading}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
