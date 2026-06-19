import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquareHeart } from 'lucide-react';
import { FeedbackDialog } from './FeedbackDialog';

export function FloatingFeedback() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-8 left-8 z-[9998] h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-[0_4px_20px_rgba(0,0,0,0.3)] flex items-center justify-center hover:shadow-[0_6px_30px_rgba(0,0,0,0.4)] transition-shadow"
            aria-label="Send Feedback"
            title="Send Feedback"
          >
            <MessageSquareHeart className="h-5 w-5" />
          </motion.button>
        )}
      </AnimatePresence>
      <FeedbackDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
