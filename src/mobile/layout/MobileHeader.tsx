import { ArrowLeft, Menu, Search, MoreVertical, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface MobileHeaderProps {
  title: string;
  onBack?: () => void;
  onMenuClick?: () => void;
  onSearchClick?: () => void;
  showActions?: boolean;
  actions?: React.ReactNode;
}

export function MobileHeader({ 
  title, 
  onBack, 
  onMenuClick, 
  onSearchClick,
  showActions = true,
  actions
}: MobileHeaderProps) {

  return (
    <header 
      className="sticky top-0 z-40 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border/50"
      data-mobile-header
    >
      <div className="flex h-14 items-center px-3 gap-2">
        {/* Left: Back/Menu */}
        <div className="flex items-center gap-1">
          {onBack && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={onBack}
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          
          {onMenuClick && !onBack && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={onMenuClick}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* Center: Title */}
        <div className="flex-1 min-w-0 px-2">
          <h1 className="text-base font-semibold text-foreground truncate text-center">
            {title}
          </h1>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1">
          {showActions && !actions && (
            <>
              {onSearchClick && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={onSearchClick}
                  aria-label="Search"
                >
                  <Search className="h-5 w-5" />
                </Button>
              )}
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    aria-label="More actions"
                  >
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => {
                    if (navigator.share) {
                      navigator.share({
                        title: title,
                        url: window.location.href
                      }).catch(() => {});
                    }
                  }}>
                    <Share2 className="mr-2 h-4 w-4" />
                    <span>Share Link</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
          {actions}
        </div>
      </div>
    </header>
  );
}
