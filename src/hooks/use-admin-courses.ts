import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { coursesApi, type CourseCreatePayload } from '@/lib/adminApi';
import { toast } from 'sonner';

const QUERY_KEY = 'admin-courses';

export function useAdminCourses(page = 1, limit = 50) {
  return useQuery({
    queryKey: [QUERY_KEY, page, limit],
    queryFn: () => coursesApi.list(page, limit),
    staleTime: 60 * 1000,
  });
}

export function useAdminCourseActions() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: [QUERY_KEY] });

  const create = useMutation({
    mutationFn: (payload: CourseCreatePayload) => coursesApi.create(payload),
    onSuccess: (data) => {
      toast.success(`"${data.name}" created`);
      invalidate();
    },
  });

  const update = useMutation({
    mutationFn: ({ courseId, payload }: { courseId: string; payload: Partial<CourseCreatePayload> }) =>
      coursesApi.update(courseId, payload),
    onSuccess: (data) => {
      toast.success(`"${data.name}" updated`);
      invalidate();
    },
  });

  const archive = useMutation({
    mutationFn: (courseId: string) => coursesApi.archive(courseId),
    onSuccess: (data) => {
      toast.success(`"${data.name}" archived`);
      invalidate();
    },
  });

  const restore = useMutation({
    mutationFn: (courseId: string) => coursesApi.restore(courseId),
    onSuccess: (data) => {
      toast.success(`"${data.name}" restored`);
      invalidate();
    },
  });

  const deleteCourse = useMutation({
    mutationFn: (courseId: string) => coursesApi.delete(courseId),
    onSuccess: () => {
      toast.success('Course deleted');
      invalidate();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Cannot delete course');
    },
  });

  return { create, update, archive, restore, deleteCourse };
}
