import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';
import type { Class, Board, SuggestedStudent } from '@/types';
import { toast } from 'sonner';

interface ClassesContextType {
  classes: Class[];
  isLoading: boolean;
  addClass: (newClass: Omit<Class, 'id' | 'createdAt' | 'teacherName' | 'studentCount'>) => Promise<Class | null>;
  updateClass: (id: string, updates: Partial<{ name: string; board: string; grade: number; subject: string; section: string; color: string; description: string }>) => Promise<Class | null>;
  archiveClass: (id: string) => Promise<boolean>;
  unarchiveClass: (id: string) => Promise<boolean>;
  getClassById: (id: string) => Class | undefined;
  refreshClasses: () => Promise<void>;
  fetchSuggestedStudents: (classId: string) => Promise<SuggestedStudent[]>;
  bulkAddStudents: (classId: string, studentIds: string[]) => Promise<{ added: number; skipped: number } | null>;
}

const ClassesContext = createContext<ClassesContextType | undefined>(undefined);

function mapClassResponse(cls: any): Class {
  return {
    id: cls.id,
    name: cls.name,
    board: cls.board as Board,
    grade: cls.grade,
    subject: cls.subject,
    section: cls.section,
    joinCode: cls.join_code,
    teacherId: cls.teacher_id,
    teacherName: cls.teacher_name || 'Teacher',
    studentCount: cls.student_count || 0,
    color: cls.color || '#6366f1',
    createdAt: cls.created_at || new Date().toISOString(),
    orgId: cls.org_id || undefined,
    isActive: cls.is_active !== false,
    academicYear: cls.academic_year || undefined,
    isClassTeacherView: cls.is_class_teacher_view || false,
  };
}

export function ClassesProvider({ children }: { children: ReactNode }) {
  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user, isAuthenticated } = useAuth();
  const { orgId, workspaceReady } = useWorkspaceContext();

  const fetchClasses = async () => {
    if (!isAuthenticated || !user) {
      setClasses([]);
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const qs = orgId ? `?org_id=${orgId}` : '';
      const [active, archived] = await Promise.all([
        api.get<any[]>(`/api/v1/classes/${qs}`),
        api.get<any[]>(`/api/v1/classes/archived${qs}`),
      ]);
      const merged = [
        ...(active || []).map(mapClassResponse),
        ...(archived || []).map(mapClassResponse),
      ];
      setClasses(merged);
    } catch {
      toast.error('Unable to load your classes. Please refresh the page.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!workspaceReady) return;
    fetchClasses();
  }, [isAuthenticated, user?.id, orgId, workspaceReady]);

  const addClass = async (newClass: Omit<Class, 'id' | 'createdAt' | 'teacherName' | 'studentCount'>): Promise<Class | null> => {
    if (!user) {
      toast.error('You must be logged in to create a class');
      return null;
    }
    try {
      const data = await api.post<any>('/api/v1/classes/', {
        name: newClass.name,
        board: newClass.board,
        grade: newClass.grade,
        subject: newClass.subject,
        section: newClass.section,
        join_code: newClass.joinCode,
        color: newClass.color,
        org_id: newClass.orgId || undefined,
        teacher_id: newClass.teacherId || undefined,
      });
      const createdClass = mapClassResponse(data);
      setClasses(prev => [createdClass, ...prev]);
      toast.success('Class created successfully!');
      return createdClass;
    } catch {
      toast.error('Could not create the class. Please check your details and try again.');
      return null;
    }
  };

  const updateClass = async (id: string, updates: Partial<{ name: string; board: string; grade: number; subject: string; section: string; color: string; description: string }>): Promise<Class | null> => {
    try {
      const data = await api.patch<any>(`/api/v1/classes/${id}`, updates);
      const updated = mapClassResponse(data);
      setClasses(prev => prev.map(c => c.id === id ? updated : c));
      toast.success('Class updated successfully');
      return updated;
    } catch {
      toast.error('Failed to update class');
      return null;
    }
  };

  const archiveClass = async (id: string): Promise<boolean> => {
    try {
      await api.patch(`/api/v1/classes/${id}`, { is_active: false });
      setClasses(prev => prev.map(c => c.id === id ? { ...c, isActive: false } : c));
      toast.success('Class archived successfully');
      return true;
    } catch {
      toast.error('Failed to archive class');
      return false;
    }
  };

  const unarchiveClass = async (id: string): Promise<boolean> => {
    try {
      await api.patch(`/api/v1/classes/${id}`, { is_active: true });
      setClasses(prev => prev.map(c => c.id === id ? { ...c, isActive: true } : c));
      toast.success('Class restored successfully');
      return true;
    } catch {
      toast.error('Failed to restore class');
      return false;
    }
  };

  const getClassById = (id: string) => classes.find(c => c.id === id);
  const refreshClasses = async () => { await fetchClasses(); };

  const fetchSuggestedStudents = async (classId: string): Promise<SuggestedStudent[]> => {
    try {
      const data = await api.get<any[]>(`/api/v1/classes/${classId}/suggested-students`);
      return (data || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        email: s.email,
        rollNumber: s.roll_number,
        grade: s.grade,
        section: s.section,
        boardPreference: s.board_preference,
      }));
    } catch {
      return [];
    }
  };

  const bulkAddStudents = async (classId: string, studentIds: string[]): Promise<{ added: number; skipped: number } | null> => {
    try {
      const data = await api.post<any>(`/api/v1/classes/${classId}/students/bulk`, { student_ids: studentIds });
      return { added: data.added || 0, skipped: data.skipped || 0 };
    } catch {
      toast.error('Failed to add students');
      return null;
    }
  };

  return (
    <ClassesContext.Provider value={{ classes, isLoading, addClass, updateClass, archiveClass, unarchiveClass, getClassById, refreshClasses, fetchSuggestedStudents, bulkAddStudents }}>
      {children}
    </ClassesContext.Provider>
  );
}

export function useClasses() {
  const context = useContext(ClassesContext);
  if (context === undefined) throw new Error('useClasses must be used within a ClassesProvider');
  return context;
}
