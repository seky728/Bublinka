'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Package, Layers, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();

  const navItems = [
    {
      label: 'Sklad',
      href: '/inventory',
      icon: Package,
    },
    {
      label: 'Produkty',
      href: '/products',
      icon: Layers,
    },
    {
      label: 'Objednávky',
      href: '/orders',
      icon: FileText,
    },
  ];

  return (
    <TooltipProvider>
      <div
        className={cn(
          'relative h-screen border-r bg-background transition-all duration-300',
          isCollapsed ? 'w-[70px]' : 'w-64'
        )}
      >
        <div className="p-6 border-b">
          <Link
            href="/"
            className="flex items-center gap-3 group"
          >
            <Package className="h-5 w-5 shrink-0" />
            <h1
              className={cn(
                'text-xl font-bold transition-opacity duration-300 whitespace-nowrap',
                isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'
              )}
            >
              Bublinka ERP
            </h1>
          </Link>
        </div>
        <nav className="p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');

            const buttonContent = (
              <Button
                variant="ghost"
                className={cn(
                  'w-full transition-all duration-300',
                  isCollapsed ? 'justify-center px-0' : 'justify-start',
                  isActive && 'bg-accent text-accent-foreground'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span
                  className={cn(
                    'transition-opacity duration-300 whitespace-nowrap',
                    isCollapsed
                      ? 'opacity-0 w-0 overflow-hidden'
                      : 'opacity-100 ml-2'
                  )}
                >
                  {item.label}
                </span>
              </Button>
            );

            if (isCollapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <Link href={item.href}>{buttonContent}</Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>{item.label}</p>
                  </TooltipContent>
                </Tooltip>
              );
            }

            return (
              <Link key={item.href} href={item.href}>
                {buttonContent}
              </Link>
            );
          })}
        </nav>
        <div className="absolute top-1/2 -translate-y-1/2 right-[-14px]">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full bg-background border border-border shadow-sm hover:bg-accent hover:shadow-md transition-all duration-200"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
}
