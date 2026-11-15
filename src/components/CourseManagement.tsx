
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { BookOpen, Plus, Edit, Trash2, Users, Settings } from 'lucide-react';
import AdminSearchableTab from './AdminSearchableTab';
import AdminSectionManagement from './AdminSectionManagement';
import { COURSE_TYPE_CAREER_TEST, COURSE_TYPE_COURSE, linesToList, listToLines } from '@/lib/courseCatalog';
import { fetchPaidCourseAttachments } from '@/lib/courseAttachment';
import {
  createDocumentDraft,
  documentsReadyToSave,
  fetchCourseDocumentDrafts,
  saveCourseMaterials,
  type CourseDocumentDraft,
} from '@/lib/courseDocuments';

interface Course {
  id: string;
  title: string;
  description: string | null;
  price: number;
  original_price: number | null;
  category: string | null;
  duration: string | null;
  age_range: string | null;
  mode: string | null;
  image_url: string | null;
  status: string | null;
  total_lessons: number | null;
  course_type: string;
  highlights: string[] | null;
  learning_points: string[] | null;
  attachment_name: string | null;
  attachment_url: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface CourseManagementProps {
  catalog?: 'all' | 'course' | 'career_test';
}

const emptyCourseForm = {
  title: '',
  description: '',
  price: '',
  original_price: '',
  category: '',
  duration: '',
  age_range: '',
  mode: '',
  image_url: '',
  status: 'active',
  total_lessons: '',
  course_type: COURSE_TYPE_COURSE,
  highlights: '',
  learning_points: '',
};

const CourseManagement = ({ catalog = 'all' }: CourseManagementProps) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [documentDrafts, setDocumentDrafts] = useState<CourseDocumentDraft[]>([createDocumentDraft()]);
  const [documentsLoaded, setDocumentsLoaded] = useState(true);
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    ...emptyCourseForm,
    course_type: catalog === 'career_test' ? COURSE_TYPE_CAREER_TEST : COURSE_TYPE_COURSE,
  });

  useEffect(() => {
    fetchCourses();
  }, []);

  const matchesCatalog = (course: Course) => {
    if (catalog === 'career_test') return course.course_type === COURSE_TYPE_CAREER_TEST;
    if (catalog === 'course') return course.course_type !== COURSE_TYPE_CAREER_TEST;
    return true;
  };

  useEffect(() => {
    setFilteredCourses(courses.filter(matchesCatalog));
  }, [courses, catalog]);

  const handleSearch = (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setFilteredCourses(courses.filter(matchesCatalog));
      return;
    }
    
    const filtered = courses.filter(course =>
      matchesCatalog(course) && (
        course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.category?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
    setFilteredCourses(filtered);
  };

  const fetchCourses = async () => {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      const attachments = await fetchPaidCourseAttachments((data || []).map((course) => course.id));
      const attachmentByCourseId = new Map(attachments.map((attachment) => [attachment.courseId, attachment]));
      setCourses((data || []).map((course) => {
        const attachment = attachmentByCourseId.get(course.id);
        return {
          ...course,
          attachment_name: attachment?.attachmentName ?? course.attachment_name ?? null,
          attachment_url: attachment?.attachmentUrl ?? course.attachment_url ?? null,
        };
      }));
    } catch (error) {
      console.error('Error fetching courses:', error);
      toast({
        title: "Error",
        description: "Failed to fetch courses.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.title.trim() || !formData.price || (editingCourse && !documentsLoaded)) return;

    const preparedDocuments = documentsReadyToSave(documentDrafts);
    if ('error' in preparedDocuments) {
      toast({
        title: "Documents",
        description: preparedDocuments.error,
        variant: "destructive",
      });
      return;
    }

    try {
      const courseData = {
        title: formData.title,
        description: formData.description || null,
        price: parseFloat(formData.price),
        original_price: formData.original_price ? parseFloat(formData.original_price) : null,
        category: formData.category || null,
        duration: formData.duration || null,
        age_range: formData.age_range || null,
        mode: formData.mode || null,
        image_url: formData.image_url || null,
        status: formData.status as 'active' | 'inactive' | 'archived',
        total_lessons: formData.total_lessons ? parseInt(formData.total_lessons) : 0,
        course_type: catalog === 'career_test' ? COURSE_TYPE_CAREER_TEST : formData.course_type,
        highlights: linesToList(formData.highlights),
        learning_points: linesToList(formData.learning_points),
        updated_at: new Date().toISOString()
      };

      let courseId = editingCourse?.id;
      if (editingCourse) {
        const { error } = await supabase
          .from('courses')
          .update(courseData)
          .eq('id', editingCourse.id);

        if (error) throw error;
      } else {
        const { data: createdCourse, error } = await supabase
          .from('courses')
          .insert(courseData)
          .select('id')
          .single();

        if (error) throw error;
        courseId = createdCourse.id;
      }

      if (!courseId) {
        throw new Error('The course was saved without an id, so the attachment could not be stored.');
      }

      await saveCourseMaterials(courseId, preparedDocuments.documents);

      toast({
        title: "Success",
        description: editingCourse ? "Course updated successfully." : "Course created successfully.",
      });

      resetForm();
      setIsDialogOpen(false);
      fetchCourses();
    } catch (error) {
      console.error('Error saving course:', error);
      const description = error instanceof Error && (
        error.message.startsWith('Run the course attachment SQL')
        || error.message.startsWith('Run the course document SQL')
      )
        ? error.message
        : "Failed to save course.";
      toast({
        title: "Error",
        description,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (courseId: string) => {
    if (!confirm('Are you sure you want to delete this course?')) return;

    try {
      const { error } = await supabase
        .from('courses')
        .delete()
        .eq('id', courseId);

      if (error) throw error;
      toast({ title: "Success", description: "Course deleted successfully." });
      fetchCourses();
    } catch (error) {
      console.error('Error deleting course:', error);
      toast({
        title: "Error",
        description: "Failed to delete course.",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      ...emptyCourseForm,
      course_type: catalog === 'career_test' ? COURSE_TYPE_CAREER_TEST : COURSE_TYPE_COURSE,
    });
    setEditingCourse(null);
    setDocumentDrafts([createDocumentDraft()]);
    setDocumentsLoaded(true);
  };

  const openEditDialog = (course: Course) => {
    setEditingCourse(course);
    setFormData({
      title: course.title,
      description: course.description || '',
      price: course.price.toString(),
      original_price: course.original_price?.toString() || '',
      category: course.category || '',
      duration: course.duration || '',
      age_range: course.age_range || '',
      mode: course.mode || '',
      image_url: course.image_url || '',
      status: course.status || 'active',
      total_lessons: course.total_lessons?.toString() || '',
      course_type: course.course_type || COURSE_TYPE_COURSE,
      highlights: listToLines(course.highlights),
      learning_points: listToLines(course.learning_points),
    });
    setDocumentDrafts(course.attachment_url
      ? [createDocumentDraft({
        title: course.attachment_name || '',
        driveUrl: course.attachment_url,
        monthIndex: '1',
      })]
      : [createDocumentDraft()]);
    setDocumentsLoaded(false);
    setIsDialogOpen(true);
    void fetchCourseDocumentDrafts(course.id).then((savedDocuments) => {
      if (savedDocuments && savedDocuments.length > 0) {
        setDocumentDrafts(savedDocuments);
      }
      setDocumentsLoaded(true);
    });
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      active: 'default',
      inactive: 'secondary',
      archived: 'outline'
    } as const;
    
    return (
      <Badge variant={variants[status as keyof typeof variants] || 'outline'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            {catalog === 'career_test' ? 'Career Test Courses' : 'Course Management'}
          </CardTitle>
          <CardDescription>
            {catalog === 'career_test'
              ? 'Add, edit, or delete career tests stored in the courses table'
              : 'Add, edit, or delete courses and their saved details'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="courses" className="space-y-4">
            <TabsList>
              <TabsTrigger value="courses" className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                {catalog === 'career_test' ? 'Career Tests' : 'Courses'}
              </TabsTrigger>
              {catalog !== 'career_test' && (
                <TabsTrigger value="sections" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Sections & Content
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="courses">
              <AdminSearchableTab 
                onSearch={handleSearch}
                placeholder="Search courses..."
              >
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">
                      {catalog === 'career_test' ? 'Career Tests' : 'All Courses'}
                    </h3>
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                      <DialogTrigger asChild>
                        <Button onClick={resetForm}>
                          <Plus className="h-4 w-4 mr-2" />
                          {catalog === 'career_test' ? 'Add Career Test' : 'Add Course'}
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>
                            {editingCourse
                              ? catalog === 'career_test' ? 'Edit Career Test' : 'Edit Course'
                              : catalog === 'career_test' ? 'Add Career Test' : 'Add New Course'}
                          </DialogTitle>
                          <DialogDescription>
                            Details are saved to the database and shown on the site.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="grid grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-1">
                          <div className="col-span-2">
                            <Label htmlFor="title">Title</Label>
                            <Input
                              id="title"
                              value={formData.title}
                              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                              placeholder="Course title"
                            />
                          </div>
                          <div className="col-span-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                              id="description"
                              value={formData.description}
                              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                              placeholder="Course description"
                            />
                          </div>
                          <div>
                            <Label htmlFor="price">Price (₹)</Label>
                            <Input
                              id="price"
                              type="number"
                              value={formData.price}
                              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                              placeholder="0"
                            />
                          </div>
                          <div>
                            <Label htmlFor="original_price">Original Price (₹)</Label>
                            <Input
                              id="original_price"
                              type="number"
                              value={formData.original_price}
                              onChange={(e) => setFormData({ ...formData, original_price: e.target.value })}
                              placeholder="0"
                            />
                          </div>
                          <div>
                            <Label htmlFor="category">Category</Label>
                            <Input
                              id="category"
                              value={formData.category}
                              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                              placeholder="e.g., Programming, Design"
                            />
                          </div>
                          <div>
                            <Label htmlFor="duration">Duration</Label>
                            <Input
                              id="duration"
                              value={formData.duration}
                              onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                              placeholder="e.g., 8 weeks"
                            />
                          </div>
                          <div>
                            <Label htmlFor="age_range">Age Range</Label>
                            <Input
                              id="age_range"
                              value={formData.age_range}
                              onChange={(e) => setFormData({ ...formData, age_range: e.target.value })}
                              placeholder="e.g., 12-18 years"
                            />
                          </div>
                          <div>
                            <Label htmlFor="mode">Mode</Label>
                            <Input
                              id="mode"
                              value={formData.mode}
                              onChange={(e) => setFormData({ ...formData, mode: e.target.value })}
                              placeholder="Online, Offline, or Hybrid"
                            />
                          </div>
                          {catalog !== 'career_test' && (
                            <div>
                              <Label htmlFor="course_type">Type</Label>
                              <Select
                                value={formData.course_type}
                                onValueChange={(value) => setFormData({ ...formData, course_type: value })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={COURSE_TYPE_COURSE}>Course</SelectItem>
                                  <SelectItem value={COURSE_TYPE_CAREER_TEST}>Career Test</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          <div className="col-span-2">
                            <Label htmlFor="highlights">Highlights</Label>
                            <Textarea
                              id="highlights"
                              value={formData.highlights}
                              onChange={(e) => setFormData({ ...formData, highlights: e.target.value })}
                              placeholder="One highlight per line"
                            />
                          </div>
                          <div className="col-span-2">
                            <Label htmlFor="learning_points">What You'll Learn</Label>
                            <Textarea
                              id="learning_points"
                              value={formData.learning_points}
                              onChange={(e) => setFormData({ ...formData, learning_points: e.target.value })}
                              placeholder="One learning point per line"
                            />
                          </div>
                          <div>
                            <Label htmlFor="total_lessons">Total Lessons</Label>
                            <Input
                              id="total_lessons"
                              type="number"
                              value={formData.total_lessons}
                              onChange={(e) => setFormData({ ...formData, total_lessons: e.target.value })}
                              placeholder="0"
                            />
                          </div>
                          <div>
                            <Label htmlFor="status">Status</Label>
                            <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="inactive">Inactive</SelectItem>
                                <SelectItem value="archived">Archived</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-2">
                            <Label htmlFor="image_url">Image URL</Label>
                            <Input
                              id="image_url"
                              value={formData.image_url}
                              onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                              placeholder="https://example.com/image.jpg"
                            />
                          </div>
                          <div className="col-span-2 space-y-3">
                            <div className="flex items-center justify-between">
                              <Label>Monthly documents</Label>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setDocumentDrafts([
                                  ...documentDrafts,
                                  createDocumentDraft({ monthIndex: documentDrafts.at(-1)?.monthIndex || '1' }),
                                ])}
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Add document
                              </Button>
                            </div>
                            {documentDrafts.map((document, index) => (
                              <div key={document.key} className="grid grid-cols-2 gap-2 rounded-lg border p-3">
                                <div>
                                  <Label htmlFor={`document-month-${document.key}`}>Month</Label>
                                  <Input
                                    id={`document-month-${document.key}`}
                                    type="number"
                                    min={1}
                                    max={24}
                                    value={document.monthIndex}
                                    onChange={(event) => {
                                      const nextDrafts = [...documentDrafts];
                                      nextDrafts[index] = { ...document, monthIndex: event.target.value };
                                      setDocumentDrafts(nextDrafts);
                                    }}
                                  />
                                </div>
                                <div>
                                  <Label htmlFor={`document-title-${document.key}`}>Title</Label>
                                  <Input
                                    id={`document-title-${document.key}`}
                                    value={document.title}
                                    onChange={(event) => {
                                      const nextDrafts = [...documentDrafts];
                                      nextDrafts[index] = { ...document, title: event.target.value };
                                      setDocumentDrafts(nextDrafts);
                                    }}
                                    placeholder="Week notes"
                                  />
                                </div>
                                <div className="col-span-2">
                                  <Label htmlFor={`document-link-${document.key}`}>Google Drive link</Label>
                                  <Input
                                    id={`document-link-${document.key}`}
                                    value={document.driveUrl}
                                    onChange={(event) => {
                                      const nextDrafts = [...documentDrafts];
                                      nextDrafts[index] = { ...document, driveUrl: event.target.value };
                                      setDocumentDrafts(nextDrafts);
                                    }}
                                    placeholder="https://drive.google.com/file/d/FILE_ID/view"
                                  />
                                </div>
                                <div className="col-span-2">
                                  <Label htmlFor={`document-preview-${document.key}`}>Preview image link</Label>
                                  <Input
                                    id={`document-preview-${document.key}`}
                                    value={document.previewImageUrl}
                                    onChange={(event) => {
                                      const nextDrafts = [...documentDrafts];
                                      nextDrafts[index] = { ...document, previewImageUrl: event.target.value };
                                      setDocumentDrafts(nextDrafts);
                                    }}
                                    placeholder="Optional https image. A Drive preview is used when this is blank."
                                  />
                                </div>
                                {documentDrafts.length > 1 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="justify-self-start"
                                    onClick={() => setDocumentDrafts(documentDrafts.filter((draft) => draft.key !== document.key))}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Remove
                                  </Button>
                                )}
                              </div>
                            ))}
                            <p className="text-xs text-gray-500">
                              Share each file so anyone with the link can view it. After purchase, the course page groups these by month. The preview image opens the document, and the student can download it.
                            </p>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button onClick={handleSubmit} disabled={editingCourse !== null && !documentsLoaded}>
                            {editingCourse ? 'Update' : 'Create'}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>

                  <div className="grid gap-4">
                    {filteredCourses.map((course) => (
                      <Card key={course.id}>
                        <CardHeader>
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <CardTitle className="flex items-center gap-2">
                                {course.title}
                                {getStatusBadge(course.status)}
                              </CardTitle>
                              <CardDescription className="mt-1">
                                {course.description}
                              </CardDescription>
                              <div className="flex gap-4 mt-2 text-sm text-gray-600">
                                <span>₹{course.price}</span>
                                {course.original_price && (
                                  <span className="line-through text-gray-400">₹{course.original_price}</span>
                                )}
                                <span>{course.category}</span>
                                <span>{course.duration}</span>
                                <span>{course.total_lessons ?? 0} lessons</span>
                                <span>{course.course_type === COURSE_TYPE_CAREER_TEST ? 'Career test' : 'Course'}</span>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openEditDialog(course)}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDelete(course.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                      </Card>
                    ))}
                  </div>

                  {filteredCourses.length === 0 && (
                    <div className="text-center text-gray-500 py-8">
                      No courses found. Create your first course to get started.
                    </div>
                  )}
                </div>
              </AdminSearchableTab>
            </TabsContent>

            {catalog !== 'career_test' && (
              <TabsContent value="sections">
                <AdminSectionManagement />
              </TabsContent>
            )}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default CourseManagement;
