import React, { useState, useEffect } from 'react';
import EnrollButton from '@/components/EnrollButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Brain } from 'lucide-react';
import { COURSE_TYPE_CAREER_TEST } from '@/lib/courseCatalog';
import type { Database } from '@/integrations/supabase/types';

type CareerTestCourse = Database['public']['Tables']['courses']['Row'];
type PageSection = Database['public']['Tables']['page_sections']['Row'];

const CareerTest = () => {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<CareerTestCourse[]>([]);
  const [sections, setSections] = useState<PageSection[]>([]);
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCareerTest();
  }, []);

  useEffect(() => {
    if (isAuthenticated && user && courses.length > 0) {
      checkEnrollmentStatus();
    }
  }, [isAuthenticated, user, courses]);

  const fetchCareerTest = async () => {
    try {
      const [courseResult, sectionResult] = await Promise.all([
        supabase
          .from('courses')
          .select('*')
          .eq('course_type', COURSE_TYPE_CAREER_TEST)
          .eq('status', 'active')
          .order('created_at', { ascending: true }),
        supabase
          .from('page_sections')
          .select('*')
          .eq('page_key', 'career_test')
          .eq('is_active', true)
          .order('order_index', { ascending: true }),
      ]);

      if (courseResult.error) {
        console.error('Error fetching career test courses:', courseResult.error);
        toast({
          title: 'Error',
          description: 'Failed to load career test courses.',
          variant: 'destructive',
        });
      } else {
        setCourses(courseResult.data ?? []);
      }

      if (sectionResult.error) {
        console.error('Error fetching career test sections:', sectionResult.error);
      } else {
        setSections(sectionResult.data ?? []);
      }
    } catch (error) {
      console.error('Error fetching career test:', error);
      toast({
        title: 'Error',
        description: 'Failed to load career test details.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const checkEnrollmentStatus = async () => {
    if (!user?.id || courses.length === 0) return;

    const courseIds = courses.map((course) => course.id);

    try {
      const { data: enrollmentData, error: enrollmentError } = await supabase
        .from('enrollments')
        .select('course_id')
        .eq('student_id', user.id)
        .in('course_id', courseIds)
        .eq('status', 'enrolled');

      if (enrollmentError) {
        console.error('Error checking enrollment status:', enrollmentError);
        return;
      }

      setEnrolledCourseIds(
        (enrollmentData ?? [])
          .map((enrollment) => enrollment.course_id)
          .filter((courseId): courseId is string => Boolean(courseId)),
      );
    } catch (error) {
      console.error('Error checking enrollment status:', error);
    }
  };

  const hero = sections.find((section) => section.section_key === 'hero');
  const features = sections.filter((section) => section.section_key === 'feature');
  const benefits = sections.filter((section) => section.section_key === 'benefit');
  const callToAction = sections.find((section) => section.section_key === 'cta');

  if (loading) {
    return (
      <div className="min-h-screen">
        <main className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-kiki-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading career test...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <main>
        <section className="bg-gradient-to-br from-kiki-purple-50 via-white to-kiki-blue-50 py-20">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              {hero?.title || courses[0]?.title || 'Career Test'}
            </h1>
            {(hero?.description || courses[0]?.description) && (
              <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
                {hero?.description || courses[0]?.description}
              </p>
            )}

            {courses.length > 0 ? (
              <div className="grid gap-6 max-w-5xl mx-auto md:grid-cols-2">
                {courses.map((course) => (
                  <div key={course.id} className="bg-white rounded-2xl shadow-lg p-6 text-left">
                    {course.image_url && (
                      <img
                        src={course.image_url}
                        alt={course.title}
                        className="w-full h-48 object-cover rounded-lg mb-4"
                      />
                    )}
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{course.title}</h3>
                    {course.description && (
                      <p className="text-gray-600 text-sm mb-4">{course.description}</p>
                    )}

                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-kiki-purple-600">₹{course.price}</span>
                        {course.original_price != null && course.original_price > course.price && (
                          <span className="text-sm text-gray-500 line-through">₹{course.original_price}</span>
                        )}
                      </div>
                      {course.duration && (
                        <Badge className="bg-green-100 text-green-800">{course.duration}</Badge>
                      )}
                    </div>

                    {course.highlights.length > 0 && (
                      <div className="mb-4">
                        {course.highlights.map((highlight) => (
                          <Badge key={highlight} variant="secondary" className="mr-2 mb-2">
                            {highlight}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <div className="space-y-2">
                      <Button
                        variant="outline"
                        className="w-full border-kiki-purple-600 text-kiki-purple-600 hover:bg-kiki-purple-50"
                        onClick={() => navigate(`/course/${course.id}`)}
                      >
                        View Details
                      </Button>
                      <EnrollButton
                        courseId={course.id}
                        isEnrolled={enrolledCourseIds.includes(course.id)}
                        className="w-full"
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="max-w-md mx-auto bg-white rounded-2xl shadow-lg p-6 mb-8">
                <div className="text-center">
                  <Brain className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-gray-900 mb-2">No career test available</h3>
                  <p className="text-gray-600 text-sm mb-4">Check back after a career test is published.</p>
                  <Button onClick={() => navigate('/programs')} variant="outline" className="w-full">
                    Browse Courses
                  </Button>
                </div>
              </div>
            )}
          </div>
        </section>

        {(features.length > 0 || benefits.length > 0 || callToAction) && (
          <section className="py-20 bg-white">
            <div className="container mx-auto px-4">
              {features.length > 0 && (
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                  {features.map((feature) => (
                    <Card key={feature.id} className="text-center p-6 border-0 card-shadow">
                      <CardContent className="p-0">
                        <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                        {feature.description && (
                          <p className="text-gray-600 text-sm">{feature.description}</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {benefits.length > 0 && (
                <div className="text-center mb-12">
                  <h2 className="text-3xl font-bold text-gray-900 mb-8">What You'll Receive</h2>
                  <div className="grid md:grid-cols-3 gap-6">
                    {benefits.map((benefit) => (
                      <div key={benefit.id} className="bg-kiki-purple-50 rounded-lg p-6">
                        <h3 className="text-xl font-semibold text-kiki-purple-800 mb-3">{benefit.title}</h3>
                        {benefit.description && (
                          <p className="text-kiki-purple-700">{benefit.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {callToAction && courses[0] && (
                <div className="text-center bg-gradient-to-r from-kiki-purple-600 to-kiki-blue-600 rounded-2xl p-12 text-white">
                  {callToAction.title && <h2 className="text-3xl font-bold mb-4">{callToAction.title}</h2>}
                  {callToAction.description && (
                    <p className="text-xl mb-8 opacity-90">{callToAction.description}</p>
                  )}
                  <Button
                    variant="outline"
                    className="border-white text-white bg-transparent hover:bg-white/10"
                    onClick={() => navigate(`/course/${courses[0].id}`)}
                  >
                    View Details
                  </Button>
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default CareerTest;
