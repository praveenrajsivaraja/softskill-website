import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getAuthRedirectUrl, isEmailLinkType, readEmailLinkError } from '@/lib/authEmailLink';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, BookOpen, Loader2 } from 'lucide-react';

const AuthConfirm = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const tokenHash = searchParams.get('token_hash');
  const linkType = searchParams.get('type');
  const [linkError] = useState(() => readEmailLinkError(window.location.hash));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [resendEmail, setResendEmail] = useState('');
  const [didSendNewLink, setDidSendNewLink] = useState(false);

  const canVerify = Boolean(tokenHash && isEmailLinkType(linkType) && !linkError);
  const showConfirmButton = canVerify && !formError && !didSendNewLink;
  const showResendForm = !didSendNewLink && (!canVerify || Boolean(formError));

  useEffect(() => {
    if (!linkError) {
      return;
    }

    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  }, [linkError]);

  const handleConfirm = async () => {
    if (!tokenHash || !isEmailLinkType(linkType)) {
      setFormError('This confirmation link is missing required details.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: linkType,
      });

      if (error) {
        setFormError(error.message || 'This email link is invalid or has expired.');
        return;
      }

      const userId = data.user?.id;
      let nextPath = '/';
      if (userId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .single();

        if (profile?.role === 'admin') {
          nextPath = '/admin';
        }
      }

      toast({
        title: 'Email confirmed',
        description: 'Your account is ready.',
      });
      navigate(nextPath, { replace: true });
    } catch (error) {
      console.error('Email confirmation failed:', error);
      setFormError('Could not confirm this email. Request a new link and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setFormError('');

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: resendEmail.trim(),
        options: {
          emailRedirectTo: getAuthRedirectUrl(),
        },
      });

      if (error) {
        setFormError(error.message || 'Could not send a new confirmation email.');
        return;
      }

      setDidSendNewLink(true);
    } catch (error) {
      console.error('Confirmation resend failed:', error);
      setFormError('Could not send a new confirmation email. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-kiki-purple-50 via-white to-kiki-blue-50 flex items-center justify-center px-4">
      <Card className="max-w-md w-full shadow-2xl border-kiki-purple-200">
        <CardHeader className="text-center space-y-4 pb-6">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-kiki-purple-500 to-kiki-blue-600 rounded-2xl flex items-center justify-center">
            <BookOpen className="text-white w-8 h-8" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-gray-900">Confirm your email</CardTitle>
            <CardDescription className="text-gray-600 mt-2">
              {showConfirmButton
                ? 'Click the button below to finish creating your account.'
                : 'This confirmation link cannot be used.'}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {(linkError || formError) && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{formError || linkError}</AlertDescription>
            </Alert>
          )}

          {showConfirmButton && (
            <Button
              type="button"
              onClick={handleConfirm}
              className="w-full bg-gradient-to-r from-kiki-purple-600 to-kiki-blue-600 hover:from-kiki-purple-700 hover:to-kiki-blue-700 text-white"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Confirming...
                </>
              ) : (
                'Confirm email'
              )}
            </Button>
          )}

          {showResendForm && (
            <form onSubmit={handleResend} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="resend-email">Email</Label>
                <Input
                  id="resend-email"
                  type="email"
                  value={resendEmail}
                  onChange={(event) => setResendEmail(event.target.value)}
                  required
                  placeholder="Enter the email you signed up with"
                  className="border-kiki-purple-200 focus:border-kiki-purple-400"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-kiki-purple-600 to-kiki-blue-600 hover:from-kiki-purple-700 hover:to-kiki-blue-700 text-white"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Sending...
                  </>
                ) : (
                  'Send a new confirmation email'
                )}
              </Button>
            </form>
          )}

          {didSendNewLink && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                A new confirmation email is on its way. Open the newest message and confirm from this site.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthConfirm;
