import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Clock, BookOpen, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type CourseSearchResult = Pick<
  Database['public']['Tables']['courses']['Row'],
  | 'id'
  | 'title'
  | 'description'
  | 'image_url'
  | 'price'
  | 'original_price'
  | 'duration'
  | 'category'
  | 'age_range'
  | 'mode'
  | 'total_lessons'
>;

const COURSE_SEARCH_COLUMNS =
  'id, title, description, image_url, price, original_price, duration, category, age_range, mode, total_lessons';

const SEARCHABLE_FIELDS = ['title', 'description', 'category', 'mode', 'age_range', 'duration'] as const;

function formatInr(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

function courseMatchesQuery(course: CourseSearchResult, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  return SEARCHABLE_FIELDS.some((field) => {
    const value = course[field];
    return typeof value === 'string' && value.toLowerCase().includes(normalizedQuery);
  });
}

interface CourseDetail {
  key: string;
  label: string;
  icon: React.ReactNode;
}

function courseDetails(course: CourseSearchResult): CourseDetail[] {
  const details: CourseDetail[] = [];

  if (course.duration) {
    details.push({ key: 'duration', label: course.duration, icon: <Clock className="h-3 w-3" /> });
  }
  if (course.mode) {
    details.push({ key: 'mode', label: course.mode, icon: null });
  }
  if (course.age_range) {
    details.push({ key: 'age_range', label: course.age_range, icon: null });
  }
  if (course.total_lessons != null && course.total_lessons > 0) {
    details.push({
      key: 'total_lessons',
      label: `${course.total_lessons} lessons`,
      icon: <BookOpen className="h-3 w-3" />,
    });
  }

  return details;
}

const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [courses, setCourses] = useState<CourseSearchResult[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let isCancelled = false;

    const loadCourses = async () => {
      setHasLoaded(false);
      setLoadError(null);

      const { data, error } = await supabase
        .from('courses')
        .select(COURSE_SEARCH_COLUMNS)
        .eq('status', 'active')
        .order('title', { ascending: true });

      if (isCancelled) {
        return;
      }

      if (error) {
        console.error('Error fetching courses for search:', error);
        setCourses([]);
        setLoadError('Failed to load courses. Please try again.');
        toast({
          title: 'Error',
          description: 'Failed to load courses. Please try again.',
          variant: 'destructive',
        });
      } else {
        setCourses(data ?? []);
      }

      setHasLoaded(true);
    };

    loadCourses();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, toast]);

  const filteredCourses = useMemo(
    () => courses.filter((course) => courseMatchesQuery(course, searchQuery)),
    [courses, searchQuery],
  );

  const openCourse = (courseId: string) => {
    onClose();
    navigate(`/course/${courseId}`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl bg-white border-0 shadow-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-4 pb-6">
          <DialogTitle className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Search className="w-6 h-6" />
            Search Courses
          </DialogTitle>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search by title, description, category, mode, or age range..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="pl-10 h-12 text-base"
              autoFocus
            />
          </div>
        </DialogHeader>

        <SearchResults
          isLoading={!hasLoaded}
          loadError={loadError}
          searchQuery={searchQuery}
          courses={filteredCourses}
          onOpenCourse={openCourse}
        />
      </DialogContent>
    </Dialog>
  );
};

interface SearchResultsProps {
  isLoading: boolean;
  loadError: string | null;
  searchQuery: string;
  courses: CourseSearchResult[];
  onOpenCourse: (courseId: string) => void;
}

const SearchResults: React.FC<SearchResultsProps> = ({
  isLoading,
  loadError,
  searchQuery,
  courses,
  onOpenCourse,
}) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-kiki-purple-600" />
      </div>
    );
  }

  if (loadError) {
    return <p className="text-center text-gray-600 py-8">{loadError}</p>;
  }

  if (courses.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-400 mb-2">
          <Search className="w-12 h-12 mx-auto" />
        </div>
        <p className="text-gray-600">No courses found matching your search.</p>
        <p className="text-sm text-gray-500 mt-1">Try searching with different keywords.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600 mb-4">
        Found {courses.length} course{courses.length !== 1 ? 's' : ''}
        {searchQuery.trim() && ` for "${searchQuery.trim()}"`}
      </div>

      <div className="grid gap-4 max-h-96 overflow-y-auto">
        {courses.map((course) => (
          <CourseSearchCard key={course.id} course={course} onOpenCourse={onOpenCourse} />
        ))}
      </div>
    </div>
  );
};

interface CourseSearchCardProps {
  course: CourseSearchResult;
  onOpenCourse: (courseId: string) => void;
}

const CourseSearchCard: React.FC<CourseSearchCardProps> = ({ course, onOpenCourse }) => {
  const details = courseDetails(course);

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex gap-4">
        {course.image_url && (
          <img
            src={course.image_url}
            alt={course.title}
            className="h-20 w-28 rounded-md object-cover shrink-0"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex justify-between items-start gap-3 mb-2">
            <h3 className="text-lg font-semibold text-gray-900">{course.title}</h3>
            {course.category && (
              <Badge variant="secondary" className="text-xs shrink-0">
                {course.category}
              </Badge>
            )}
          </div>

          {course.description && (
            <p className="text-gray-600 mb-3 text-sm">{course.description}</p>
          )}

          <div className="flex items-center justify-between gap-4 text-xs text-gray-500 mb-3">
            <div className="flex flex-wrap items-center gap-3">
              {details.map((detail) => (
                <span key={detail.key} className="inline-flex items-center gap-1">
                  {detail.icon}
                  {detail.label}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-lg font-bold text-kiki-purple-600">{formatInr(course.price)}</span>
              {course.original_price != null && course.original_price > course.price && (
                <span className="text-xs text-gray-500 line-through">{formatInr(course.original_price)}</span>
              )}
            </div>
          </div>

          <Button
            size="sm"
            className="w-full bg-kiki-purple-600 hover:bg-kiki-purple-700"
            onClick={() => onOpenCourse(course.id)}
          >
            View Details
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SearchModal;
