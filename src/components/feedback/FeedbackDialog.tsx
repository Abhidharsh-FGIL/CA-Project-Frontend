import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import {
  Star,
  Send,
  Loader2,
  CheckCircle2,
  Sparkles,
  MessageSquare,
} from 'lucide-react';

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ratingLabels = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];
const ratingEmojis = ['', '\ud83d\ude1e', '\ud83d\ude10', '\ud83d\ude42', '\ud83d\ude0a', '\ud83e\udd29'];
const ratingColors = [
  '',
  'text-red-500',
  'text-orange-500',
  'text-yellow-500',
  'text-green-500',
  'text-emerald-500',
];

export function FeedbackDialog({ open, onOpenChange }: FeedbackDialogProps) {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const activeRating = hoveredRating || rating;

  const resetForm = () => {
    setRating(0);
    setHoveredRating(0);
    setComment('');
    setSent(false);
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      // Delay reset so exit animation plays
      setTimeout(resetForm, 300);
    }
    onOpenChange(isOpen);
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error('Please select a rating');
      return;
    }

    setSending(true);
    try {
      await api.post('/api/v1/feedback', {
        rating,
        comment: comment.trim() || null,
        page: window.location.pathname,
      });
      setSent(true);
      toast.success('Thank you for your feedback!');
    } catch {
      toast.error('Failed to send feedback. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md overflow-hidden">
        <AnimatePresence mode="wait">
          {sent ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="flex flex-col items-center text-center py-6"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4"
              >
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              </motion.div>
              <motion.h3
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-xl font-bold mb-2"
              >
                Thank You! {ratingEmojis[rating]}
              </motion.h3>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-sm text-muted-foreground mb-6"
              >
                Your feedback helps us make GenVerse better for everyone.
              </motion.p>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <Button variant="outline" onClick={() => handleClose(false)}>
                  Close
                </Button>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  Share Your Feedback
                </DialogTitle>
                <DialogDescription>
                  We'd love to hear what you think about GenVerse.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5 mt-4">
                {/* Star rating */}
                <div className="text-center">
                  <p className="text-sm font-medium mb-3">How would you rate your experience?</p>
                  <div className="flex items-center justify-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <motion.button
                        key={star}
                        type="button"
                        className="relative p-1 rounded-lg transition-colors hover:bg-muted/50"
                        onMouseEnter={() => setHoveredRating(star)}
                        onMouseLeave={() => setHoveredRating(0)}
                        onClick={() => setRating(star)}
                        whileHover={{ scale: 1.15 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <Star
                          className={`h-8 w-8 transition-all duration-200 ${
                            star <= activeRating
                              ? 'fill-[hsl(var(--xp))] text-[hsl(var(--xp))] drop-shadow-[0_0_8px_hsl(var(--xp)/0.4)]'
                              : 'text-muted-foreground/30'
                          }`}
                        />
                        {star <= activeRating && (
                          <motion.div
                            className="absolute inset-0 rounded-lg bg-[hsl(var(--xp)/0.08)]"
                            layoutId="star-bg"
                            initial={false}
                            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                          />
                        )}
                      </motion.button>
                    ))}
                  </div>
                  <AnimatePresence mode="wait">
                    {activeRating > 0 && (
                      <motion.div
                        key={activeRating}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="mt-2 flex items-center justify-center gap-2"
                      >
                        <span className="text-lg">{ratingEmojis[activeRating]}</span>
                        <Badge
                          variant="secondary"
                          className={`text-xs font-semibold ${ratingColors[activeRating]}`}
                        >
                          {ratingLabels[activeRating]}
                        </Badge>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Comment */}
                <div>
                  <Textarea
                    placeholder="Tell us more about your experience... (optional)"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="min-h-[100px] resize-none"
                    maxLength={1000}
                  />
                  <div className="flex items-center justify-between mt-1.5">
                    <p className="text-[11px] text-muted-foreground">
                      {user?.name && (
                        <span>Submitting as <span className="font-medium text-foreground">{user.name}</span></span>
                      )}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {comment.length}/1000
                    </p>
                  </div>
                </div>

                {/* Submit */}
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleClose(false)}
                    disabled={sending}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 gap-2"
                    onClick={handleSubmit}
                    disabled={rating === 0 || sending}
                  >
                    {sending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Send Feedback
                      </>
                    )}
                  </Button>
                </div>

                {/* Info note */}
                <p className="text-[11px] text-muted-foreground text-center flex items-center justify-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Your feedback is sent to our team and helps us improve GenVerse.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
