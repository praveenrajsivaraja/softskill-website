import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, BookOpen, Phone, MapPin, Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { COURSE_TYPE_CAREER_TEST } from '@/lib/courseCatalog';
import { resolveCourseImageUrl } from '@/lib/courseImages';
import EnrollButton from '@/components/EnrollButton';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface Program {
  id: string;
  title: string;
  description: string;
  image_url: string;
  price: number;
  original_price: number;
  duration: string | null;
  mode: string | null;
  age_range: string | null;
  category: string | null;
  total_lessons: number | null;
}

const Programs = () => {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [programNameQuery, setProgramNameQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    fetchPrograms();
  }, [user]);

  const fetchPrograms = async () => {
    try {
      // Get all active courses except MBTI course
      const { data: allCourses, error: coursesError } = await supabase
        .from('courses')
        .select('id, title, description, image_url, price, original_price, duration, mode, age_range, category, total_lessons')
        .eq('status', 'active')
        .neq('course_type', COURSE_TYPE_CAREER_TEST)
        .order('created_at', { ascending: true });

      if (coursesError) {
        console.error('Error fetching programs:', coursesError);
        toast({
          title: "Error",
          description: "Failed to load programs. Please try again.",
          variant: "destructive"
        });
        return;
      }

      let availablePrograms = allCourses || [];

      // If user is authenticated, filter out enrolled courses
      if (isAuthenticated && user) {
        const { data: enrollments, error: enrollmentsError } = await supabase
          .from('enrollments')
          .select('course_id')
          .eq('student_id', user.id);

        if (!enrollmentsError && enrollments) {
          const enrolledCourseIds = enrollments.map(e => e.course_id);
          availablePrograms = allCourses?.filter(course => !enrolledCourseIds.includes(course.id)) || [];
        }
      }

      setPrograms(availablePrograms);
    } catch (error) {
      console.error('Error fetching programs:', error);
      toast({
        title: "Error",
        description: "Failed to load programs. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const normalizedProgramName = programNameQuery.trim().toLowerCase();
  const visiblePrograms = normalizedProgramName
    ? programs.filter((program) => program.title.toLowerCase().includes(normalizedProgramName))
    : programs;

  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-kiki-purple-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <main>
        {/* Hero Section */}
        <section className="bg-gradient-to-br from-kiki-purple-50 via-white to-kiki-blue-50 py-20">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              All <span className="bg-gradient-to-r from-kiki-purple-600 to-kiki-blue-600 bg-clip-text text-transparent">Programs & Services</span>
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
              Comprehensive programs designed to unlock potential and foster personal & professional growth
            </p>
            <div className="max-w-xl mx-auto mb-8 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={programNameQuery}
                onChange={(event) => setProgramNameQuery(event.target.value)}
                placeholder="Search programs by name"
                aria-label="Search programs by name"
                className="pl-10 bg-white"
              />
            </div>
            <div className="flex items-center justify-center gap-6 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-kiki-purple-600" />
                <span>8220879805</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-kiki-purple-600" />
                <span>A global hub for ideas and innovation</span>
              </div>
            </div>
          </div>
        </section>

        {/* Programs Grid */}
        <section className="py-20 bg-white">
          <div className="container mx-auto px-4">
            {visiblePrograms.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {visiblePrograms.map(program => (
                  <Card
                    key={program.id}
                    role="link"
                    tabIndex={0}
                    aria-label={`View details for ${program.title}`}
                    onClick={() => navigate(`/course/${program.id}`)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        navigate(`/course/${program.id}`);
                      }
                    }}
                    className="group overflow-hidden border-0 card-shadow hover:card-shadow-hover transition-all duration-300 hover-scale rounded-2xl cursor-pointer"
                  >
                    <div className="relative overflow-hidden">
                      <img
                        src={resolveCourseImageUrl(program.title, program.image_url) ?? undefined}
                        alt={program.title}
                        className="w-full h-40 object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                      <div className="absolute top-2 left-2">
                        <Badge className={`text-xs ${
                          program.mode === 'Online' 
                            ? 'bg-green-100 text-green-800' 
                            : program.mode === 'Offline' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-purple-100 text-purple-800'
                        }`}>
                          {program.mode}
                        </Badge>
                      </div>
                      <div className="absolute top-2 right-2">
                        <Badge variant="secondary" className="bg-white/90 text-gray-700 text-xs">
                          {program.category}
                        </Badge>
                      </div>
                    </div>

                    <CardContent className="p-4">
                      {program.age_range && (
                        <p className="text-xs text-gray-500 mb-2">{program.age_range}</p>
                      )}

                      <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-kiki-purple-600 transition-colors line-clamp-2">
                        {program.title}
                      </h3>
                      
                      <p className="text-gray-600 mb-3 line-clamp-2 text-sm">
                        {program.description}
                      </p>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mb-3">
                        {program.duration && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>{program.duration}</span>
                          </div>
                        )}
                        {program.mode && <span>{program.mode}</span>}
                        {program.total_lessons != null && program.total_lessons > 0 && (
                          <div className="flex items-center gap-1">
                            <BookOpen className="h-3 w-3" />
                            <span>{program.total_lessons} lessons</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-kiki-purple-600">₹{program.price}</span>
                          {program.original_price && (
                            <span className="text-xs text-gray-500 line-through">₹{program.original_price}</span>
                          )}
                        </div>
                      </div>
                      <p className="text-sm font-medium text-kiki-purple-700">Available after you purchase this program.</p>
                    </CardContent>

                    <CardFooter
                      className="p-4 pt-0 flex flex-col gap-2"
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full border-kiki-purple-600 text-kiki-purple-600 hover:bg-kiki-purple-50"
                        onClick={() => navigate(`/course/${program.id}`)}
                      >
                        View Details
                      </Button>
                      <EnrollButton courseId={program.id} className="w-full text-sm" />
                    </CardFooter>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📚</div>
                <h3 className="text-2xl font-semibold text-gray-900 mb-2">
                  {normalizedProgramName
                    ? "No programs match that name"
                    : isAuthenticated
                      ? "All caught up!"
                      : "No programs available"}
                </h3>
                <p className="text-gray-600">
                  {normalizedProgramName
                    ? "Try a different program name."
                    : isAuthenticated
                      ? "You're enrolled in all available programs."
                      : "Check back later for new programs."}
                </p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

export default Programs;
