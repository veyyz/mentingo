import { useEffect, useState } from "react";
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

  const allQuestions = lesson?.quizDetails?.questions ?? [];

  const isShortAnswer = (type: string) => type === "brief_response" || type === "detailed_response";

  const [manualEvaluations, setManualEvaluations] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!allQuestions.length) {
      setManualEvaluations({});
      return;
    }

    const defaults = allQuestions.reduce<Record<string, boolean>>((acc, question) => {
      if (isShortAnswer(question.type)) {
        acc[question.id] = false;
        return acc;
      }

      if (question.passQuestion !== undefined && question.passQuestion !== null) {
        acc[question.id] = question.passQuestion;
      }

      return acc;
    }, {});

    setManualEvaluations(defaults);
  }, [allQuestions]);

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

  const evaluatedQuestions = allQuestions.map((question) => {
    const manualEvaluation = manualEvaluations[question.id];

    const defaultCorrect = isShortAnswer(question.type)
      ? false
      : question.passQuestion ?? false;

    return {
      questionId: question.id,
      isCorrect: manualEvaluation ?? defaultCorrect,
    };
  });

  const adjustedCorrect = evaluatedQuestions.filter((question) => question.isCorrect).length;

  const adjustedTotal = allQuestions.length;

  const adjustedScore = adjustedTotal ? Math.round((adjustedCorrect / adjustedTotal) * 100) : 0;

  const handleEvaluationChange = (questionId: string, isCorrect: boolean) => {
    setManualEvaluations((prev) => {
      const nextEvaluations = { ...prev, [questionId]: isCorrect };

      const evaluations = allQuestions.map((question) => ({
        questionId: question.id,
        isCorrect:
          nextEvaluations[question.id] ??
          (isShortAnswer(question.type) ? false : question.passQuestion ?? false),
      }));

      manualGradeLessonQuiz.mutate({ lessonId, studentId: userId, evaluations });

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
              <CircularProgress size={40} strokeWidth={4} value={adjustedScore} />
              <div className="flex flex-col">
                <span className="group relative">
                  {t("studentLessonView.other.score", {
                    score: adjustedScore,
                    correct: adjustedCorrect,
                    questionsNumber: adjustedTotal,
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
          {shortAnswerQuestions.length > 0 && (
            <div className="flex flex-col gap-4 px-10 pb-6">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <div className="flex flex-col gap-1">
                  <span className="body-base-md text-neutral-900">
                    {t("courseAdminStatistics.lessonPreview.manualGradingTitle")}
                  </span>
                  <p className="body-sm text-neutral-600">
                    {t("courseAdminStatistics.lessonPreview.manualGradingDescription")}
                  </p>
                </div>
                <div className="flex flex-col items-start gap-1 text-left sm:items-end sm:text-right">
                  <span className="body-base-md text-neutral-900">
                    {t("courseAdminStatistics.lessonPreview.adjustedScore", {
                      score: adjustedScore ?? "–",
                      correct: adjustedCorrectAnswers,
                      total: lesson.quizDetails?.questionCount ?? 0,
                    })}
                  </span>
                  <span className="body-sm text-neutral-600">
                    {t("courseAdminStatistics.lessonPreview.originalScore", {
                      score: lesson.quizDetails?.score ?? 0,
                      correct: lesson.quizDetails?.correctAnswerCount ?? 0,
                      total: lesson.quizDetails?.questionCount ?? 0,
                    })}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                {shortAnswerQuestions.map((question) => {
                  const studentAnswer = question.options?.[0]?.studentAnswer ?? "";
                  const isCorrect = manualEvaluations[question.id];
                  const isShortAnswer = question.type === "brief_response";

                  return (
                    <div
                      key={question.id}
                      className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-xs"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                        <div className="flex flex-col gap-1">
                          <span className="body-base-md text-neutral-900">{question.title}</span>
                          <span className="body-sm text-neutral-600">
                            {isShortAnswer
                              ? t("courseAdminStatistics.lessonPreview.shortAnswerLabel")
                              : t("courseAdminStatistics.lessonPreview.freeTextLabel")}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant={isCorrect ? "default" : "outline"}
                            disabled={manualGradeLessonQuiz.isPending}
                            onClick={() => handleEvaluationChange(question.id, true)}
                          >
                            {t("courseAdminStatistics.lessonPreview.markCorrect")}
                          </Button>
                          <Button
                            type="button"
                            variant={!isCorrect ? "destructive" : "outline"}
                            disabled={manualGradeLessonQuiz.isPending}
                            onClick={() => handleEvaluationChange(question.id, false)}
                          >
                            {t("courseAdminStatistics.lessonPreview.markIncorrect")}
                          </Button>
                        </div>
                      </div>
                      <div className="rounded-lg bg-neutral-50 p-3">
                        <span className="body-sm text-neutral-700">
                          {t("courseAdminStatistics.lessonPreview.studentResponse")}
                        </span>
                        <p className="body-base text-neutral-900 whitespace-pre-line">
                          {studentAnswer || t("courseAdminStatistics.lessonPreview.noResponse")}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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
