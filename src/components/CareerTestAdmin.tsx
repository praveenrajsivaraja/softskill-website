import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2 } from 'lucide-react';
import CourseManagement from '@/components/CourseManagement';
import type { Database } from '@/integrations/supabase/types';

type PageSection = Database['public']['Tables']['page_sections']['Row'];

const SECTION_KEYS = ['hero', 'feature', 'benefit', 'cta'] as const;

const emptySection = {
  section_key: 'feature',
  title: '',
  description: '',
  order_index: '0',
};

const CareerTestAdmin = () => {
  const { toast } = useToast();
  const [sections, setSections] = useState<PageSection[]>([]);
  const [editingSection, setEditingSection] = useState<PageSection | null>(null);
  const [formData, setFormData] = useState(emptySection);

  useEffect(() => {
    fetchSections();
  }, []);

  const fetchSections = async () => {
    const { data, error } = await supabase
      .from('page_sections')
      .select('*')
      .eq('page_key', 'career_test')
      .order('order_index', { ascending: true });

    if (error) {
      console.error('Error fetching career test sections:', error);
      toast({
        title: 'Error',
        description: 'Failed to load career test page sections.',
        variant: 'destructive',
      });
      return;
    }

    setSections(data ?? []);
  };

  const resetForm = () => {
    setEditingSection(null);
    setFormData(emptySection);
  };

  const saveSection = async () => {
    if (!formData.title.trim()) return;

    const payload = {
      page_key: 'career_test',
      section_key: formData.section_key,
      title: formData.title.trim(),
      description: formData.description.trim() || null,
      order_index: Number(formData.order_index) || 0,
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    const result = editingSection
      ? await supabase.from('page_sections').update(payload).eq('id', editingSection.id)
      : await supabase.from('page_sections').insert(payload);

    if (result.error) {
      console.error('Error saving career test section:', result.error);
      toast({
        title: 'Error',
        description: 'Failed to save the career test section.',
        variant: 'destructive',
      });
      return;
    }

    toast({ title: 'Saved', description: 'Career test section updated.' });
    resetForm();
    fetchSections();
  };

  const deleteSection = async (sectionId: string) => {
    if (!confirm('Delete this career test section?')) return;

    const { error } = await supabase.from('page_sections').delete().eq('id', sectionId);
    if (error) {
      console.error('Error deleting career test section:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete the career test section.',
        variant: 'destructive',
      });
      return;
    }

    toast({ title: 'Deleted', description: 'Career test section removed.' });
    fetchSections();
  };

  return (
    <div className="space-y-6">
      <CourseManagement catalog="career_test" />

      <Card>
        <CardHeader>
          <CardTitle>Career Test Page</CardTitle>
          <CardDescription>
            Edit the hero, features, benefits, and call to action shown on the career test page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="section_key">Section</Label>
              <Select
                value={formData.section_key}
                onValueChange={(value) => setFormData({ ...formData, section_key: value })}
              >
                <SelectTrigger id="section_key">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SECTION_KEYS.map((sectionKey) => (
                    <SelectItem key={sectionKey} value={sectionKey}>
                      {sectionKey}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="order_index">Order</Label>
              <Input
                id="order_index"
                type="number"
                value={formData.order_index}
                onChange={(event) => setFormData({ ...formData, order_index: event.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="section_title">Title</Label>
              <Input
                id="section_title"
                value={formData.title}
                onChange={(event) => setFormData({ ...formData, title: event.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="section_description">Description</Label>
              <Textarea
                id="section_description"
                value={formData.description}
                onChange={(event) => setFormData({ ...formData, description: event.target.value })}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={saveSection}>
              {editingSection ? <Edit className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              {editingSection ? 'Update Section' : 'Add Section'}
            </Button>
            {editingSection && (
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            )}
          </div>

          <div className="space-y-3">
            {sections.map((section) => (
              <div key={section.id} className="flex items-start justify-between gap-4 rounded-lg border p-4">
                <div>
                  <p className="text-xs uppercase text-gray-500">{section.section_key}</p>
                  <p className="font-medium">{section.title}</p>
                  {section.description && <p className="text-sm text-gray-600">{section.description}</p>}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingSection(section);
                      setFormData({
                        section_key: section.section_key,
                        title: section.title || '',
                        description: section.description || '',
                        order_index: String(section.order_index),
                      });
                    }}
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => deleteSection(section.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CareerTestAdmin;
