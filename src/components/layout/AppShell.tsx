import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

function Breadcrumbs({ items, className }: { items?: BreadcrumbItem[]; className?: string }) {
  if (!items || items.length === 0) return null;
  return (
    <nav className={cn('text-xs flex items-center gap-0.5 flex-wrap', className)} aria-label="Breadcrumb">
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <span key={idx} className="inline-flex items-center gap-0.5">
            {idx > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground/50 flex-shrink-0" />}
            {item.href && !isLast ? (
              <Link
                to={item.href}
                className="text-muted-foreground hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors px-1.5 py-0.5 rounded hover:bg-indigo-50/60 dark:hover:bg-indigo-950/30"
              >
                {item.label}
              </Link>
            ) : item.onClick && !isLast ? (
              <button
                onClick={item.onClick}
                className="text-muted-foreground hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors px-1.5 py-0.5 rounded hover:bg-indigo-50/60 dark:hover:bg-indigo-950/30"
              >
                {item.label}
              </button>
            ) : (
              <span className="text-foreground font-semibold px-1.5 py-0.5">{item.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
}

export function PageHeader({ title, description, actions, breadcrumbs }: PageHeaderProps) {
  return (
    <div className="mb-4">
      <Breadcrumbs items={breadcrumbs} className="mb-1.5" />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">{title}</h1>
          {description && (
            <p className="text-muted-foreground mt-0.5 text-sm">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <div className="px-4 py-3 lg:px-6 lg:py-4">
        {children}
      </div>
    </div>
  );
}
