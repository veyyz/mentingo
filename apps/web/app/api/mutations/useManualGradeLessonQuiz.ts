import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";

import { ApiClient } from "~/api/api-client";
import { lessonQueryOptions } from "~/api/queries/useLesson";
import { toast } from "~/components/ui/use-toast";

import type { GetLessonByIdResponse } from "../generated-api";

interface ManualGradePayload {
  lessonId: string;
  studentId: string;
  evaluations: { questionId: string; isCorrect: boolean }[];
}

interface ManualGradeResponse {
  correctAnswerCount: number;
  wrongAnswerCount: number;
  questionCount: number;
  score: number;
}

export const useManualGradeLessonQuiz = (
  lessonId: string,
  studentId: string,
  courseId: string,
  language?: string,
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ManualGradePayload) => {
      const response = await ApiClient.instance.patch<{ data: ManualGradeResponse }>(
        "/api/lesson/manual-quiz-grade",
        payload,
      );

      return response.data.data;
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData<GetLessonByIdResponse["data"] | undefined>(
        lessonQueryOptions(lessonId, language as any, studentId).queryKey,
        (cachedLesson) => {
          if (!cachedLesson?.quizDetails) return cachedLesson;

          const updatedQuestions = cachedLesson.quizDetails.questions?.map((question) => {
            const override = variables.evaluations.find(
              (evaluation) => evaluation.questionId === question.id,
            );

            if (!override) return question;

            return {
              ...question,
              passQuestion: override.isCorrect,
            };
          });

          return {
            ...cachedLesson,
            quizDetails: {
              ...cachedLesson.quizDetails,
              questions: updatedQuestions,
              correctAnswerCount: data.correctAnswerCount,
              wrongAnswerCount: data.wrongAnswerCount,
              questionCount: data.questionCount,
              score: data.score,
            },
            isQuizPassed:
              cachedLesson.thresholdScore === null
                ? cachedLesson.isQuizPassed
                : data.score >= (cachedLesson.thresholdScore ?? 0),
          };
        },
      );

      queryClient.invalidateQueries({ queryKey: ["course", { id: courseId }] });
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        return toast({
          description: error.response?.data.message,
          variant: "destructive",
        });
      }

      toast({ description: (error as Error).message, variant: "destructive" });
    },
  });
};
