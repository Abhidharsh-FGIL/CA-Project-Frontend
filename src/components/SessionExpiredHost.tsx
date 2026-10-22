import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Smartphone } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { onSessionExpired, type Portal, type SessionEnd } from '@/lib/session-bus';

/** Where each portal signs in. */
const LOGIN_ROUTE: Record<Portal, string> = {
  user: '/user/login',
  admin: '/adminlogin',
};

/**
 * The popup for a session that has run out.
 *
 * Mounted once, inside the router. When the API client finds a token and its refresh both refused
 * it announces on `session-bus`; this tells the person, and the one way on is back to the login
 * page — dismissing it any other way (Escape) goes there too, since nothing else on screen can work.
 */
export default function SessionExpiredHost() {
  const navigate = useNavigate();
  const [portal, setPortal] = useState<Portal | null>(null);
  const [reason, setReason] = useState<SessionEnd>('expired');
  const [open, setOpen] = useState(false);

  useEffect(
    () =>
      onSessionExpired((next, why) => {
        setPortal(next);
        setReason(why);
        setOpen(true);
      }),
    [],
  );

  const login = () => {
    setOpen(false);
    navigate(LOGIN_ROUTE[portal ?? 'user'], { replace: true });
  };

  return (
    <AlertDialog open={open} onOpenChange={next => !next && login()}>
      <AlertDialogContent className="max-w-sm rounded-2xl p-0 gap-0 overflow-hidden w-[calc(100%-2rem)]">
        <div className="p-6 pb-4">
          <AlertDialogHeader className="items-center text-center sm:text-center space-y-3">
            <span className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-600 flex items-center justify-center">
              {reason === 'replaced' ? <Smartphone className="w-5 h-5" aria-hidden /> : <Clock className="w-5 h-5" aria-hidden />}
            </span>
            <AlertDialogTitle className="text-xl text-gray-900 dark:text-white">
              {reason === 'replaced' ? 'Signed in on another device' : 'Session expired'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
              {reason === 'replaced'
                ? 'You were signed in on another device, so this session has ended. Please log in again to continue here.'
                : 'Your session has expired. Please log in again to continue.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
        </div>
        <AlertDialogFooter className="px-6 pb-6 pt-2">
          <AlertDialogAction className="w-full">Login again</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
