'use client';

import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';

export interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = 'Vyberte...',
  searchPlaceholder = 'Hledat...',
  emptyText = 'Žádné výsledky',
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const [popoverWidth, setPopoverWidth] = React.useState<number | undefined>();

  const selectedOption = options.find((option) => option.value === value);

  const filteredOptions = React.useMemo(() => {
    if (!search) return options;
    return options.filter((option) =>
      option.label.toLowerCase().includes(search.toLowerCase()),
    );
  }, [options, search]);

  React.useEffect(() => {
    if (open && triggerRef.current) {
      setPopoverWidth(triggerRef.current.offsetWidth);
    }
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          variant='outline'
          role='combobox'
          aria-expanded={open}
          className={cn('w-full justify-between', className)}
        >
          {selectedOption ? selectedOption.label : placeholder}
          <ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className='p-0'
        align='start'
        style={{ width: popoverWidth }}
      >
        <div className='p-2'>
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className='mb-2'
          />
        </div>
        <div className='max-h-[300px] overflow-auto'>
          {filteredOptions.length === 0 ? (
            <div className='py-6 text-center text-sm text-muted-foreground'>
              {emptyText}
            </div>
          ) : (
            <div className='p-1'>
              {filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type='button'
                  className={cn(
                    'relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground',
                    value === option.value && 'bg-accent text-accent-foreground',
                  )}
                  onClick={() => {
                    onValueChange(option.value);
                    setOpen(false);
                    setSearch('');
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === option.value ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
