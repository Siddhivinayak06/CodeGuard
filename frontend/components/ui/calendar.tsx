'use client'

import * as React from 'react'
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from 'lucide-react'
import { DayButton, DayPicker, getDefaultClassNames } from 'react-day-picker'

import { cn } from '@/lib/utils'
import { Button, buttonVariants } from '@/components/ui/button'

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = 'label',
  buttonVariant = 'ghost',
  formatters,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>['variant']
}) {
  const defaultClassNames = getDefaultClassNames()

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      captionLayout={captionLayout}
      formatters={{
        formatMonthDropdown: (date) =>
          date.toLocaleString('default', { month: 'short' }),
        ...formatters,
      }}
      classNames={{
        root: cn('w-full', defaultClassNames.root),
        months: cn('flex flex-col sm:flex-row gap-4 relative justify-center', defaultClassNames.months),
        month: cn('space-y-4 flex flex-col', defaultClassNames.month),
        nav: cn('flex items-center absolute top-2 right-2 gap-1', defaultClassNames.nav),

        // Navigation Buttons
        button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          'h-8 w-8 bg-transparent p-0 opacity-70 hover:opacity-100'
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          'h-8 w-8 bg-transparent p-0 opacity-70 hover:opacity-100'
        ),

        // Month Title & Dropdowns
        caption: 'flex justify-between items-center h-10 px-2 relative',
        caption_label: cn(
          'text-sm font-semibold text-gray-900 dark:text-gray-100',
          captionLayout === 'label' ? 'absolute left-2' : 'hidden'
        ),
        month_grid: 'w-full border-collapse space-y-1',
        weekdays: 'flex justify-between mb-2 text-gray-500 dark:text-gray-400',
        weekday: 'text-[0.8rem] font-medium w-9 flex justify-center',

        week: 'flex justify-between w-full mt-2',
        day: 'h-9 w-9 p-0 font-normal',

        day_button: cn(
          buttonVariants({ variant: 'ghost' }),
          "h-9 w-9 p-0 font-normal text-gray-900 dark:text-gray-100 aria-selected:opacity-100 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white focus:bg-gray-100 dark:focus:bg-gray-800 focus:text-gray-900 dark:focus:text-white focus:outline-none transition-all rounded-lg"
        ),

        range_start: 'day-range-start',
        range_end: 'day-range-end',
        selected: 'bg-indigo-600 text-white hover:bg-indigo-700 hover:text-white focus:bg-indigo-600 focus:text-white',
        today: 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-bold',
        outside: 'text-gray-400 opacity-50 dark:text-gray-500',
        disabled: 'text-gray-400 opacity-50 dark:text-gray-600 cursor-not-allowed',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) => {
          const Icon = orientation === 'left' ? ChevronLeftIcon : ChevronRightIcon;
          return <Icon className="h-4 w-4" />;
        },
        DayButton: (props) => {
          // If a custom DayButton is passed in components, use it.
          // But here we need to ensure our internal styles are applied if no custom component is handling strictly.
          // Since the dashboard passes a custom DayButton, we just pass through or use a default if needed.
          // However, react-day-picker v9 structure uses `components.DayButton`.

          // If we want to use the passed custom component from `props.components`, we don't need to define it here necessarily unless we want to wrap it.
          // But modifying `components` prop in DayPicker overrides internal.

          // Wait, the previous implementation had logic to delegate to `CalendarDayButton`. 
          // If the parent passes `components={{ DayButton: ... }}`, `react-day-picker` uses that.
          // If NOT, it uses default.
          // The previous code explicitly set `DayButton: CalendarDayButton`.
          // We will keep that pattern but simplify CalendarDayButton.
          return <CalendarDayButton {...props} />
        },
        ...components,
      }}
      {...props}
    />
  )
}

function CalendarDayButton({ day, modifiers, className, ...props }: any) {
  const ref = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => {
    if (modifiers?.focused) {
      ref.current?.focus()
    }
  }, [modifiers?.focused])

  return (
    <button
      ref={ref}
      {...props}
      className={cn(className)}
      type="button"
    />
  )
}

export { Calendar, CalendarDayButton }
