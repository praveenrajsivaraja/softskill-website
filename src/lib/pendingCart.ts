import { supabase } from '@/integrations/supabase/client';

const PENDING_CART_COURSE_KEY = 'pendingCartCourseId';

export const rememberCourseForCart = (courseId: string) => {
  sessionStorage.setItem(PENDING_CART_COURSE_KEY, courseId);
};

export const readPendingCartCourseId = () => {
  return sessionStorage.getItem(PENDING_CART_COURSE_KEY);
};

export const addPendingCourseToCart = async (userId: string): Promise<boolean> => {
  const courseId = sessionStorage.getItem(PENDING_CART_COURSE_KEY);
  if (!courseId) {
    return false;
  }

  sessionStorage.removeItem(PENDING_CART_COURSE_KEY);

  const { data: existingItem, error: existingError } = await supabase
    .from('cart_items')
    .select('id')
    .eq('user_id', userId)
    .eq('course_id', courseId)
    .maybeSingle();

  if (existingError) {
    console.error('Error checking pending cart course:', existingError);
    sessionStorage.setItem(PENDING_CART_COURSE_KEY, courseId);
    return false;
  }

  if (existingItem) {
    return true;
  }

  const { error: insertError } = await supabase
    .from('cart_items')
    .insert({
      user_id: userId,
      course_id: courseId,
    });

  if (insertError) {
    console.error('Error adding pending course to cart:', insertError);
    sessionStorage.setItem(PENDING_CART_COURSE_KEY, courseId);
    return false;
  }

  return true;
};
