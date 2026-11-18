import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { nextTourIndex, previousTourIndex, type AdminMenuTourStep } from '@/lib/adminMenuTour';

interface AnchorBox {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface AdminMenuTourProps {
  steps: AdminMenuTourStep[];
  onClose: () => void;
}

const cardWidth = 280;

const AdminMenuTour = ({ steps, onClose }: AdminMenuTourProps) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [anchor, setAnchor] = useState<AnchorBox | null>(null);
  const step = steps[stepIndex];
  const isLastStep = stepIndex === steps.length - 1;

  useEffect(() => {
    const current = steps[stepIndex];
    if (!current) {
      return undefined;
    }
    const target = document.querySelector(`[data-admin-tour="${current.path}"]`);
    target?.scrollIntoView({ block: 'nearest' });

    const place = () => {
      const rect = target?.getBoundingClientRect();
      if (!rect) {
        setAnchor(null);
        return;
      }
      setAnchor({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
    };

    const frame = window.requestAnimationFrame(place);
    const nav = target?.closest('nav');
    nav?.addEventListener('scroll', place);
    window.addEventListener('resize', place);
    return () => {
      window.cancelAnimationFrame(frame);
      nav?.removeEventListener('scroll', place);
      window.removeEventListener('resize', place);
    };
  }, [stepIndex, steps]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  if (!step) {
    return null;
  }

  const cardLeft = anchor
    ? Math.min(anchor.left + anchor.width + 12, window.innerWidth - cardWidth - 12)
    : 280;
  const cardTop = anchor
    ? Math.min(Math.max(12, anchor.top), window.innerHeight - 190)
    : 24;

  return createPortal(
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-labelledby="admin-menu-tour-title">
      {anchor && (
        <div
          className="pointer-events-none absolute rounded-lg ring-2 ring-red-500"
          style={{
            top: anchor.top - 4,
            left: anchor.left - 4,
            width: anchor.width + 8,
            height: anchor.height + 8,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.45)',
          }}
        />
      )}
      <div
        className="absolute rounded-xl bg-white p-4 text-gray-900 shadow-2xl"
        style={{ top: cardTop, left: Math.max(12, cardLeft), width: cardWidth }}
      >
        <p className="text-xs font-medium text-red-600">Menu guide {stepIndex + 1} of {steps.length}</p>
        <h2 id="admin-menu-tour-title" className="mt-1 text-base font-semibold">{step.label}</h2>
        <p className="mt-1 text-sm text-gray-600">{step.text}</p>
        {stepIndex === 0 && (
          <p className="mt-2 text-xs text-gray-500">Drag a menu row by its handle to change the order. This guide follows that order.</p>
        )}
        <div className="mt-4 flex items-center justify-between gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Skip
          </Button>
          <div className="flex gap-2">
            {stepIndex > 0 && (
              <Button type="button" variant="outline" size="sm" onClick={() => setStepIndex(previousTourIndex(stepIndex))}>
                Back
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (isLastStep) {
                  onClose();
                  return;
                }
                setStepIndex(nextTourIndex(stepIndex, steps.length));
              }}
            >
              {isLastStep ? 'Done' : 'Next'}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default AdminMenuTour;
