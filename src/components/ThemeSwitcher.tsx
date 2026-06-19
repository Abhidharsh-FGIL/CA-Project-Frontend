import { Moon, Sun, Palette, Check } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ThemePreset } from '@/types';

const presets: { id: ThemePreset; name: string; color: string }[] = [
  { id: 'classic', name: 'Classic', color: 'bg-slate-800' },
  { id: 'indigo', name: 'Indigo', color: 'bg-indigo-500' },
  { id: 'teal', name: 'Teal', color: 'bg-teal-500' },
  { id: 'sunset', name: 'Sunset', color: 'bg-orange-500' },
  { id: 'emerald', name: 'Emerald', color: 'bg-emerald-500' },
];

export function ThemeSwitcher() {
  const { theme, setPreset, toggleMode } = useTheme();
  const { activeWorkspace } = useWorkspaceContext();

  // Hide color theme preset picker when org branding overrides it
  const orgBrandingActive = activeWorkspace?.brandingEnabled && activeWorkspace?.themeColor;

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleMode}
        className="h-9 w-9"
      >
        {theme.mode === 'light' ? (
          <Sun className="h-4 w-4" />
        ) : (
          <Moon className="h-4 w-4" />
        )}
        <span className="sr-only">Toggle theme mode</span>
      </Button>

      {!orgBrandingActive && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Palette className="h-4 w-4" />
              <span className="sr-only">Change color preset</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Color Theme</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {presets.map((preset) => (
              <DropdownMenuItem
                key={preset.id}
                onClick={() => setPreset(preset.id)}
                className="flex items-center gap-3 cursor-pointer"
              >
                <span className={`h-4 w-4 rounded-full ${preset.color}`} />
                <span className="flex-1">{preset.name}</span>
                {theme.preset === preset.id && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
