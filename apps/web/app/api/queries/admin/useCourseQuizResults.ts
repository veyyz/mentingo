import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "../../api-client";

import type { GetCourseQuizResultsResponse } from "../../generated-api";

export const COURSE_QUIZ_RESULTS_QUERY_KEY = ["course", "quizzes", "results"] as const;

export const courseQuizResultsQueryOptions = (courseId: string) =>
  queryOptions({
    queryKey: [COURSE_QUIZ_RESULTS_QUERY_KEY, { courseId }],
    queryFn: async () => {
      const response = await ApiClient.api.courseControllerGetCourseQuizResults(courseId);
      return response.data;
    },
    select: (data: GetCourseQuizResultsResponse) => data.data,
  });

export const useCourseQuizResults = (courseId?: string) =>
  useQuery({
    ...courseQuizResultsQueryOptions(courseId ?? ""),
    enabled: Boolean(courseId),
  });
